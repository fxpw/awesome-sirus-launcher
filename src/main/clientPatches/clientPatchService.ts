import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
	ClientCheckResult,
	ClientCheckProgress,
	ClientPatchDownloadAllResult,
	ClientPatchDownloadResult,
	ClientPatchFileInput,
	ClientPatchManifestFile,
	ClientPatchManifestResult,
	ClientPatchSourceInput
} from '@shared/contracts'
import { clientPatchSourceUrls } from '@shared/contracts'
import {
	type ClientPatchManifestFile as CoreClientPatchManifestFile,
	createClientPatchTargetPath,
	isExpectedMd5,
	normalizeClientPatchManifest
} from '@core/clientPatches/clientPatches'
import { moveFile } from '@main/files/moveFile'
import type { SettingsStore } from '@main/settings/fileSettingsStore'

export type FetchJson = (url: string, options?: { signal?: AbortSignal }) => Promise<unknown>
export type HashFile = (filePath: string, options?: { signal?: AbortSignal }) => Promise<string>
export type DownloadFile = (url: string, targetPath: string) => Promise<void>
type ClientCheckProgressHandler = (progress: ClientCheckProgress) => void

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

const emptyClientMd5Cache: ClientMd5Cache = {
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
	check(
		input?: ClientPatchSourceInput,
		onProgress?: ClientCheckProgressHandler
	): Promise<ClientCheckResult>
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
				availableSourceUrls: [...clientPatchSourceUrls],
				total: files.length,
				files
			}
		},
		async check(input, onProgress) {
			const checkController = createCheckController()
			const { signal } = checkController

			try {
				const settings = await getSettingsWithWowPath(settingsStore)
				throwIfClientCheckCancelled(signal)
				const manifest = await fetchManifest(fetchJson, input?.sourceUrl, signal)
				throwIfClientCheckCancelled(signal)
				const files: ClientCheckResult['files'] = []
				onProgress?.({
					phase: 'checking',
					current: 0,
					total: manifest.patches.length,
					percent: 0,
					sourceUrl: manifest.sourceUrl
				})

				for (const [index, patch] of manifest.patches.entries()) {
					files.push(
						await checkPatchFile(settings.wowPath, patch, hashFile, md5Cache, signal)
					)
					onProgress?.({
						phase: 'checking',
						current: index + 1,
						total: manifest.patches.length,
						percent: calculateClientCheckPercent(index + 1, manifest.patches.length),
						fileName: patch.fileName,
						relativePath: patch.relativePath,
						sourceUrl: manifest.sourceUrl
					})
				}
				throwIfClientCheckCancelled(signal)

				const result = {
					checkedAt: new Date().toISOString(),
					sourceUrl: manifest.sourceUrl,
					availableSourceUrls: [...clientPatchSourceUrls],
					total: files.length,
					...countPatchStatuses(files),
					files
				}
				onProgress?.({
					phase: 'completed',
					current: files.length,
					total: files.length,
					percent: 100,
					sourceUrl: manifest.sourceUrl
				})
				return result
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
			const patchesToDownload: CoreClientPatchManifestFile[] = []
			for (const patch of manifest.patches) {
				const checked = await checkPatchFile(settings.wowPath, patch, hashFile, md5Cache)
				if (checked.status !== 'ok') patchesToDownload.push(patch)
			}
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

		await moveFile(tempPath, targetPath)
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

function calculateClientCheckPercent(current: number, total: number): number {
	if (total <= 0) return 100
	return Math.max(0, Math.min(100, Math.round((current / total) * 100)))
}

function createMd5CacheKey(filePath: string, fileStat: Stats): ClientMd5CacheKey {
	return {
		filePath,
		size: fileStat.size,
		mtimeMs: fileStat.mtimeMs
	}
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
	if (!startSourceUrl) return [...clientPatchSourceUrls]

	const startIndex = clientPatchSourceUrls.indexOf(
		startSourceUrl as (typeof clientPatchSourceUrls)[number]
	)
	if (startIndex === -1) return [...clientPatchSourceUrls]

	return [
		...clientPatchSourceUrls.slice(startIndex),
		...clientPatchSourceUrls.slice(0, startIndex)
	]
}

function isKnownManifestSource(sourceUrl: string): boolean {
	return clientPatchSourceUrls.includes(sourceUrl as (typeof clientPatchSourceUrls)[number])
}

function throwIfClientCheckCancelled(signal?: AbortSignal): void {
	if (signal?.aborted) throw new Error('Проверка клиента остановлена')
}
