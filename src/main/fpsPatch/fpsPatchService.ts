import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
	FpsPatchDeleteResult,
	FpsPatchFreshness,
	FpsPatchInstallResult,
	FpsPatchStatus
} from '@shared/contracts'
import {
	createFpsPatchInstallPlan,
	fpsPatchMetadataUrls,
	fpsPatchSourceUrls
} from '../../core/fpsPatch/fpsPatch'
import type { SettingsStore } from '@main/settings/fileSettingsStore'

export type DownloadFile = (url: string, targetPath: string) => Promise<void>
export type HashFile = (filePath: string) => Promise<string>
export type FetchFpsPatchMetadata = (url: string) => Promise<FpsPatchRemoteMetadata>

export interface FpsPatchRemoteMetadata {
	sourceUrl: string
	build?: number
	hash?: string
	size?: number
	updatedAt?: string
}

export interface FpsPatchFileSystem {
	copyFile(sourcePath: string, targetPath: string): Promise<void>
	mkdir(path: string, options: { recursive: true }): Promise<unknown>
	rename(sourcePath: string, targetPath: string): Promise<void>
	rm(path: string, options: { force?: boolean; recursive?: boolean }): Promise<void>
	stat(path: string): Promise<Stats>
}

const defaultFileSystem: FpsPatchFileSystem = {
	copyFile,
	mkdir,
	rename,
	rm,
	stat
}

const defaultFetchFpsPatchMetadata: FetchFpsPatchMetadata = async (url) => {
	if (url.endsWith('/patchfx')) {
		return fetchPatchFxMetadata(url)
	}

	const response = await fetch(url, { method: 'HEAD' })
	if (!response.ok) {
		throw new Error(`Request failed ${response.status} ${response.statusText}`.trim())
	}

	const contentLength = response.headers.get('content-length')
	const lastModified = response.headers.get('last-modified')

	return {
		sourceUrl: url,
		size: contentLength ? Number.parseInt(contentLength, 10) || undefined : undefined,
		updatedAt: lastModified ? new Date(lastModified).toISOString() : undefined
	}
}

