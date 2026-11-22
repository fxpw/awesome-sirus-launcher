import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultLauncherSettings } from '../src/core/settings/launcherSettings'
import { createAccountService } from '../src/main/accounts/accountService'
import { createAddonService } from '../src/main/addons/addonService'
import { createFileClientMd5Cache } from '../src/main/clientPatches/clientMd5Cache'
import { createClientRegistrationStore } from '../src/main/device/clientRegistrationStore'
import { readJsonFile, writeJsonFile } from '../src/main/files/jsonFile'
import { createMiningService } from '../src/main/mining/miningService'
import { createSecretStore } from '../src/main/secrets/memorySecretStore'
import { createFileSettingsStore } from '../src/main/settings/fileSettingsStore'
import { createSirusLauncherVersionService } from '../src/main/sirus/sirusLauncherVersionService'

describe('json file', () => {
	it('returns undefined for a missing file and replaces the file without leaving a temp copy', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-json-file-'))
		const filePath = join(root, 'nested', 'settings.json')

		await expect(readJsonFile(filePath)).resolves.toBeUndefined()

		await writeJsonFile(filePath, { value: 1 })
		await writeJsonFile(filePath, { value: 2 })

		await expect(readJsonFile(filePath)).resolves.toEqual({ value: 2 })
		await expect(readdir(join(root, 'nested'))).resolves.toEqual(['settings.json'])
	})

	it('writes the same file in parallel in call order without temp name collisions', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-json-parallel-'))
		const filePath = join(root, 'state.json')

		await Promise.all(
			Array.from({ length: 20 }, (_, index) => writeJsonFile(filePath, { index }))
		)

		await expect(readJsonFile(filePath)).resolves.toEqual({ index: 19 })
		await expect(readdir(root)).resolves.toEqual(['state.json'])
	})

	it('removes the temp file when the write fails', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-json-write-fail-'))
		await mkdir(join(root, 'folder.json'))

		await expect(writeJsonFile(join(root, 'folder.json'), { value: 1 })).rejects.toThrow()
		await expect(readdir(root)).resolves.toEqual(['folder.json'])
	})

	it('moves a broken file aside, falls back to defaults and writes a valid file next time', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-json-corrupt-'))
		const brokenText = '{"wowPath": "C:/wow",'
		await writeFile(join(root, 'settings.json'), brokenText)
		const store = createFileSettingsStore(() => root)

		await expect(store.get()).resolves.toEqual(defaultLauncherSettings)
		const corruptFiles = (await readdir(root)).filter((name) => name.endsWith('.corrupt'))
		expect(corruptFiles).toHaveLength(1)
		expect(corruptFiles[0]).toMatch(/^settings\.json\..+\.corrupt$/)
		await expect(readFile(join(root, corruptFiles[0]), 'utf8')).resolves.toBe(brokenText)

		await store.save({ closeOnLaunch: true })
		expect(JSON.parse(await readFile(join(root, 'settings.json'), 'utf8'))).toMatchObject({
			closeOnLaunch: true
		})

		await mkdir(join(root, 'folder.json'))
		await expect(readJsonFile(join(root, 'folder.json'))).rejects.toMatchObject({
			code: 'EISDIR'
		})
		expect((await readdir(root)).sort()).toEqual(
			['folder.json', 'settings.json', corruptFiles[0]].sort()
		)
	})

	it('falls back to defaults when data files hold valid JSON of the wrong shape', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-json-shape-'))
		await mkdir(join(root, 'cache'))
		await writeFile(join(root, 'settings.json'), '[]')
		await writeFile(join(root, 'accounts.json'), 'null')
		await writeFile(join(root, 'mining.json'), '"text"')
		await writeFile(join(root, 'client-registration.json'), '42')
		await writeFile(join(root, 'sirus-launcher-version.json'), '[]')
		await writeFile(join(root, 'cache', 'client-md5.json'), '{"version":1,"entries":[]}')
		await writeFile(
			join(root, 'custom-addons.json'),
			JSON.stringify([
				null,
				{ name: 'Broken' },
				{
					id: 'custom:valid:3',
					source: 'custom',
					name: 'Valid',
					branch: 'main',
					folders: [],
					githubUrl: 'https://github.com/example/valid',
					repo: 'example/valid'
				}
			])
		)
		const settingsStore = createFileSettingsStore(() => root)

		await expect(settingsStore.get()).resolves.toEqual(defaultLauncherSettings)
		await expect(createAccountService(() => root, createSecretStore()).list()).resolves.toEqual(
			{
				accounts: [],
				selectedAccountId: undefined
			}
		)
		await expect(
			createMiningService(() => root, {
				start: () => ({ stop() {}, onExit() {} })
			}).getState()
		).resolves.toMatchObject({ status: 'not-configured', acceptedSharesTotal: 0 })
		await expect(createClientRegistrationStore(() => root).get()).resolves.toBeNull()
		await expect(
			createSirusLauncherVersionService(
				() => root,
				'fallback',
				async () => {
					throw new Error('offline')
				}
			).getVersion()
		).resolves.toBe('fallback')
		await expect(
			createFileClientMd5Cache(() => root).get({ filePath: 'x', size: 1, mtimeMs: 1 })
		).resolves.toBeUndefined()

		const addons = await createAddonService(
			() => root,
			settingsStore,
			createSecretStore(),
			async () => undefined,
			async () => undefined
		).list()
		expect(addons.custom).toBe(1)
		expect(addons.addons.find((addon) => addon.source === 'custom')?.name).toBe('Valid')
	})
})
