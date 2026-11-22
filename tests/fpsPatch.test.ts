import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	createFpsPatchInstallPlan,
	fpsPatchFileName,
	fpsPatchMetadataUrls,
	fpsPatchSourceUrls,
	orderFpsPatchSourceUrls
} from '../src/core/fpsPatch/fpsPatch'
import {
	createFpsPatchService,
	type DownloadFile,
	type FetchFpsPatchMetadata,
	type FpsPatchFileSystem
} from '../src/main/fpsPatch/fpsPatchService'
import type { SettingsStore } from '../src/main/settings/fileSettingsStore'
import type { LauncherSettings } from '../src/shared/contracts'

describe('fps patch core', () => {
	it('creates install plan for WoW locale data directory', () => {
		const plan = createFpsPatchInstallPlan(
			'F:/games/sirus/World of Warcraft Sirus',
			'C:/launcher/downloads/fps-patch'
		)

		expect(plan.targetPath).toMatch(
			/World of Warcraft Sirus[\\/]Data[\\/]ruRU[\\/]patch-ruRU-\[\.mpq$/
		)
		expect(plan.tempPath).toMatch(/patch-ruRU-\[\.mpq\.tmp$/)
		expect(plan.sourceUrls).toEqual([...fpsPatchSourceUrls])
	})

	it('tries the https source first without a manifest hash and the http mirror first with it', () => {
		const [httpsUrl, httpUrl] = fpsPatchSourceUrls
		expect(httpsUrl).toMatch(/^https:/)
		expect(httpUrl).toMatch(/^http:/)

		expect(orderFpsPatchSourceUrls()).toEqual([httpsUrl, httpUrl])
		expect(orderFpsPatchSourceUrls('')).toEqual([httpsUrl, httpUrl])
		expect(orderFpsPatchSourceUrls('f4fa11955f13c49d8e7a515813b9f156')).toEqual([
			httpUrl,
			httpsUrl
		])
		expect(
			createFpsPatchInstallPlan('F:/wow', 'C:/temp', 'f4fa11955f13c49d8e7a515813b9f156')
				.sourceUrls
		).toEqual([httpUrl, httpsUrl])
		expect(fpsPatchSourceUrls).toEqual([httpsUrl, httpUrl])
	})
})

describe('fps patch service', () => {
	it('downloads through fallback and installs patch atomically', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })

		const triedUrls: string[] = []
		const downloadFile: DownloadFile = async (url, targetPath) => {
			triedUrls.push(url)
			if (triedUrls.length === 1) throw new Error('primary failed')
			await writeFile(targetPath, mpqContent(`downloaded from ${url}`))
		}

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			downloadFile,
			undefined,
			createMetadataFetcher({
				size: mpqContent(`downloaded from ${fpsPatchSourceUrls[1]}`).length
			})
		)

		const result = await service.install()
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)

		expect(triedUrls).toEqual([...fpsPatchSourceUrls])
		await expect(readFile(targetPath, 'utf8')).resolves.toBe(
			mpqContent(`downloaded from ${fpsPatchSourceUrls[1]}`)
		)
		expect(result.sourceUrl).toBe(fpsPatchSourceUrls[1])
		expect(result.status.installed).toBe(true)
		expect(result.status.freshness).toBe('latest')
		expect(result.status.patchPath).toBe(targetPath)
		await expect(stat(targetPath)).resolves.toMatchObject({ size: result.status.size })
	})

	it('falls back to copy and cleanup when temp file is on another drive', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-exdev-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })

		const copiedPaths: string[] = []
		const removedPaths: string[] = []
		const fileSystem: FpsPatchFileSystem = {
			copyFile: async (sourcePath, targetPath) => {
				copiedPaths.push(`${sourcePath}->${targetPath}`)
				await copyFile(sourcePath, targetPath)
			},
			mkdir,
			rename: async () => {
				const error = new Error('cross-device link not permitted') as NodeJS.ErrnoException
				error.code = 'EXDEV'
				throw error
			},
			rm: async (path, options) => {
				removedPaths.push(path)
				await rm(path, options)
			},
			stat
		}
		const downloadFile: DownloadFile = async (_url, targetPath) => {
			await writeFile(targetPath, mpqContent('patch bytes'))
		}

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			downloadFile,
			fileSystem,
			createMetadataFetcher({ size: mpqContent('patch bytes').length })
		)

		const result = await service.install()
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)

		expect(copiedPaths).toHaveLength(1)
		expect(removedPaths.some((path) => path.endsWith(`${fpsPatchFileName}.tmp`))).toBe(true)
		expect(result.status.installed).toBe(true)
		expect(result.status.freshness).toBe('latest')
		await expect(readFile(targetPath, 'utf8')).resolves.toBe(mpqContent('patch bytes'))
	})

	it('starts with the http mirror when the manifest hash is known and falls back to https', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-mirror-first-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })

		const triedUrls: string[] = []
		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			async (url, tempPath) => {
				triedUrls.push(url)
				if (triedUrls.length === 1) throw new Error('mirror failed')
				await writeFile(tempPath, mpqContent('fresh patch'))
			},
			undefined,
			createMetadataFetcher({
				build: 383,
				hash: createHash('md5').update(mpqContent('fresh patch')).digest('hex')
			}),
			hashTestFile
		)

		const result = await service.install()

		expect(triedUrls).toEqual([fpsPatchSourceUrls[1], fpsPatchSourceUrls[0]])
		expect(result.sourceUrl).toBe(fpsPatchSourceUrls[0])
		expect(result.status.freshness).toBe('latest')
		await expect(
			readFile(join(wowPath, 'Data', 'ruRU', fpsPatchFileName), 'utf8')
		).resolves.toBe(mpqContent('fresh patch'))
	})

	it('keeps the installed patch when every download fails the manifest hash', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-bad-hash-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })
		await writeFile(targetPath, mpqContent('installed patch'))

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			async (_url, tempPath) => writeFile(tempPath, mpqContent('damaged patch')),
			undefined,
			createMetadataFetcher({
				build: 357,
				hash: createHash('md5').update(mpqContent('fresh patch')).digest('hex')
			}),
			hashTestFile
		)

		await expect(service.install()).rejects.toThrow('установленный патч не изменён')
		await expect(readFile(targetPath, 'utf8')).resolves.toBe(mpqContent('installed patch'))
		await expect(readdir(join(userDataPath, 'downloads', 'fps-patch'))).resolves.toEqual([])
	})

	it('falls back to the next source when the first one serves a page instead of an MPQ', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-not-mpq-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			async (url, tempPath) =>
				writeFile(
					tempPath,
					url === fpsPatchSourceUrls[0] ? '<html>blocked</html>' : mpqContent('patch')
				),
			undefined,
			async () => {
				throw new Error('metadata unavailable')
			}
		)

		const result = await service.install()

		expect(result.sourceUrl).toBe(fpsPatchSourceUrls[1])
		await expect(readFile(targetPath, 'utf8')).resolves.toBe(mpqContent('patch'))
	})

	it('reports a locked patch file instead of a raw error code', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-locked-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })
		await writeFile(targetPath, mpqContent('installed patch'))
		const fileSystem: FpsPatchFileSystem = {
			copyFile,
			mkdir,
			rename: async () => {
				const error = new Error('operation not permitted') as NodeJS.ErrnoException
				error.code = 'EPERM'
				throw error
			},
			rm,
			stat
		}

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			async (_url, tempPath) => writeFile(tempPath, mpqContent('fresh patch')),
			fileSystem,
			createMetadataFetcher({ size: mpqContent('fresh patch').length })
		)

		await expect(service.install()).rejects.toThrow('файл занят')
		await expect(readFile(targetPath, 'utf8')).resolves.toBe(mpqContent('installed patch'))
		await expect(readdir(join(userDataPath, 'downloads', 'fps-patch'))).resolves.toEqual([])
	})

	it('marks installed fps patch as outdated when remote size differs', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-outdated-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })
		await writeFile(targetPath, 'old patch bytes')

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			async () => undefined,
			undefined,
			createMetadataFetcher({ size: 999 })
		)

		const status = await service.getStatus()

		expect(status.installed).toBe(true)
		expect(status.freshness).toBe('outdated')
		expect(status.remoteSize).toBe(999)
		expect(status.remoteSourceUrl).toBe(fpsPatchMetadataUrls[0])
	})

	it('checks installed fps patch freshness by remote hash when available', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-hash-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)
		const content = 'patch bytes'
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })
		await writeFile(targetPath, content)

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			async () => undefined,
			undefined,
			createMetadataFetcher({
				build: 355,
				hash: createHash('md5').update(content).digest('hex')
			}),
			hashTestFile
		)

		const status = await service.getStatus()

		expect(status.installed).toBe(true)
		expect(status.freshness).toBe('latest')
		expect(status.localHash).toBe(status.remoteHash)
		expect(status.remoteBuild).toBe(355)
	})

	it('marks installed fps patch as outdated when remote hash differs', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-hash-outdated-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })
		await writeFile(targetPath, 'patch bytes')

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			async () => undefined,
			undefined,
			createMetadataFetcher({
				build: 356,
				hash: 'f325d73bbb7ae38772d4c103408247cc',
				size: 'patch bytes'.length
			}),
			hashTestFile
		)

		const status = await service.getStatus()

		expect(status.installed).toBe(true)
		expect(status.freshness).toBe('outdated')
		expect(status.remoteHash).toBe('f325d73bbb7ae38772d4c103408247cc')
	})

	it('keeps installed fps patch status when remote metadata is unavailable', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-unknown-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })
		await writeFile(targetPath, 'patch bytes')

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			async () => undefined,
			undefined,
			async () => {
				throw new Error('head failed')
			}
		)

		const status = await service.getStatus()

		expect(status.installed).toBe(true)
		expect(status.freshness).toBe('unknown')
		expect(status.checkError).toContain('head failed')
	})

	it('deletes installed fps patch and returns missing status', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-delete-'))
		const wowPath = join(root, 'wow')
		const userDataPath = join(root, 'user-data')
		const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)
		await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })
		await writeFile(targetPath, 'patch bytes')

		const service = createFpsPatchService(
			() => userDataPath,
			createMemorySettingsStore({ wowPath }),
			async () => undefined,
			undefined,
			createMetadataFetcher({ size: 123 })
		)

		const result = await service.delete()

		expect(result.deleted).toBe(true)
		expect(result.status.installed).toBe(false)
		expect(result.status.freshness).toBe('missing')
		await expect(stat(targetPath)).rejects.toThrow()
	})
})

function createMetadataFetcher(metadata: {
	build?: number
	hash?: string
	size?: number
	updatedAt?: string
}): FetchFpsPatchMetadata {
	return async (sourceUrl) => ({
		sourceUrl,
		...metadata
	})
}

function mpqContent(text: string): string {
	return `MPQ\x1a${text}`
}

async function hashTestFile(filePath: string): Promise<string> {
	return createHash('md5')
		.update(await readFile(filePath))
		.digest('hex')
}

function createMemorySettingsStore(patch: Partial<LauncherSettings>): SettingsStore {
	const settings: LauncherSettings = {
		wowPath: '',
		wtfBackupPath: '',
		closeOnLaunch: false,
		checkClientBeforeLaunch: true,
		autoUpdateAddons: false,
		allowPrereleaseUpdates: false,
		githubProxyEnabled: false,
		githubProxyUrl: '',
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
