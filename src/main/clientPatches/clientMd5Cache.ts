import { join, normalize, resolve } from 'node:path'
import { isRecord } from '@core/isRecord'
import type { ClientMd5Cache } from '@main/clientPatches/clientPatchService'
import { readJsonFile, writeJsonFile } from '@main/files/jsonFile'

interface ClientMd5CacheDocument {
	version: 1
	entries: Record<string, ClientMd5CacheEntry>
}

interface ClientMd5CacheEntry {
	size: number
	mtimeMs: number
	md5: string
}

export function createFileClientMd5Cache(getUserDataPath: () => string): ClientMd5Cache {
	const getCachePath = () => join(getUserDataPath(), 'cache', 'client-md5.json')
	let cachedDocument: Promise<ClientMd5CacheDocument> | undefined
	let writeQueue = Promise.resolve()
	const loadCacheDocument = () => (cachedDocument ??= readCacheDocument(getCachePath()))

	return {
		async get(key) {
			const document = await loadCacheDocument()
			const entry = document.entries[createCacheEntryKey(key.filePath)]
			if (!entry || entry.size !== key.size || entry.mtimeMs !== key.mtimeMs) {
				return undefined
			}

			return entry.md5
		},
		async set(key, md5) {
			writeQueue = writeQueue
				.catch(() => undefined)
				.then(async () => {
					const document = await loadCacheDocument()
					document.entries[createCacheEntryKey(key.filePath)] = {
						size: key.size,
						mtimeMs: key.mtimeMs,
						md5
					}
					await writeJsonFile(getCachePath(), document)
				})
			await writeQueue
		},
		async clear() {
			writeQueue = writeQueue
				.catch(() => undefined)
				.then(async () => {
					const document = createEmptyDocument()
					cachedDocument = Promise.resolve(document)
					await writeJsonFile(getCachePath(), document)
				})
			await writeQueue
		}
	}
}

async function readCacheDocument(cachePath: string): Promise<ClientMd5CacheDocument> {
	const raw = await readJsonFile(cachePath).catch(() => undefined)
	if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.entries)) {
		return createEmptyDocument()
	}

	return {
		version: 1,
		entries: raw.entries as ClientMd5CacheDocument['entries']
	}
}

function createEmptyDocument(): ClientMd5CacheDocument {
	return {
		version: 1,
		entries: {}
	}
}

function createCacheEntryKey(filePath: string): string {
	return normalize(resolve(filePath)).toLowerCase()
}
