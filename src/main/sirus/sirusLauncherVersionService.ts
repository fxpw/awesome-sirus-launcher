import { join } from 'node:path'
import { isRecord } from '@core/isRecord'
import {
	isSirusLauncherVersionCacheFresh,
	resolveSirusLauncherVersionFromRelease,
	SIRUS_OFFICIAL_LAUNCHER_RELEASES_LATEST_URL,
	type SirusOfficialLauncherRelease
} from '@core/sirus/sirusLauncherVersion'
import { readJsonFile, writeJsonFile } from '@main/files/jsonFile'

interface SirusLauncherVersionCacheRecord {
	version: string
	fetchedAt: string
}

export interface SirusLauncherVersionService {
	getVersion(): Promise<string>
	refresh(): Promise<string>
}

export function createSirusLauncherVersionService(
	getUserDataPath: () => string,
	fallbackVersion: string,
	fetchLatestRelease: (url: string) => Promise<SirusOfficialLauncherRelease>
): SirusLauncherVersionService {
	let memoryCache: SirusLauncherVersionCacheRecord | null = null
	let pendingFetch: Promise<string> | null = null
	const getCacheFilePath = () => join(getUserDataPath(), 'sirus-launcher-version.json')

	return {
		getVersion: () => resolveVersion(false),
		refresh: () => resolveVersion(true)
	}

	async function resolveVersion(forceRefresh: boolean): Promise<string> {
		if (!forceRefresh) {
			const cached = await readFreshCache()
			if (cached) return cached.version
		}

		try {
			pendingFetch ??= fetchAndPersist().finally(() => {
				pendingFetch = null
			})
			return await pendingFetch
		} catch (error) {
			const stale = await readAnyCache()
			if (stale) {
				console.warn(
					'[sirus] не удалось обновить версию лаунчера из GitHub Releases, используется кэш:',
					error instanceof Error ? error.message : String(error)
				)
				memoryCache = stale
				return stale.version
			}

			console.warn(
				'[sirus] не удалось получить версию лаунчера Sirus, используется fallback:',
				error instanceof Error ? error.message : String(error)
			)
			return fallbackVersion
		}
	}

	async function readFreshCache(): Promise<SirusLauncherVersionCacheRecord | null> {
		const cached = memoryCache ?? (await readDiskCache())
		if (!cached) return null
		const fetchedAtMs = Date.parse(cached.fetchedAt)
		if (!Number.isFinite(fetchedAtMs)) return null
		if (!isSirusLauncherVersionCacheFresh(fetchedAtMs, Date.now())) return null
		memoryCache = cached
		return cached
	}

	async function readAnyCache(): Promise<SirusLauncherVersionCacheRecord | null> {
		const cached = memoryCache ?? (await readDiskCache())
		if (!cached?.version) return null
		memoryCache = cached
		return cached
	}

	async function readDiskCache(): Promise<SirusLauncherVersionCacheRecord | null> {
		const raw = await readJsonFile(getCacheFilePath()).catch(() => undefined)
		if (
			!isRecord(raw) ||
			typeof raw.version !== 'string' ||
			typeof raw.fetchedAt !== 'string'
		) {
			return null
		}
		return { version: raw.version, fetchedAt: raw.fetchedAt }
	}

	async function fetchAndPersist(): Promise<string> {
		const release = await fetchLatestRelease(SIRUS_OFFICIAL_LAUNCHER_RELEASES_LATEST_URL)
		const version = resolveSirusLauncherVersionFromRelease(release)
		if (!version) {
			throw new Error('GitHub Releases: пустой tag_name')
		}

		const record: SirusLauncherVersionCacheRecord = {
			version,
			fetchedAt: new Date().toISOString()
		}
		memoryCache = record
		await writeJsonFile(getCacheFilePath(), record)
		return version
	}
}
