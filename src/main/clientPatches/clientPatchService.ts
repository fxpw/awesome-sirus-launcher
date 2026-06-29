import { copyFile, mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
	ClientCheckResult,
	ClientPatchDownloadAllResult,
	ClientPatchDownloadResult,
	ClientPatchFileInput,
	ClientPatchManifestFile,
	ClientPatchManifestResult,
	ClientPatchSourceInput
} from '@shared/contracts'
import type { SettingsStore } from '@main/settings/fileSettingsStore'
import {
	type ClientPatchManifestFile as CoreClientPatchManifestFile,
	clientPatchManifestUrls,
	createClientPatchTargetPath,
	isExpectedMd5,
	normalizeClientPatchManifest
} from '../../core/clientPatches/clientPatches'

export type FetchJson = (url: string, options?: { signal?: AbortSignal }) => Promise<unknown>
export type HashFile = (filePath: string, options?: { signal?: AbortSignal }) => Promise<string>
export type DownloadFile = (url: string, targetPath: string) => Promise<void>

export interface ClientMd5CacheKey {
	filePath: string
	size: number
	mtimeMs: number
}

export interface ClientMd5Cache {
	get(key: ClientMd5CacheKey): Promise<string | undefined>
	set(key: ClientMd5CacheKey, md5: string): Promise<void>
	clear(): Promise<void>
}

export const emptyClientMd5Cache: ClientMd5Cache = {
	async get() {
		return undefined
	},
	async set() {
		return undefined
	},
	async clear() {
		return undefined
	}
}

export interface ClientPatchService {
	list(input?: ClientPatchSourceInput): Promise<ClientPatchManifestResult>
	check(input?: ClientPatchSourceInput): Promise<ClientCheckResult>
	cancelCheck(): Promise<void>
	clearCheckCache(): Promise<void>
	downloadFile(input: ClientPatchFileInput): Promise<ClientPatchDownloadResult>
	downloadMissing(input?: ClientPatchSourceInput): Promise<ClientPatchDownloadAllResult>
}

export function createClientPatchService(
	settingsStore: SettingsStore,
	fetchJson: FetchJson,
	hashFile: HashFile,
	downloadFile: DownloadFile,
	getTempRoot: () => string,
	md5Cache: ClientMd5Cache = emptyClientMd5Cache
): ClientPatchService {
	let activeCheckController: AbortController | undefined

	function createCheckController(): AbortController {
		if (activeCheckController && !activeCheckController.signal.aborted) {
			throw new Error('Проверка клиента уже выполняется')
		}

		activeCheckController = new AbortController()
		return activeCheckController
	}

	return {
		async list(input) {
			const settings = await getSettingsWithWowPath(settingsStore)
			const manifest = await fetchManifest(fetchJson, input?.sourceUrl)
			const files = manifest.patches.map((patch) => toManifestFile(settings.wowPath, patch))

			return {
				loadedAt: new Date().toISOString(),
				sourceUrl: manifest.sourceUrl,
				availableSourceUrls: [...clientPatchManifestUrls],
				total: files.length,
				files
			}
		},
		async check(input) {
			const checkController = createCheckController()
			const { signal } = checkController

			try {
				const settings = await getSettingsWithWowPath(settingsStore)
				throwIfClientCheckCancelled(signal)
				const manifest = await fetchManifest(fetchJson, input?.sourceUrl, signal)
				throwIfClientCheckCancelled(signal)
				const files = await Promise.all(
					manifest.patches.map((patch) =>
						checkPatchFile(settings.wowPath, patch, hashFile, md5Cache, signal)
					)
				)
				throwIfClientCheckCancelled(signal)

				return {
					checkedAt: new Date().toISOString(),
					sourceUrl: manifest.sourceUrl,
					availableSourceUrls: [...clientPatchManifestUrls],
					total: files.length,
					...countPatchStatuses(files),
					files
				}
			} finally {
				if (activeCheckController === checkController) activeCheckController = undefined
			}
		},
		async cancelCheck() {
			activeCheckController?.abort()
		},
		async clearCheckCache() {
			await md5Cache.clear()
		},
		async downloadFile(input) {
			const settings = await getSettingsWithWowPath(settingsStore)
			const manifest = await fetchManifest(fetchJson, input.sourceUrl)
			const patch = findManifestPatch(manifest.patches, input)
			const file = await downloadAndVerifyPatch(
				settings.wowPath,
				patch,
				downloadFile,
				hashFile,
				getTempRoot,
				md5Cache
			)

			return {
				downloadedAt: new Date().toISOString(),
				file
			}
		},
		async downloadMissing(input) {
			const settings = await getSettingsWithWowPath(settingsStore)
			const manifest = await fetchManifest(fetchJson, input?.sourceUrl)
			const checkedFiles = await Promise.all(
				manifest.patches.map((patch) =>
					checkPatchFile(settings.wowPath, patch, hashFile, md5Cache)
				)
			)
			const patchesByKey = new Map(
				manifest.patches.map((patch) => [
					createPatchKey(patch.relativePath, patch.fileName),
					patch
				])
			)
			const patchesToDownload = checkedFiles
				.filter((file) => file.status !== 'ok')
				.map((file) => patchesByKey.get(createPatchKey(file.relativePath, file.fileName)))
				.filter((patch): patch is CoreClientPatchManifestFile => Boolean(patch))
			const files = []

			for (const patch of patchesToDownload) {
				files.push(
					await downloadAndVerifyPatch(
						settings.wowPath,
						patch,
						downloadFile,
						hashFile,
						getTempRoot,
						md5Cache
					)
				)
			}

			return {
				downloadedAt: new Date().toISOString(),
				total: files.length,
				files
			}
		}
	}
}

