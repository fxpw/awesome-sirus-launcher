import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
	compareAddonVersions,
	createCustomAddonEntry,
	parseGitHubRepoUrl,
	parseTocVersion
} from '../src/core/addons/addons'
import { createAddonService } from '../src/main/addons/addonService'
import addonCatalog from '../src/shared/addons/addonCatalog.json'
import type { AddonCatalogEntry } from '../src/shared/contracts'
import type { SettingsStore } from '../src/main/settings/fileSettingsStore'
import type { SecretStore } from '../src/main/secrets/memorySecretStore'
import type { LauncherSettings } from '../src/shared/contracts'

describe('addons core', () => {
	it('parses GitHub repo URLs and toc versions', () => {
		expect(parseGitHubRepoUrl('https://github.com/fxpw/AckisRecipeList-for-sirus/')).toBe(
			'fxpw/AckisRecipeList-for-sirus'
		)
		expect(parseTocVersion('## Interface: 30300\n## Version: 1.2.3\n')).toBe('1.2.3')
	})

	it('compares addon versions by semver, dotted numeric, plain number and string fallback', () => {
		expect(parseTocVersion('## Interface: 30300\n## Version: 5.21.6\n')).toBe('5.21.6')
		expect(compareAddonVersions('5.21.5', '5.21.6')).toBeLessThan(0)
		expect(compareAddonVersions('v5.22.0', '5.21.6')).toBeGreaterThan(0)
		expect(compareAddonVersions('1.123124123', '1.123124124')).toBeLessThan(0)
		expect(compareAddonVersions('123', '124')).toBeLessThan(0)
		expect(compareAddonVersions('release-a', 'release-b')).toBeLessThan(0)
		expect(compareAddonVersions('release-a', 'release-a')).toBe(0)
	})

	it('creates custom addon entries with safe defaults', () => {
		const entry = createCustomAddonEntry(
			{
				name: 'My Addon',
				githubUrl: 'https://github.com/example/my-addon'
			},
			1
		)

		expect(entry).toMatchObject({
			id: 'custom:my-addon:1',
			source: 'custom',
			branch: 'main',
			folders: [],
			repo: 'example/my-addon'
		})
	})

	it('keeps EPGP and EPGP_Auction folder ownership separated', () => {
		const addons = (addonCatalog as { addons: AddonCatalogEntry[] }).addons
		const epgp = addons.find((addon) => addon.id === 'community:epgp')
		const epgpAuction = addons.find((addon) => addon.id === 'community:epgp_auction')

		expect(epgp?.folders).toEqual([
			'EPGP',
			'EPGP_Attendance',
			'EPGP_Lootmaster',
			'EPGP_Lootmaster_ML'
		])
		expect(epgpAuction?.folders).toEqual(['EPGP_Auction'])
	})
})

