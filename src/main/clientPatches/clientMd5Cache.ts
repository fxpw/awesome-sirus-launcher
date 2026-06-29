import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve } from 'node:path'
import type { ClientMd5Cache, ClientMd5CacheKey } from '@main/clientPatches/clientPatchService'

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
	let cachedDocument: ClientMd5CacheDocument | undefined
	let writeQueue = Promise.resolve()

	return {
		async get(key) {
			const document = await loadCacheDocument(
				getCachePath,
				() => cachedDocument,
				(next) => {
					cachedDocument = next
				}
			)
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
					const cachePath = getCachePath()
					const document = await loadCacheDocument(
						getCachePath,
						() => cachedDocument,
						(next) => {
							cachedDocument = next
						}
					)
					document.entries[createCacheEntryKey(key.filePath)] = {
						size: key.size,
						mtimeMs: key.mtimeMs,
						md5
					}
					await writeCacheDocument(cachePath, document)
				})
			await writeQueue
		},
		async clear() {
			writeQueue = writeQueue
				.catch(() => undefined)
				.then(async () => {
					const cachePath = getCachePath()
					const document = createEmptyDocument()
					cachedDocument = document
					await writeCacheDocument(cachePath, document)
				})
			await writeQueue
		}
	}
}

async function loadCacheDocument(
	getCachePath: () => string,
	getCachedDocument: () => ClientMd5CacheDocument | undefined,
	setCachedDocument: (document: ClientMd5CacheDocument) => void
): Promise<ClientMd5CacheDocument> {
	const cachedDocument = getCachedDocument()
	if (cachedDocument) return cachedDocument

	const document = await readCacheDocument(getCachePath())
	setCachedDocument(document)

	return document
}

async function readCacheDocument(cachePath: string): Promise<ClientMd5CacheDocument> {
	try {
		const raw = JSON.parse(await readFile(cachePath, 'utf8')) as Partial<ClientMd5CacheDocument>
		if (raw.version !== 1 || !raw.entries || typeof raw.entries !== 'object') {
			return createEmptyDocument()
		}

		return {
			version: 1,
			entries: raw.entries
		}
	} catch {
		return createEmptyDocument()
	}
}

async function writeCacheDocument(
	cachePath: string,
	document: ClientMd5CacheDocument
): Promise<void> {
	await mkdir(dirname(cachePath), { recursive: true })
	const tempPath = `${cachePath}.tmp`
	await writeFile(tempPath, `${JSON.stringify(document)}\n`, 'utf8')
	await rename(tempPath, cachePath)
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
