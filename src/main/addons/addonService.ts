import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import addonCatalog from '../../shared/addons/addonCatalog.json'
import type {
	AddCustomAddonInput,
	AddonActionInput,
	AddonCatalogEntry,
	AddonDeleteResult,
	AddonInstallResult,
	AddonsListResult,
	AddonProgress,
	AddonSummary,
	AddonsUpdateAllResult,
	AddonStatus,
	CustomAddonsTransferResult
} from '@shared/contracts'
import { buildGitHubSourceZipUrl } from '../../core/github/sourceZip'
import { getWowPaths, validateWowPath } from '../../core/wow/wowPaths'
import {
	compareAddonVersions,
	createCustomAddonEntry,
	hasGitFolder,
	parseTocVersion,
	readInstalledAddonVersion
} from '../../core/addons/addons'
import type { SettingsStore } from '../settings/fileSettingsStore'
import type { SecretStore } from '../secrets/memorySecretStore'

type DownloadFile = (url: string, targetPath: string, options?: { token?: string }) => Promise<void>
type UnzipToDirectory = (archivePath: string, targetDir: string) => Promise<void>

interface AddonCatalogFile {
	addons: AddonCatalogEntry[]
}

type AddonProgressHandler = (progress: AddonProgress) => void

export function createAddonService(
	getUserDataPath: () => string,
	settingsStore: SettingsStore,
	secretStore: SecretStore,
	downloadFile: DownloadFile,
	unzipToDirectory: UnzipToDirectory
) {
	const getCustomAddonsPath = () => join(getUserDataPath(), 'custom-addons.json')

	async function list(checkRemote = false, installedOnly = false): Promise<AddonsListResult> {
		const catalogEntries = await getCatalogEntries()
		const entries = installedOnly
			? await filterInstalledCatalogEntries(catalogEntries)
			: catalogEntries
		const addons = await Promise.all(entries.map((entry) => summarizeAddon(entry, checkRemote)))
		const counts = countSources(addons)

		return {
			loadedAt: new Date().toISOString(),
			total: addons.length,
			...counts,
			addons
		}
	}

	async function install(
		input: AddonActionInput,
		onProgress?: AddonProgressHandler
	): Promise<AddonInstallResult> {
		const entries = await getCatalogEntries()
		const entry = entries.find((addon) => addon.id === input.addonId)
		if (!entry) throw new Error('Аддон не найден в каталоге')
		if (!entry.repo) throw new Error('У аддона нет GitHub репозитория')

		const settings = await settingsStore.get()
		const validation = validateWowPath(settings.wowPath)
		if (!validation.valid) throw new Error('Сначала укажи корректную папку WoW')

		const existing = await summarizeAddon(entry, false)
		if (existing.status === 'manual-git') {
			throw new Error('Аддон установлен из git и пропущен автообновлением')
		}

		const tempRoot = await mkdtemp(join(tmpdir(), 'sirus-addon-'))
		const archivePath = join(tempRoot, `${entry.name}.zip`)
		const unpackPath = join(tempRoot, 'unpacked')
		const token = await secretStore.get('github-token')
		const progressState = createAddonProgressState('install', 1, 0)

		try {
			reportAddonProgress(onProgress, progressState, entry, 'preparing')
			const zipUrl = buildGitHubSourceZipUrl({ repo: entry.repo, ref: entry.branch })
			reportAddonProgress(onProgress, progressState, entry, 'downloading')
			await downloadFile(zipUrl, archivePath, { token })
			reportAddonProgress(onProgress, progressState, entry, 'extracting')
			await unzipToDirectory(archivePath, unpackPath)

			const addonDirs = await findAddonDirs(unpackPath)
			const installedFolders: string[] = []
			const skippedGitFolders: string[] = []
			reportAddonProgress(onProgress, progressState, entry, 'installing')

			for (const addonDir of addonDirs) {
				const folderName = await resolveInstallFolderName(addonDir, entry)
				if (!folderName) continue

				const targetPath = join(validation.addonsPath, folderName)
				if (hasGitFolder(targetPath)) {
					skippedGitFolders.push(folderName)
					continue
				}

				await rm(targetPath, { recursive: true, force: true })
				await mkdir(validation.addonsPath, { recursive: true })
				await cp(addonDir, targetPath, { recursive: true })
				installedFolders.push(folderName)
			}

			if (installedFolders.length === 0 && skippedGitFolders.length === 0) {
				throw new Error('В архиве не найдены папки аддона из каталога')
			}

			const addon = await summarizeAddon(entry, true)
			reportAddonProgress(onProgress, progressState, entry, 'completed', 1)
			return {
				installedAt: new Date().toISOString(),
				addon,
				installedFolders,
				skippedGitFolders
			}
		} finally {
			await rm(tempRoot, { recursive: true, force: true })
		}
	}

	async function deleteAddon(input: AddonActionInput): Promise<AddonDeleteResult> {
		const entries = await getCatalogEntries()
		const entry = entries.find((addon) => addon.id === input.addonId)
		if (!entry) throw new Error('Аддон не найден в каталоге')

		const settings = await settingsStore.get()
		const validation = validateWowPath(settings.wowPath)
		if (!validation.valid) throw new Error('Сначала укажи корректную папку WoW')

		const deletedFolders: string[] = []
		for (const folder of getAddonFolderNames(entry)) {
			const targetPath = join(validation.addonsPath, folder)
			if (!existsSync(targetPath)) continue

			await rm(targetPath, { recursive: true, force: true })
			deletedFolders.push(folder)
		}

		return {
			deletedAt: new Date().toISOString(),
			addon: await summarizeAddon(entry, false),
			deletedFolders
		}
	}

	async function updateAll(onProgress?: AddonProgressHandler): Promise<AddonsUpdateAllResult> {
		const checked = await list(true, true)
		const candidates = checked.addons.filter(
			(addon) => addon.status === 'outdated' || addon.status === 'not-installed'
		)
		const installed: AddonInstallResult[] = []
		const skipped = checked.addons.filter((addon) => addon.status === 'manual-git')
		const total = candidates.length

		if (total === 0) {
			onProgress?.({
				operation: 'update-all',
				phase: 'completed',
				completed: 0,
				total: 0,
				step: addonInstallSteps,
				steps: addonInstallSteps,
				percent: 100
			})
		}

		for (const [index, addon] of candidates.entries()) {
			const progressState = createAddonProgressState('update-all', total, index)
			try {
				installed.push(
					await install({ addonId: addon.id }, (progress) => {
						const completed =
							progress.phase === 'completed'
								? progressState.completed + 1
								: progressState.completed
						onProgress?.({
							...progress,
							operation: 'update-all',
							completed,
							total: progressState.total,
							percent: calculateAddonPercent(
								progressState.total,
								progressState.completed,
								progress.step
							)
						})
					})
				)
			} catch {
				skipped.push(addon)
				reportAddonProgress(onProgress, progressState, addon, 'completed', 1)
			}
		}

		return {
			updatedAt: new Date().toISOString(),
			total: installed.length,
			installed,
			skipped
		}
	}

	async function addCustom(input: AddCustomAddonInput): Promise<AddonsListResult> {
		const custom = await readCustomAddons()
		custom.push(createCustomAddonEntry(input, custom.length + 1))
		await writeCustomAddons(custom)
		return list(false)
	}

	async function exportCustom(filePath: string): Promise<CustomAddonsTransferResult> {
		const custom = await readCustomAddons()
		const payload = {
			version: 1,
			exportedAt: new Date().toISOString(),
			addons: custom
		}

		await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')

		return {
			filePath,
			total: custom.length,
			addons: custom
		}
	}

	async function importCustom(filePath: string): Promise<CustomAddonsTransferResult> {
		const imported = normalizeImportedCustomAddons(JSON.parse(await readFile(filePath, 'utf8')))
		const current = await readCustomAddons()
		const merged = mergeCustomAddons(current, imported)
		await writeCustomAddons(renumberCustomAddons(merged))
		const next = await readCustomAddons()

		return {
			filePath,
			total: next.length,
			addons: next
		}
	}

	async function getCatalogEntries(): Promise<AddonCatalogEntry[]> {
		return [...((addonCatalog as AddonCatalogFile).addons ?? []), ...(await readCustomAddons())]
	}

	async function filterInstalledCatalogEntries(
		entries: AddonCatalogEntry[]
	): Promise<AddonCatalogEntry[]> {
		const installedFolderNames = await readInstalledAddonFolderNames()
		if (installedFolderNames.size === 0) return []

		return entries.filter((entry) =>
			getAddonFolderNames(entry).some((folder) =>
				installedFolderNames.has(normalizeAddonName(folder))
			)
		)
	}

	async function readInstalledAddonFolderNames(): Promise<Set<string>> {
		const settings = await settingsStore.get()
		const validation = validateWowPath(settings.wowPath)
		if (!validation.valid || !existsSync(validation.addonsPath)) return new Set()

		const folders = await readdir(validation.addonsPath, { withFileTypes: true })
		return new Set(
			folders
				.filter((folder) => folder.isDirectory())
				.map((folder) => normalizeAddonName(folder.name))
		)
	}

	async function summarizeAddon(
		entry: AddonCatalogEntry,
		checkRemote: boolean
	): Promise<AddonSummary> {
		const settings = await settingsStore.get()
		const paths = settings.wowPath ? getWowPaths(settings.wowPath) : undefined
		const installedFolders: string[] = []
		const missingFolders: string[] = []
		const gitFolders: string[] = []

		for (const folder of getAddonFolderNames(entry)) {
			const targetPath = paths ? join(paths.addonsPath, folder) : ''
			if (!targetPath || !existsSync(targetPath)) {
				missingFolders.push(folder)
				continue
			}

			installedFolders.push(folder)
			if (hasGitFolder(targetPath)) gitFolders.push(folder)
		}

		let installedVersion: string | undefined
		let remoteVersion: string | undefined
		let error: string | undefined

		try {
			if (paths) {
				installedVersion = await readConfiguredInstalledAddonVersion(
					paths.addonsPath,
					entry,
					installedFolders
				)
			}
			if (checkRemote && entry.versionUrl) {
				remoteVersion = parseTocVersion(
					await fetchText(entry.versionUrl, await secretStore.get('github-token'))
				)
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Не удалось проверить аддон'
		}

		return {
			...entry,
			status: getStatus({
				installedFolders,
				missingFolders,
				gitFolders,
				installedVersion,
				remoteVersion
			}),
			installedVersion,
			remoteVersion,
			installedFolders,
			missingFolders,
			gitFolders,
			error
		}
	}

	async function readCustomAddons(): Promise<AddonCatalogEntry[]> {
		const filePath = getCustomAddonsPath()
		if (!existsSync(filePath)) return []

		return JSON.parse(await readFile(filePath, 'utf8')) as AddonCatalogEntry[]
	}

	async function writeCustomAddons(addons: AddonCatalogEntry[]): Promise<void> {
		const filePath = getCustomAddonsPath()
		await mkdir(getUserDataPath(), { recursive: true })
		await writeFile(filePath, JSON.stringify(addons, null, 2), 'utf8')
	}

	return {
		list: () => list(false),
		check: () => list(true, true),
		install,
		delete: deleteAddon,
		updateAll,
		addCustom,
		exportCustom,
		importCustom
	}
}

function getStatus(input: {
	installedFolders: string[]
	missingFolders: string[]
	gitFolders: string[]
	installedVersion?: string
	remoteVersion?: string
}): AddonStatus {
	if (input.gitFolders.length > 0) return 'manual-git'
	if (input.installedFolders.length === 0) return 'not-installed'
	if (input.missingFolders.length > 0) return 'outdated'
	if (
		input.installedVersion &&
		input.remoteVersion &&
		compareAddonVersions(input.installedVersion, input.remoteVersion) < 0
	) {
		return 'outdated'
	}
	if (!input.installedVersion || !input.remoteVersion) return 'unknown'

	return 'installed'
}

async function fetchText(url: string, token?: string): Promise<string> {
	const response = await fetch(url, {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined
	})
	if (!response.ok)
		throw new Error(`Request failed ${response.status} ${response.statusText}`.trim())

	return response.text()
}

async function findAddonDirs(rootPath: string): Promise<string[]> {
	const found: string[] = []
	await walk(rootPath, found)
	return found
}

async function walk(dirPath: string, found: string[]): Promise<void> {
	const entries = await readdir(dirPath, { withFileTypes: true })
	if (entries.some((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.toc'))) {
		found.push(resolve(dirPath))
		return
	}

	for (const entry of entries) {
		if (entry.isDirectory()) await walk(join(dirPath, entry.name), found)
	}
}

async function resolveInstallFolderName(
	addonDir: string,
	entry: AddonCatalogEntry
): Promise<string | undefined> {
	const folderName = addonDir.split(/[\\/]/).pop()
	if (!folderName) return undefined
	if (entry.folders.length === 0 || entry.folders.includes(folderName)) return folderName

	const tocFolderName = await readAddonFolderNameFromToc(addonDir)
	if (tocFolderName && entry.folders.includes(tocFolderName)) return tocFolderName
	if (entry.folders.length === 1) return entry.folders[0]

	return undefined
}

async function readAddonFolderNameFromToc(addonDir: string): Promise<string | undefined> {
	const files = await readdir(addonDir)
	const tocFile = files.find((file) => file.toLowerCase().endsWith('.toc'))
	if (!tocFile) return undefined

	return tocFile.replace(/\.toc$/i, '')
}

function countSources(
	addons: AddonSummary[]
): Pick<AddonsListResult, 'community' | 'sirus' | 'custom'> {
	return {
		community: addons.filter((addon) => addon.source === 'community').length,
		sirus: addons.filter((addon) => addon.source === 'sirus').length,
		custom: addons.filter((addon) => addon.source === 'custom').length
	}
}

const addonInstallSteps = 4

function createAddonProgressState(
	operation: AddonProgress['operation'],
	total: number,
	completed: number
) {
	return { operation, total, completed }
}

function reportAddonProgress(
	onProgress: AddonProgressHandler | undefined,
	state: ReturnType<typeof createAddonProgressState>,
	addon: Pick<AddonCatalogEntry, 'id' | 'name'>,
	phase: AddonProgress['phase'],
	completedOffset = 0
): void {
	if (!onProgress) return

	const step =
		phase === 'preparing'
			? 0
			: phase === 'downloading'
				? 1
				: phase === 'extracting'
					? 2
					: phase === 'installing'
						? 3
						: addonInstallSteps

	onProgress({
		operation: state.operation,
		phase,
		addonId: addon.id,
		addonName: addon.name,
		completed: state.completed + completedOffset,
		total: state.total,
		step,
		steps: addonInstallSteps,
		percent: calculateAddonPercent(state.total, state.completed, step)
	})
}

function calculateAddonPercent(total: number, completed: number, step: number): number {
	if (total <= 0) return 100
	const value = ((completed * addonInstallSteps + step) / (total * addonInstallSteps)) * 100
	return Math.max(0, Math.min(100, Math.round(value)))
}

function getAddonFolderNames(entry: AddonCatalogEntry): string[] {
	return entry.folders.length > 0 ? entry.folders : [entry.name]
}

function selectInstalledVersionFolder(
	entry: AddonCatalogEntry,
	installedFolders: string[]
): string | undefined {
	const normalizedName = normalizeAddonName(entry.name)
	return (
		installedFolders.find(
			(folder) => normalizeAddonName(folder) === `${normalizedName}-core`
		) ??
		installedFolders.find(
			(folder) => normalizeAddonName(folder) === `${normalizedName}_core`
		) ??
		installedFolders.find((folder) => normalizeAddonName(folder) === normalizedName) ??
		installedFolders[0]
	)
}

async function readConfiguredInstalledAddonVersion(
	addonsPath: string,
	entry: AddonCatalogEntry,
	installedFolders: string[]
): Promise<string | undefined> {
	const versionFolder =
		entry.versionFolder ?? selectInstalledVersionFolder(entry, installedFolders)
	if (!versionFolder) return undefined

	const versionFolderPath = join(addonsPath, versionFolder)
	if (!existsSync(versionFolderPath)) return undefined

	if (entry.versionFile) {
		const versionFilePath = join(versionFolderPath, entry.versionFile)
		if (existsSync(versionFilePath)) {
			return parseTocVersion(await readFile(versionFilePath, 'utf8'))
		}
	}

	return readInstalledAddonVersion(versionFolderPath)
}

function normalizeAddonName(value: string): string {
	return value.trim().toLowerCase()
}

function normalizeImportedCustomAddons(input: unknown): AddonCatalogEntry[] {
	const rawAddons = Array.isArray(input)
		? input
		: typeof input === 'object' &&
			  input !== null &&
			  Array.isArray((input as { addons?: unknown }).addons)
			? (input as { addons: unknown[] }).addons
			: []

	return rawAddons
		.map((addon, index) => normalizeImportedCustomAddon(addon, index + 1))
		.filter((addon): addon is AddonCatalogEntry => addon !== undefined)
}

function normalizeImportedCustomAddon(
	input: unknown,
	index: number
): AddonCatalogEntry | undefined {
	if (typeof input !== 'object' || input === null) return undefined
	const addon = input as Partial<AddonCatalogEntry>
	if (!addon.name || !addon.githubUrl || !addon.repo) return undefined

	return {
		id: `custom:${slugify(addon.name)}:${index}`,
		source: 'custom',
		name: addon.name,
		versionUrl: addon.versionUrl,
		versionFolder: addon.versionFolder,
		versionFile: addon.versionFile,
		branch: addon.branch || 'main',
		folders: addon.folders ?? [],
		description: addon.description,
		githubUrl: addon.githubUrl,
		repo: addon.repo,
		forumUrl: addon.forumUrl,
		bugReportUrl: addon.bugReportUrl,
		author: addon.author,
		category: addon.category
	}
}

function mergeCustomAddons(
	current: AddonCatalogEntry[],
	imported: AddonCatalogEntry[]
): AddonCatalogEntry[] {
	const merged = [...current]
	const keys = new Set(current.map(createCustomAddonKey))

	for (const addon of imported) {
		const key = createCustomAddonKey(addon)
		if (keys.has(key)) continue
		keys.add(key)
		merged.push(addon)
	}

	return merged
}

function renumberCustomAddons(addons: AddonCatalogEntry[]): AddonCatalogEntry[] {
	return addons.map((addon, index) => ({
		...addon,
		id: `custom:${slugify(addon.name)}:${index + 1}`,
		source: 'custom'
	}))
}

function createCustomAddonKey(addon: AddonCatalogEntry): string {
	return `${addon.name.toLowerCase()}|${addon.githubUrl?.toLowerCase() ?? addon.repo?.toLowerCase()}`
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9а-яё!_-]+/gi, '-')
		.replace(/^-+|-+$/g, '')
}
