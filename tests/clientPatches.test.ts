import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	clientPatchManifestUrls,
	createClientPatchTargetPath,
	normalizeClientPatchManifest
} from '../src/core/clientPatches/clientPatches'
import {
	createClientPatchService,
	type ClientMd5Cache,
	type FetchJson
} from '../src/main/clientPatches/clientPatchService'
import { createFileClientMd5Cache } from '../src/main/clientPatches/clientMd5Cache'
import type { SettingsStore } from '../src/main/settings/fileSettingsStore'
import type { LauncherSettings } from '../src/shared/contracts'

describe('client patches core', () => {
	it('normalizes Sirus patch manifest response', () => {
		const manifest = normalizeClientPatchManifest({
			patches: [
				{
					filename: 'realmlist.wtf',
					path: '/Data/ruRU/',
					size: 36,
					md5: '6149eaf8791547a8f87454d687a46b29',
					updated_at: '2021-07-24T05:54:29.820303',
					host: 'http://s-patches.pro/api/client/patches/file/'
				}
			]
		})

		expect(manifest).toEqual([
			{
				fileName: 'realmlist.wtf',
				relativePath: '/Data/ruRU/',
				size: 36,
				md5: '6149eaf8791547a8f87454d687a46b29',
				updatedAt: '2021-07-24T05:54:29.820303',
				downloadUrl: 'http://s-patches.pro/api/client/patches/file/'
			}
		])
	})

	it('rejects unsafe client file paths', () => {
		expect(() =>
			createClientPatchTargetPath('F:/wow', {
				fileName: '../evil.mpq',
				relativePath: '/Data/',
				size: 1,
				md5: '6149eaf8791547a8f87454d687a46b29',
				downloadUrl: 'https://example.test/file'
			})
		).toThrow('Небезопасный путь файла клиента')
	})
})

