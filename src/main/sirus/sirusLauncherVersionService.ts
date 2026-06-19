import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import {
	DEFAULT_SIRUS_LAUNCHER_VERSION_CACHE_TTL_MS,
	isSirusLauncherVersionCacheFresh,
	resolveSirusLauncherVersionFromRelease,
	SIRUS_OFFICIAL_LAUNCHER_RELEASES_LATEST_URL,
	type SirusOfficialLauncherRelease
} from '@core/sirus/sirusLauncherVersion'

export interface SirusLauncherVersionCacheRecord {
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
	fetchLatestRelease: (
		url: string
	) => Promise<SirusOfficialLauncherRelease> = fetchOfficialLauncherRelease
): SirusLauncherVersionService {
	let memoryCache: SirusLauncherVersionCacheRecord | null = null
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
			return await fetchAndPersist()
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
		const filePath = getCacheFilePath()
		if (!existsSync(filePath)) return null

		try {
			const raw = JSON.parse(await readFile(filePath, 'utf8')) as Partial<SirusLauncherVersionCacheRecord>
			if (typeof raw.version !== 'string' || typeof raw.fetchedAt !== 'string') return null
			return { version: raw.version, fetchedAt: raw.fetchedAt }
		} catch {
			return null
		}
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
		await writeDiskCache(record)
		return version
	}

	async function writeDiskCache(record: SirusLauncherVersionCacheRecord): Promise<void> {
		const filePath = getCacheFilePath()
		await mkdir(dirname(filePath), { recursive: true })
		const tempPath = `${filePath}.tmp`
		await writeFile(tempPath, JSON.stringify(record, null, 2), 'utf8')
		await rename(tempPath, filePath)
	}
}

async function fetchOfficialLauncherRelease(
	url: string
): Promise<SirusOfficialLauncherRelease> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 10_000)

	try {
		const response = await fetch(url, {
			headers: { accept: 'application/vnd.github+json' },
			signal: controller.signal
		})
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} for ${url}`)
		}
		return (await response.json()) as SirusOfficialLauncherRelease
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error('GitHub Releases: таймаут')
		}
		throw error
	} finally {
		clearTimeout(timeout)
	}
}