async function getSettingsWithWowPath(settingsStore: SettingsStore) {
	const settings = await settingsStore.get()
	if (!settings.wowPath) throw new Error('Сначала выберите папку WoW')

	return settings
}

function toManifestFile(
	wowPath: string,
	patch: CoreClientPatchManifestFile
): ClientPatchManifestFile {
	return {
		fileName: patch.fileName,
		relativePath: patch.relativePath,
		targetPath: createClientPatchTargetPath(wowPath, patch),
		expectedMd5: patch.md5,
		expectedSize: patch.size,
		downloadUrl: patch.downloadUrl,
		updatedAt: patch.updatedAt
	}
}

async function checkPatchFile(
	wowPath: string,
	patch: CoreClientPatchManifestFile,
	hashFile: HashFile,
	md5Cache: ClientMd5Cache,
	signal?: AbortSignal
): Promise<ClientCheckResult['files'][number]> {
	throwIfClientCheckCancelled(signal)
	const targetPath = createClientPatchTargetPath(wowPath, patch)

	try {
		const fileStat = await stat(targetPath)
		throwIfClientCheckCancelled(signal)
		const actualSize = fileStat.size
		if (!fileStat.isFile() || actualSize !== patch.size) {
			return {
				fileName: patch.fileName,
				relativePath: patch.relativePath,
				targetPath,
				expectedMd5: patch.md5,
				expectedSize: patch.size,
				actualSize,
				downloadUrl: patch.downloadUrl,
				status: 'outdated'
			}
		}

		const actualMd5 = await getCachedOrCalculateMd5(
			targetPath,
			fileStat,
			hashFile,
			md5Cache,
			signal
		)
		throwIfClientCheckCancelled(signal)

		return {
			fileName: patch.fileName,
			relativePath: patch.relativePath,
			targetPath,
			expectedMd5: patch.md5,
			actualMd5,
			expectedSize: patch.size,
			actualSize,
			downloadUrl: patch.downloadUrl,
			status: isExpectedMd5(actualMd5, patch.md5) ? 'ok' : 'outdated'
		}
	} catch {
		throwIfClientCheckCancelled(signal)
		return {
			fileName: patch.fileName,
			relativePath: patch.relativePath,
			targetPath,
			expectedMd5: patch.md5,
			expectedSize: patch.size,
			downloadUrl: patch.downloadUrl,
			status: 'missing'
		}
	}
}

async function downloadAndVerifyPatch(
	wowPath: string,
	patch: CoreClientPatchManifestFile,
	downloadFile: DownloadFile,
	hashFile: HashFile,
	getTempRoot: () => string,
	md5Cache: ClientMd5Cache
): Promise<ClientCheckResult['files'][number]> {
	const targetPath = createClientPatchTargetPath(wowPath, patch)
	const tempDir = await mkdtemp(join(getTempRoot(), 'client-patch-'))
	const tempPath = join(tempDir, 'download.tmp')

	try {
		await mkdir(dirname(targetPath), { recursive: true })
		await downloadFile(patch.downloadUrl, tempPath)

		const fileStat = await stat(tempPath)
		if (!fileStat.isFile() || fileStat.size !== patch.size) {
			throw new Error(`Размер скачанного файла не совпадает: ${patch.fileName}`)
		}

		const actualMd5 = await hashFile(tempPath)
		if (!isExpectedMd5(actualMd5, patch.md5)) {
			throw new Error(`MD5 скачанного файла не совпадает: ${patch.fileName}`)
		}

		await rm(targetPath, { force: true })
		await moveDownloadedFile(tempPath, targetPath)
		const targetStat = await stat(targetPath)
		await md5Cache.set(createMd5CacheKey(targetPath, targetStat), actualMd5)

		return {
			fileName: patch.fileName,
			relativePath: patch.relativePath,
			targetPath,
			expectedMd5: patch.md5,
			actualMd5,
			expectedSize: patch.size,
			actualSize: targetStat.size,
			downloadUrl: patch.downloadUrl,
			status: 'ok'
		}
	} finally {
		await rm(tempDir, { recursive: true, force: true })
	}
}

