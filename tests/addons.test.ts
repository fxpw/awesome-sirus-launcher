import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

	it('defines explicit version toc paths for DBM and Details packages', () => {
		const addons = (addonCatalog as { addons: AddonCatalogEntry[] }).addons
		const dbm = addons.find((addon) => addon.id === 'community:dbm')
		const details = addons.find((addon) => addon.id === 'community:details')

		expect(dbm).toMatchObject({
			versionFolder: 'DBM-Core',
			versionFile: 'DBM-Core.toc'
		})
		expect(dbm?.folders).toContain('DBM-TolGarodePrison')
		expect(dbm?.folders).not.toContain("DBM-Tol'GarodePrison")
		expect(dbm?.folders).not.toContain('DBM-BronzeSanctuary')
		expect(details).toMatchObject({
			versionUrl:
				'https://raw.githubusercontent.com/fxpw/Details-WotLK/master/Details/Details.toc',
			versionFolder: 'Details',
			versionFile: 'Details.toc'
		})
		expect(details?.folders).toContain('Details_TinyThreat')
		expect(details?.folders).not.toContain('Details_CustomAbsorbDmg')
		expect(details?.folders).not.toContain('Details_CustomTankInfo')
	})

	it('includes the full Mr-Dan community catalog snapshot', () => {
		const addons = (addonCatalog as { addons: AddonCatalogEntry[] }).addons
		const community = addons.filter((addon) => addon.source === 'community')
		const aeonoPlates = community.find((addon) => addon.id === 'community:aeonoplates')
		const nezvezdi = community.find((addon) => addon.id === 'community:nezvezdi')
		const weakAuras = community.find((addon) => addon.id === 'community:weakauras')

		expect(community).toHaveLength(72)
		expect(aeonoPlates).toMatchObject({
			name: 'AeonoPlates',
			repo: 'Aeonoscul/AeonoPlates',
			folders: ['AeonoPlates']
		})
		expect(nezvezdi).toMatchObject({
			repo: 'L0uten/NezvezdiSirus',
			branch: 'master'
		})
		expect(weakAuras?.folders).not.toContain('WeakAurasSounds')
	})

	it('does not include catalog entries whose GitHub repositories are unavailable', () => {
		const addons = (addonCatalog as { addons: AddonCatalogEntry[] }).addons

		expect(addons.find((addon) => addon.id === 'sirus:advancedwotlkcombatlog')).toBeUndefined()
		expect(
			addons.find((addon) => addon.id === 'sirus:advancedwotlkcombatlog_helper')
		).toBeUndefined()
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

	it('installs addons whose repository has toc files at zip root', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('## Version: 1.0.0\n'))
		)

		const root = await mkdtemp(join(tmpdir(), 'sirus-addons-root-toc-'))
		const wowPath = join(root, 'wow')
		const addonPath = join(wowPath, 'Interface', 'AddOns', 'AeonoPlates')

		try {
			await mkdir(join(wowPath, 'Data'), { recursive: true })
			await mkdir(join(wowPath, 'Interface'), { recursive: true })
			await mkdir(join(wowPath, 'WTF'), { recursive: true })
			await writeFile(join(wowPath, 'run.exe'), '')

			const service = createAddonService(
				() => root,
				createMemorySettingsStore({ wowPath }),
				createMemorySecretStore(),
				async () => undefined,
				async (_archivePath, targetDir) => {
					const archiveRoot = join(targetDir, 'AeonoPlates-main')
					await mkdir(archiveRoot, { recursive: true })
					await writeFile(join(archiveRoot, 'AeonoPlates.toc'), '## Version: 1.0.0\n')
					await writeFile(join(archiveRoot, 'AeonoPlates.xml'), '<Ui />')
				}
			)

			const result = await service.install({ addonId: 'community:aeonoplates' })

			expect(result.installedFolders).toEqual(['AeonoPlates'])
			await expect(readFile(join(addonPath, 'AeonoPlates.toc'), 'utf8')).resolves.toContain(
				'1.0.0'
			)
			expect(result.addon.status).toBe('installed')
			expect(result.addon.installedVersion).toBe('1.0.0')
		} finally {
			vi.unstubAllGlobals()
		}
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

	it('deletes installed addon folders and returns not-installed status', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-addons-delete-'))
		const wowPath = join(root, 'wow')
		const addonPath = join(wowPath, 'Interface', 'AddOns', 'AeonoPlates')
		await mkdir(join(wowPath, 'Data'), { recursive: true })
		await mkdir(join(wowPath, 'Interface'), { recursive: true })
		await mkdir(join(wowPath, 'WTF'), { recursive: true })
		await mkdir(addonPath, { recursive: true })
		await writeFile(join(wowPath, 'run.exe'), '')
		await writeFile(join(addonPath, 'AeonoPlates.toc'), '## Version: 1.0.0\n')

		const service = createAddonService(
			() => root,
			createMemorySettingsStore({ wowPath }),
			createMemorySecretStore(),
			async () => undefined,
			async () => undefined
		)

		const result = await service.delete({ addonId: 'community:aeonoplates' })

		expect(result.deletedFolders).toEqual(['AeonoPlates'])
		expect(result.addon.status).toBe('not-installed')
		await expect(readFile(join(addonPath, 'AeonoPlates.toc'), 'utf8')).rejects.toThrow()
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

	it('uses explicit version folder and toc file for DBM packages', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('## Version: 9.2.126\n'))
		)

		try {
			const root = await mkdtemp(join(tmpdir(), 'sirus-addons-dbm-version-'))
			const wowPath = join(root, 'wow')
			const addonsPath = join(wowPath, 'Interface', 'AddOns')
			await mkdir(join(wowPath, 'Data'), { recursive: true })
			await mkdir(join(wowPath, 'Interface'), { recursive: true })
			await mkdir(join(wowPath, 'WTF'), { recursive: true })
			await mkdir(join(addonsPath, 'DBM-AQ20'), { recursive: true })
			await mkdir(join(addonsPath, 'DBM-Core'), { recursive: true })
			await writeFile(join(wowPath, 'run.exe'), '')
			await writeFile(join(addonsPath, 'DBM-AQ20', 'DBM-AQ20.toc'), '## Interface: 30300\n')
			await writeFile(join(addonsPath, 'DBM-Core', 'DBM-Core.toc'), '## Version: 9.2.123\n')

			const service = createAddonService(
				() => root,
				createMemorySettingsStore({ wowPath }),
				createMemorySecretStore(),
				async () => undefined,
				async () => undefined
			)

			const checked = await service.check()
			const dbm = checked.addons.find((addon) => addon.name === 'DBM')

			expect(dbm?.installedVersion).toBe('9.2.123')
			expect(dbm?.remoteVersion).toBe('9.2.126')
			expect(dbm?.status).toBe('outdated')
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
		wtfBackupPath: '',
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