describe('addon service', () => {
	it('skips installed addon folders that contain .git', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-addons-'))
		const wowPath = join(root, 'wow')
		const addonPath = join(wowPath, 'Interface', 'AddOns', 'AckisRecipeList')
		await mkdir(join(wowPath, 'Data'), { recursive: true })
		await mkdir(join(wowPath, 'Interface'), { recursive: true })
		await mkdir(join(wowPath, 'WTF'), { recursive: true })
		await mkdir(join(addonPath, '.git'), { recursive: true })
		await writeFile(join(wowPath, 'run.exe'), '')
		await writeFile(join(addonPath, 'AckisRecipeList.toc'), '## Version: local\n')

		const service = createAddonService(
			() => root,
			createMemorySettingsStore({ wowPath }),
			createMemorySecretStore(),
			async () => undefined,
			async () => undefined
		)

		const checked = await service.list()
		const addon = checked.addons.find((item) => item.name === 'AckisRecipeList')

		expect(addon?.status).toBe('manual-git')
		await expect(service.install({ addonId: addon?.id ?? '' })).rejects.toThrow(
			'Аддон установлен из git'
		)
	})

	it('checks only installed catalog addons matched by folder name', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('## Version: 2.0.0\n'))
		)

		try {
			const root = await mkdtemp(join(tmpdir(), 'sirus-addons-check-'))
			const wowPath = join(root, 'wow')
			const addonPath = join(wowPath, 'Interface', 'AddOns', 'AckisRecipeList')
			await mkdir(join(wowPath, 'Data'), { recursive: true })
			await mkdir(join(wowPath, 'Interface'), { recursive: true })
			await mkdir(join(wowPath, 'WTF'), { recursive: true })
			await mkdir(addonPath, { recursive: true })
			await mkdir(join(wowPath, 'Interface', 'AddOns', 'NotInCatalog'), { recursive: true })
			await writeFile(join(wowPath, 'run.exe'), '')
			await writeFile(join(addonPath, 'AckisRecipeList.toc'), '## Version: 1.0.0\n')

			const service = createAddonService(
				() => root,
				createMemorySettingsStore({ wowPath }),
				createMemorySecretStore(),
				async () => undefined,
				async () => undefined
			)

			const checked = await service.check()

			expect(checked.total).toBe(1)
			expect(checked.addons).toHaveLength(1)
			expect(checked.addons[0].name).toBe('AckisRecipeList')
			expect(checked.addons[0].status).toBe('outdated')
			expect(fetch).toHaveBeenCalledTimes(1)
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it('uses addon name folder for installed version when package has helper folders', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('## Version: 5.21.6\n'))
		)

		try {
			const root = await mkdtemp(join(tmpdir(), 'sirus-addons-version-folder-'))
			const wowPath = join(root, 'wow')
			const addonsPath = join(wowPath, 'Interface', 'AddOns')
			await mkdir(join(wowPath, 'Data'), { recursive: true })
			await mkdir(join(wowPath, 'Interface'), { recursive: true })
			await mkdir(join(wowPath, 'WTF'), { recursive: true })
			await mkdir(join(addonsPath, 'APIDocumentation'), { recursive: true })
			await mkdir(join(addonsPath, 'WeakAuras'), { recursive: true })
			await writeFile(join(wowPath, 'run.exe'), '')
			await writeFile(
				join(addonsPath, 'APIDocumentation', 'APIDocumentation.toc'),
				'## Version: 1.0.1\n'
			)
			await writeFile(join(addonsPath, 'WeakAuras', 'WeakAuras.toc'), '## Version: 5.21.6\n')

			const service = createAddonService(
				() => root,
				createMemorySettingsStore({ wowPath }),
				createMemorySecretStore(),
				async () => undefined,
				async () => undefined
			)

			const checked = await service.check()
			const weakAuras = checked.addons.find((addon) => addon.name === 'WeakAuras')

			expect(weakAuras?.installedVersion).toBe('5.21.6')
			expect(weakAuras?.remoteVersion).toBe('5.21.6')
			expect(weakAuras?.status).toBe('outdated')
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it('exports and imports per-user custom addons without duplicates', async () => {
		const sourceRoot = await mkdtemp(join(tmpdir(), 'sirus-addons-export-'))
		const targetRoot = await mkdtemp(join(tmpdir(), 'sirus-addons-import-'))
		const exportPath = join(sourceRoot, 'custom-addons.json')
		const source = createAddonService(
			() => sourceRoot,
			createMemorySettingsStore({}),
			createMemorySecretStore(),
			async () => undefined,
			async () => undefined
		)
		const target = createAddonService(
			() => targetRoot,
			createMemorySettingsStore({}),
			createMemorySecretStore(),
			async () => undefined,
			async () => undefined
		)

		await source.addCustom({
			name: 'Custom',
			githubUrl: 'https://github.com/example/custom'
		})

		const exported = await source.exportCustom(exportPath)
		expect(exported.total).toBe(1)

		const firstImport = await target.importCustom(exportPath)
		const secondImport = await target.importCustom(exportPath)

		expect(firstImport.total).toBe(1)
		expect(secondImport.total).toBe(1)
		expect((await target.list()).custom).toBe(1)
	})
})

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

function createMemorySecretStore(): SecretStore {
	return {
		async has() {
			return false
		},
		async get() {
			return undefined
		},
		async set() {
			return undefined
		},
		async delete() {
			return undefined
		}
	}
}