async function getCachedOrCalculateMd5(
	filePath: string,
	fileStat: Stats,
	hashFile: HashFile,
	md5Cache: ClientMd5Cache,
	signal?: AbortSignal
): Promise<string> {
	throwIfClientCheckCancelled(signal)
	const cacheKey = createMd5CacheKey(filePath, fileStat)
	const cachedMd5 = await md5Cache.get(cacheKey)
	if (cachedMd5) return cachedMd5

	const actualMd5 = await hashFile(filePath, { signal })
	throwIfClientCheckCancelled(signal)
	await md5Cache.set(cacheKey, actualMd5)

	return actualMd5
}

function createMd5CacheKey(filePath: string, fileStat: Stats): ClientMd5CacheKey {
	return {
		filePath,
		size: fileStat.size,
		mtimeMs: fileStat.mtimeMs
	}
}

async function moveDownloadedFile(sourcePath: string, targetPath: string): Promise<void> {
	try {
		await rename(sourcePath, targetPath)
	} catch (error) {
		if (!isCrossDeviceRenameError(error)) throw error

		await copyFile(sourcePath, targetPath)
		await rm(sourcePath, { force: true })
	}
}

function isCrossDeviceRenameError(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as NodeJS.ErrnoException).code === 'EXDEV'
	)
}

function findManifestPatch(
	patches: CoreClientPatchManifestFile[],
	input: ClientPatchFileInput
): CoreClientPatchManifestFile {
	const patch = patches.find(
		(item) => item.fileName === input.fileName && item.relativePath === input.relativePath
	)
	if (!patch) throw new Error('Файл не найден в manifest клиента')

	return patch
}

function countPatchStatuses(files: ClientCheckResult['files']) {
	return {
		ok: files.filter((file) => file.status === 'ok').length,
		missing: files.filter((file) => file.status === 'missing').length,
		outdated: files.filter((file) => file.status === 'outdated').length
	}
}

function createPatchKey(relativePath: string, fileName: string): string {
	return `${relativePath}\0${fileName}`
}

async function fetchManifest(fetchJson: FetchJson, sourceUrl?: string, signal?: AbortSignal) {
	if (sourceUrl && !isKnownManifestSource(sourceUrl)) {
		throw new Error('Неизвестный источник manifest клиента')
	}

	return fetchManifestWithFallback(fetchJson, signal, sourceUrl)
}

async function fetchManifestWithFallback(
	fetchJson: FetchJson,
	signal?: AbortSignal,
	startSourceUrl?: string
) {
	const errors: string[] = []

	for (const sourceUrl of createManifestSourceOrder(startSourceUrl)) {
		throwIfClientCheckCancelled(signal)
		try {
			const raw = await fetchJson(sourceUrl, { signal })
			throwIfClientCheckCancelled(signal)
			return {
				sourceUrl,
				patches: normalizeClientPatchManifest(raw)
			}
		} catch (error) {
			throwIfClientCheckCancelled(signal)
			errors.push(error instanceof Error ? error.message : String(error))
		}
	}

	throw new Error(`Не удалось получить manifest клиента: ${errors.join('; ')}`)
}

function createManifestSourceOrder(startSourceUrl?: string): string[] {
	if (!startSourceUrl) return [...clientPatchManifestUrls]

	const startIndex = clientPatchManifestUrls.indexOf(
		startSourceUrl as (typeof clientPatchManifestUrls)[number]
	)
	if (startIndex === -1) return [...clientPatchManifestUrls]

	return [
		...clientPatchManifestUrls.slice(startIndex),
		...clientPatchManifestUrls.slice(0, startIndex)
	]
}

function isKnownManifestSource(sourceUrl: string): boolean {
	return clientPatchManifestUrls.includes(sourceUrl as (typeof clientPatchManifestUrls)[number])
}

function throwIfClientCheckCancelled(signal?: AbortSignal): void {
	if (signal?.aborted) throw new Error('Проверка клиента остановлена')
}
