import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	createClientPatchTargetPath,
	normalizeClientPatchManifest
} from '../src/core/clientPatches/clientPatches'
import {
	createClientPatchService,
	type FetchJson
} from '../src/main/clientPatches/clientPatchService'
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
			}
		)

		const result = await service.check()

		expect(fetchCalls).toHaveLength(2)
		expect(result.total).toBe(3)
		expect(result.ok).toBe(1)
		expect(result.outdated).toBe(1)
		expect(result.missing).toBe(1)
		expect(result.files.map((file) => file.status)).toEqual(['ok', 'outdated', 'missing'])
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