async function fetchPatchFxMetadata(url: string): Promise<FpsPatchRemoteMetadata> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Request failed ${response.status} ${response.statusText}`.trim())
	}

	const body = (await response.json()) as unknown
	if (!body || typeof body !== 'object') throw new Error('Некорректный manifest FPS-патча')

	const build = (body as { build?: unknown }).build
	const hash = (body as { hash?: unknown }).hash
	if (typeof build !== 'number' || !Number.isFinite(build)) {
		throw new Error('Некорректная версия FPS-патча')
	}
	if (typeof hash !== 'string' || !/^[a-f0-9]{32}$/i.test(hash)) {
		throw new Error('Некорректный хеш FPS-патча')
	}

	return {
		sourceUrl: url,
		build,
		hash: hash.toLowerCase()
	}
}

export interface FpsPatchService {
	getStatus(): Promise<FpsPatchStatus>
	install(): Promise<FpsPatchInstallResult>
	delete(): Promise<FpsPatchDeleteResult>
}

export function createFpsPatchService(
	getUserDataPath: () => string,
	settingsStore: SettingsStore,
	downloadFile: DownloadFile,
	fileSystem: FpsPatchFileSystem = defaultFileSystem,
	fetchMetadata: FetchFpsPatchMetadata = defaultFetchFpsPatchMetadata,
	hashFile?: HashFile
): FpsPatchService {
	const getTempDir = () => join(getUserDataPath(), 'downloads', 'fps-patch')

	return {
		async getStatus() {
			const settings = await settingsStore.get()
			if (!settings.wowPath) return createMissingStatus('')

			const plan = createFpsPatchInstallPlan(settings.wowPath, getTempDir())
			return readFpsPatchStatus(plan.targetPath, fileSystem, fetchMetadata, hashFile)
		},
		async install() {
			const settings = await settingsStore.get()
			if (!settings.wowPath) throw new Error('Сначала выберите папку WoW')

			const plan = createFpsPatchInstallPlan(settings.wowPath, getTempDir())
			await fileSystem.mkdir(dirname(plan.targetPath), { recursive: true })
			await fileSystem.mkdir(dirname(plan.tempPath), { recursive: true })
			await fileSystem.rm(plan.tempPath, { force: true })

			const sourceUrl = await downloadWithFallback(
				plan.sourceUrls,
				plan.tempPath,
				downloadFile,
				fileSystem
			)
			await fileSystem.rm(plan.targetPath, { force: true })
			await moveDownloadedFile(plan.tempPath, plan.targetPath, fileSystem)

			return {
				status: await readFpsPatchStatus(
					plan.targetPath,
					fileSystem,
					fetchMetadata,
					hashFile
				),
				sourceUrl
			}
		},
		async delete() {
			const settings = await settingsStore.get()
			if (!settings.wowPath) throw new Error('Сначала выберите папку WoW')

			const plan = createFpsPatchInstallPlan(settings.wowPath, getTempDir())
			await fileSystem.rm(plan.targetPath, { force: true })

			return {
				status: await readFpsPatchStatus(
					plan.targetPath,
					fileSystem,
					fetchMetadata,
					hashFile
				),
				deleted: true
			}
		}
	}
}

async function moveDownloadedFile(
	sourcePath: string,
	targetPath: string,
	fileSystem: FpsPatchFileSystem
): Promise<void> {
	try {
		await fileSystem.rename(sourcePath, targetPath)
	} catch (error) {
		if (!isCrossDeviceRenameError(error)) throw error

		await fileSystem.copyFile(sourcePath, targetPath)
		await fileSystem.rm(sourcePath, { force: true })
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

async function readFpsPatchStatus(
	patchPath: string,
	fileSystem: FpsPatchFileSystem,
	fetchMetadata: FetchFpsPatchMetadata,
	hashFile?: HashFile
): Promise<FpsPatchStatus> {
	const remote = await readRemoteMetadata(fetchMetadata)
	try {
		const patchStat = await fileSystem.stat(patchPath)
		const installed = patchStat.isFile()
		const localHash =
			installed && remote.metadata?.hash && hashFile ? await hashFile(patchPath) : undefined
		const freshness = installed
			? compareFpsPatchFreshness(patchStat, remote.metadata, localHash)
			: 'missing'

		return {
			installed,
			patchPath,
			size: patchStat.size,
			updatedAt: patchStat.mtime.toISOString(),
			freshness,
			localHash,
			remoteBuild: remote.metadata?.build,
			remoteHash: remote.metadata?.hash,
			remoteSize: remote.metadata?.size,
			remoteUpdatedAt: remote.metadata?.updatedAt,
			remoteSourceUrl: remote.metadata?.sourceUrl,
			checkError: remote.error,
			sourceUrls: [...fpsPatchSourceUrls]
		}
	} catch {
		return createMissingStatus(patchPath, remote.metadata, remote.error)
	}
}

async function readRemoteMetadata(
	fetchMetadata: FetchFpsPatchMetadata
): Promise<{ metadata?: FpsPatchRemoteMetadata; error?: string }> {
	const errors: string[] = []

	for (const sourceUrl of fpsPatchMetadataUrls) {
		try {
			return { metadata: await fetchMetadata(sourceUrl) }
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error))
		}
	}

	return {
		error: errors.join('; ')
	}
}

function compareFpsPatchFreshness(
	patchStat: Stats,
	remote?: FpsPatchRemoteMetadata,
	localHash?: string
): FpsPatchFreshness {
	if (!remote) return 'unknown'
	if (remote.hash && localHash)
		return remote.hash === localHash.toLowerCase() ? 'latest' : 'outdated'
	if (remote.hash && !localHash) return 'unknown'
	if (typeof remote.size === 'number' && remote.size !== patchStat.size) return 'outdated'
	if (
		remote.updatedAt &&
		new Date(remote.updatedAt).getTime() > patchStat.mtime.getTime() + 1000
	) {
		return 'outdated'
	}
	if (typeof remote.size === 'number' || remote.updatedAt) return 'latest'
	return 'unknown'
}

function createMissingStatus(
	patchPath: string,
	remote?: FpsPatchRemoteMetadata,
	checkError?: string
): FpsPatchStatus {
	return {
		installed: false,
		patchPath,
		freshness: 'missing',
		remoteBuild: remote?.build,
		remoteHash: remote?.hash,
		remoteSize: remote?.size,
		remoteUpdatedAt: remote?.updatedAt,
		remoteSourceUrl: remote?.sourceUrl,
		checkError,
		sourceUrls: [...fpsPatchSourceUrls]
	}
}

async function downloadWithFallback(
	sourceUrls: string[],
	tempPath: string,
	downloadFile: DownloadFile,
	fileSystem: FpsPatchFileSystem
): Promise<string> {
	const errors: string[] = []

	for (const sourceUrl of sourceUrls) {
		try {
			await downloadFile(sourceUrl, tempPath)
			return sourceUrl
		} catch (error) {
			await fileSystem.rm(tempPath, { force: true })
			errors.push(error instanceof Error ? error.message : String(error))
		}
	}

	throw new Error(`Не удалось скачать FPS-патч: ${errors.join('; ')}`)
}