describe('client patch service', () => {
	it('checks files by size and md5 with manifest fallback', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-client-check-'))
		const wowPath = join(root, 'wow')
		await mkdir(join(wowPath, 'Data'), { recursive: true })
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })
		await writeFile(join(wowPath, 'Data', 'ok.mpq'), 'ok')
		await writeFile(join(wowPath, 'Data', 'bad.mpq'), 'bad')

		const fetchCalls: string[] = []
		const fetchJson: FetchJson = async (url) => {
			fetchCalls.push(url)
			if (fetchCalls.length === 1) throw new Error('primary failed')

			return {
				patches: [
					createManifestFile('ok.mpq', '/Data/', 'ok'),
					createManifestFile('bad.mpq', '/Data/', 'expected'),
					createManifestFile('missing.mpq', '/Data/ruRU/', 'missing')
				]
			}
		}

		const service = createClientPatchService(
			createMemorySettingsStore({ wowPath }),
			fetchJson,
			async (path) => {
				const content = path.endsWith('ok.mpq') ? 'ok' : 'bad'
				return createHash('md5').update(content).digest('hex')
			},
			async () => undefined,
			() => root
		)

		const result = await service.check()

		expect(fetchCalls).toHaveLength(2)
		expect(result.total).toBe(3)
		expect(result.ok).toBe(1)
		expect(result.outdated).toBe(1)
		expect(result.missing).toBe(1)
		expect(result.files.map((file) => file.status)).toEqual(['ok', 'outdated', 'missing'])
	})

	it('lists manifest files with target paths and downloads a selected file safely', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-client-download-'))
		const wowPath = join(root, 'wow')
		const tempRoot = join(root, 'temp')
		await mkdir(tempRoot, { recursive: true })

		const fileContent = 'patched'
		const fetchJson: FetchJson = async () => ({
			patches: [createManifestFile('patch.mpq', '/Data/', fileContent)]
		})

		const service = createClientPatchService(
			createMemorySettingsStore({ wowPath }),
			fetchJson,
			async (path) =>
				createHash('md5')
					.update(await readFile(path))
					.digest('hex'),
			async (_url, targetPath) => {
				await writeFile(targetPath, fileContent)
			},
			() => tempRoot
		)

		const manifest = await service.list()
		expect(manifest.total).toBe(1)
		expect(manifest.files[0].targetPath).toBe(join(wowPath, 'Data', 'patch.mpq'))

		const result = await service.downloadFile({
			fileName: 'patch.mpq',
			relativePath: '/Data/'
		})

		expect(result.file.status).toBe('ok')
		expect(await readFile(join(wowPath, 'Data', 'patch.mpq'), 'utf8')).toBe(fileContent)
	})

	it('uses selected manifest source without fallback', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-client-source-'))
		const wowPath = join(root, 'wow')
		const selectedSourceUrl = clientPatchManifestUrls[1]
		const fetchCalls: string[] = []

		const service = createClientPatchService(
			createMemorySettingsStore({ wowPath }),
			async (url) => {
				fetchCalls.push(url)
				return {
					patches: [createManifestFile('patch.mpq', '/Data/', 'patched')]
				}
			},
			async () => '6149eaf8791547a8f87454d687a46b29',
			async () => undefined,
			() => root
		)

		const manifest = await service.list({ sourceUrl: selectedSourceUrl })

		expect(fetchCalls).toEqual([selectedSourceUrl])
		expect(manifest.sourceUrl).toBe(selectedSourceUrl)
		expect(manifest.availableSourceUrls).toEqual([...clientPatchManifestUrls])
	})

	it('falls back from the selected manifest source to the next source', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-client-selected-fallback-'))
		const wowPath = join(root, 'wow')
		const selectedSourceUrl = clientPatchManifestUrls[1]
		const fallbackSourceUrl = clientPatchManifestUrls[2]
		const fetchCalls: string[] = []

		const service = createClientPatchService(
			createMemorySettingsStore({ wowPath }),
			async (url) => {
				fetchCalls.push(url)
				if (url === selectedSourceUrl) throw new Error('selected source failed')

				return {
					patches: [createManifestFile('patch.mpq', '/Data/', 'patched')]
				}
			},
			async () => '6149eaf8791547a8f87454d687a46b29',
			async () => undefined,
			() => root
		)

		const result = await service.check({ sourceUrl: selectedSourceUrl })

		expect(fetchCalls).toEqual([selectedSourceUrl, fallbackSourceUrl])
		expect(result.sourceUrl).toBe(fallbackSourceUrl)
		expect(result.total).toBe(1)
		expect(result.missing).toBe(1)
	})

	it('reuses cached md5 for unchanged files on repeated checks', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-client-md5-cache-'))
		const wowPath = join(root, 'wow')
		await mkdir(join(wowPath, 'Data'), { recursive: true })
		await writeFile(join(wowPath, 'Data', 'ok.mpq'), 'same')
		await writeFile(join(wowPath, 'Data', 'bad.mpq'), 'bad')

		const fetchJson: FetchJson = async () => ({
			patches: [
				createManifestFile('ok.mpq', '/Data/', 'same'),
				createManifestFile('bad.mpq', '/Data/', 'dad')
			]
		})
		const md5Cache = createMemoryMd5Cache()
		let hashCalls = 0

		const service = createClientPatchService(
			createMemorySettingsStore({ wowPath }),
			fetchJson,
			async (path) => {
				hashCalls += 1
				return createHash('md5')
					.update(await readFile(path))
					.digest('hex')
			},
			async () => undefined,
			() => root,
			md5Cache
		)

		const firstResult = await service.check()
		expect(firstResult.files.map((file) => file.status)).toEqual(['ok', 'outdated'])
		expect(hashCalls).toBe(2)

		const secondResult = await service.check()
		expect(secondResult.files.map((file) => file.status)).toEqual(['ok', 'outdated'])
		expect(hashCalls).toBe(2)

		await service.clearCheckCache()

		const thirdResult = await service.check()
		expect(thirdResult.files.map((file) => file.status)).toEqual(['ok', 'outdated'])
		expect(hashCalls).toBe(4)
	})

	it('cancels a running client check', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-client-cancel-'))
		const wowPath = join(root, 'wow')
		await mkdir(join(wowPath, 'Data'), { recursive: true })
		await writeFile(join(wowPath, 'Data', 'large.mpq'), 'same')

		let resolveHashStarted: () => void = () => undefined
		const hashStarted = new Promise<void>((resolve) => {
			resolveHashStarted = resolve
		})

		const service = createClientPatchService(
			createMemorySettingsStore({ wowPath }),
			async () => ({
				patches: [createManifestFile('large.mpq', '/Data/', 'same')]
			}),
			async (_path, options) => {
				resolveHashStarted()
				return new Promise((resolve, reject) => {
					options?.signal?.addEventListener(
						'abort',
						() => reject(new Error('Проверка клиента остановлена')),
						{ once: true }
					)
					setTimeout(() => resolve(createHash('md5').update('same').digest('hex')), 1000)
				})
			},
			async () => undefined,
			() => root
		)

		const check = service.check()
		await hashStarted
		await service.cancelCheck()

		await expect(check).rejects.toThrow('Проверка клиента остановлена')
	})

	it('persists md5 cache entries and invalidates them by size or mtime', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-client-md5-file-cache-'))
		const cache = createFileClientMd5Cache(() => root)
		const key = {
			filePath: join(root, 'wow', 'Data', 'file.mpq'),
			size: 4,
			mtimeMs: 100
		}

		await cache.set(key, '6149eaf8791547a8f87454d687a46b29')

		expect(await cache.get(key)).toBe('6149eaf8791547a8f87454d687a46b29')
		expect(await cache.get({ ...key, size: 5 })).toBeUndefined()
		expect(await cache.get({ ...key, mtimeMs: 101 })).toBeUndefined()
	})

	it('clears md5 cache entries', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-client-md5-clear-cache-'))
		const cache = createFileClientMd5Cache(() => root)
		const key = {
			filePath: join(root, 'wow', 'Data', 'file.mpq'),
			size: 4,
			mtimeMs: 100
		}

		await cache.set(key, '6149eaf8791547a8f87454d687a46b29')
		await cache.clear()

		expect(await cache.get(key)).toBeUndefined()
	})
})

function createManifestFile(filename: string, path: string, content: string) {
	return {
		filename,
		path,
		size: Buffer.byteLength(content),
		md5: createHash('md5').update(content).digest('hex'),
		host: `https://example.test/${filename}`
	}
}

function createMemorySettingsStore(patch: Partial<LauncherSettings>): SettingsStore {
	const settings: LauncherSettings = {
		wowPath: '',
		closeOnLaunch: false,
		checkClientBeforeLaunch: true,
		autoUpdateAddons: false,
		allowPrereleaseUpdates: false,
		...patch
	}

	return {
		async get() {
			return settings
		},
		async save(nextPatch) {
			Object.assign(settings, nextPatch)
			return settings
		}
	}
}

function createMemoryMd5Cache(): ClientMd5Cache {
	const entries = new Map<string, string>()

	return {
		async get(key) {
			return entries.get(createMemoryMd5CacheKey(key))
		},
		async set(key, md5) {
			entries.set(createMemoryMd5CacheKey(key), md5)
		},
		async clear() {
			entries.clear()
		}
	}
}

function createMemoryMd5CacheKey(key: { filePath: string; size: number; mtimeMs: number }): string {
	return `${key.filePath}:${key.size}:${key.mtimeMs}`
}
