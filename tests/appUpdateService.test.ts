import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import {
	createAppUpdateService,
	appReleasesUrl,
	selectInstallAsset
} from '../src/main/updater/appUpdateService'
import type { LauncherSettings } from '../src/shared/contracts'

describe('app update service', () => {
	it('checks GitHub releases from the configured repository', async () => {
		const requestedUrls: string[] = []
		const service = createAppUpdateService(
			'1.0.0',
			createSettingsStore(false),
			createSecretStore(),
			async (url) => {
				requestedUrls.push(url)
				return [
					{
						tag_name: 'v1.1.0',
						html_url:
							'https://github.com/fxpw/awesome-sirus-launcher/releases/tag/v1.1.0',
						body: 'Notes',
						prerelease: false,
						assets: [
							{
								name: 'Awesome Sirus Launcher Setup 1.1.0.exe',
								browser_download_url: 'https://example.test/setup.exe',
								size: 100
							}
						]
					}
				]
			},
			async () => undefined,
			async () => undefined,
			async () => undefined,
			() => ''
		)

		const result = await service.check()

		expect(requestedUrls).toEqual([appReleasesUrl])
		expect(result.updateAvailable).toBe(true)
		expect(result.latest?.version).toBe('1.1.0')
		expect(result.latest?.assets[0]?.downloadUrl).toBe('https://example.test/setup.exe')
	})

	it('uses the prerelease setting when checking releases', async () => {
		const service = createAppUpdateService(
			'1.0.0',
			createSettingsStore(true),
			createSecretStore(),
			async () => [
				{
					tag_name: 'v2.0.0',
					html_url: 'https://github.com/fxpw/awesome-sirus-launcher/releases/tag/v2.0.0',
					body: null,
					prerelease: true,
					assets: []
				}
			],
			async () => undefined,
			async () => undefined,
			async () => undefined,
			() => ''
		)

		const result = await service.check()

		expect(result.updateAvailable).toBe(true)
		expect(result.latest?.version).toBe('2.0.0')
	})

	it('treats unavailable GitHub releases endpoint as no update', async () => {
		const service = createAppUpdateService(
			'1.0.1',
			createSettingsStore(false),
			createSecretStore(),
			async () => {
				throw new Error('Request failed 404 Not Found')
			},
			async () => undefined,
			async () => undefined,
			async () => undefined,
			() => ''
		)

		const result = await service.check()

		expect(result).toEqual({
			currentVersion: '1.0.1',
			updateAvailable: false
		})
	})

	it('uses saved GitHub token as a fallback for private releases', async () => {
		const requestedWithToken: Array<{ url: string; token?: string }> = []
		const service = createAppUpdateService(
			'1.0.0',
			createSettingsStore(false),
			createSecretStore('token-123'),
			async () => {
				throw new Error('Request failed 404 Not Found')
			},
			async (url, token) => {
				requestedWithToken.push({ url, token })
				return [
					{
						tag_name: 'v1.1.0',
						html_url:
							'https://github.com/fxpw/awesome-sirus-launcher/releases/tag/v1.1.0',
						body: null,
						prerelease: false,
						assets: []
					}
				]
			},
			async () => undefined,
			async () => undefined,
			() => ''
		)

		const result = await service.check()

		expect(result.updateAvailable).toBe(true)
		expect(requestedWithToken).toEqual([{ url: appReleasesUrl, token: 'token-123' }])
	})

	it('prefers setup executable assets for install', () => {
		const asset = selectInstallAsset([
			{
				name: 'Awesome-Sirus-Launcher-Portable-1.2.0.exe',
				downloadUrl: 'https://example.test/portable.exe'
			},
			{
				name: 'Awesome-Sirus-Launcher-Setup-1.2.0.exe.blockmap',
				downloadUrl: 'https://example.test/blockmap'
			},
			{
				name: 'Awesome-Sirus-Launcher-Setup-1.2.0.exe',
				downloadUrl: 'https://example.test/setup.exe'
			}
		])

		expect(asset?.downloadUrl).toBe('https://example.test/setup.exe')
	})

	it('prefers portable executable assets for portable install', () => {
		const asset = selectInstallAsset(
			[
				{
					name: 'Awesome-Sirus-Launcher-Setup-1.2.0.exe',
					downloadUrl: 'https://example.test/setup.exe'
				},
				{
					name: 'Awesome-Sirus-Launcher-Portable-1.2.0.exe',
					downloadUrl: 'https://example.test/portable.exe'
				}
			],
			true
		)

		expect(asset?.downloadUrl).toBe('https://example.test/portable.exe')
	})

	it('downloads the selected update asset and runs it', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-app-update-'))
		const downloadedUrls: string[] = []
		const launchedPaths: string[] = []
		const service = createAppUpdateService(
			'1.0.0',
			createSettingsStore(false),
			createSecretStore(),
			async () => [
				{
					tag_name: 'v1.2.0',
					html_url: 'https://github.com/fxpw/awesome-sirus-launcher/releases/tag/v1.2.0',
					body: null,
					prerelease: false,
					assets: [
						{
							name: 'Awesome-Sirus-Launcher-Setup-1.2.0.exe',
							browser_download_url: 'https://example.test/setup.exe',
							size: 123
						}
					]
				}
			],
			async () => undefined,
			async (url, targetPath) => {
				downloadedUrls.push(url)
				await writeFile(targetPath, 'installer')
			},
			async (installerPath) => {
				launchedPaths.push(installerPath)
			},
			() => root
		)

		const result = await service.install()

		expect(downloadedUrls).toEqual(['https://example.test/setup.exe'])
		expect(launchedPaths).toEqual([result.downloadedPath])
		expect(result.version).toBe('1.2.0')
		await expect(readFile(result.downloadedPath, 'utf8')).resolves.toBe('installer')
	})

	it('stores non-portable updates in userData/updates and launches the setup asset', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-app-update-standard-'))
		const launchedPaths: string[] = []
		const service = createAppUpdateService(
			'1.0.0',
			createSettingsStore(false),
			createSecretStore(),
			async () => [
				{
					tag_name: 'v1.2.0',
					html_url: 'https://github.com/fxpw/awesome-sirus-launcher/releases/tag/v1.2.0',
					body: null,
					prerelease: false,
					assets: [
						{
							name: 'Awesome-Sirus-Launcher-Portable-1.2.0.exe',
							browser_download_url: 'https://example.test/portable.exe',
							size: 124
						},
						{
							name: 'Awesome-Sirus-Launcher-Setup-1.2.0.exe',
							browser_download_url: 'https://example.test/setup.exe',
							size: 123
						}
					]
				}
			],
			async () => undefined,
			async (url, targetPath) => {
				await writeFile(targetPath, `downloaded from ${url}`)
			},
			async (installerPath) => {
				launchedPaths.push(installerPath)
			},
			() => root
		)

		const result = await service.install()

		expect(result.asset.name).toBe('Awesome-Sirus-Launcher-Setup-1.2.0.exe')
		expect(result.downloadedPath).toBe(
			join(root, 'updates', 'Awesome-Sirus-Launcher-Setup-1.2.0.exe')
		)
		expect(launchedPaths).toEqual([result.downloadedPath])
		await expect(readFile(result.downloadedPath, 'utf8')).resolves.toBe(
			'downloaded from https://example.test/setup.exe'
		)
	})

	it('does not invoke portable updater flow for standard installs', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-app-update-no-portable-'))
		const portableUpdates: Array<{ downloadedPath: string; executablePath: string }> = []
		const launchedPaths: string[] = []
		const service = createAppUpdateService(
			'1.0.0',
			createSettingsStore(false),
			createSecretStore(),
			async () => [
				{
					tag_name: 'v1.2.0',
					html_url: 'https://github.com/fxpw/awesome-sirus-launcher/releases/tag/v1.2.0',
					body: null,
					prerelease: false,
					assets: [
						{
							name: 'Awesome-Sirus-Launcher-Setup-1.2.0.exe',
							browser_download_url: 'https://example.test/setup.exe',
							size: 123
						}
					]
				}
			],
			async () => undefined,
			async (url, targetPath) => {
				await writeFile(targetPath, `downloaded from ${url}`)
			},
			async (installerPath) => {
				launchedPaths.push(installerPath)
			},
			() => root,
			{
				isPortableLaunch: () => false,
				getExecutablePath: () => join(root, 'Awesome-Sirus-Launcher.exe'),
				runPortableUpdate: async (input) => {
					portableUpdates.push(input)
				}
			}
		)

		const result = await service.install()

		expect(launchedPaths).toEqual([result.downloadedPath])
		expect(portableUpdates).toEqual([])
	})

	it('downloads portable updates next to the running executable', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-portable-update-'))
		const executablePath = join(root, 'Awesome-Sirus-Launcher-Portable-1.0.0.exe')
		const portableUpdates: Array<{ downloadedPath: string; executablePath: string }> = []
		const service = createAppUpdateService(
			'1.0.0',
			createSettingsStore(false),
			createSecretStore(),
			async () => [
				{
					tag_name: 'v1.2.0',
					html_url: 'https://github.com/fxpw/awesome-sirus-launcher/releases/tag/v1.2.0',
					body: null,
					prerelease: false,
					assets: [
						{
							name: 'Awesome-Sirus-Launcher-Setup-1.2.0.exe',
							browser_download_url: 'https://example.test/setup.exe',
							size: 123
						},
						{
							name: 'Awesome-Sirus-Launcher-Portable-1.2.0.exe',
							browser_download_url: 'https://example.test/portable.exe',
							size: 124
						}
					]
				}
			],
			async () => undefined,
			async (url, targetPath) => {
				await writeFile(targetPath, `downloaded from ${url}`)
			},
			async () => undefined,
			() => join(root, 'user-data'),
			{
				isPortableLaunch: () => true,
				getExecutablePath: () => executablePath,
				runPortableUpdate: async (input) => {
					portableUpdates.push(input)
				}
			}
		)

		const result = await service.install()

		expect(result.asset.downloadUrl).toBe('https://example.test/portable.exe')
		expect(basename(result.downloadedPath)).toBe(
			'Awesome-Sirus-Launcher-Portable-1.2.0.exe.download'
		)
		expect(portableUpdates).toEqual([
			{
				downloadedPath: result.downloadedPath,
				executablePath
			}
		])
		await expect(readFile(result.downloadedPath, 'utf8')).resolves.toBe(
			'downloaded from https://example.test/portable.exe'
		)
	})
})

function createSettingsStore(allowPrereleaseUpdates: boolean) {
	const settings: LauncherSettings = {
		wowPath: '',
		wtfBackupPath: '',
		closeOnLaunch: false,
		checkClientBeforeLaunch: false,
		autoUpdateAddons: false,
		allowPrereleaseUpdates
	}

	return {
		get: async () => settings,
		save: async () => settings
	}
}

function createSecretStore(token?: string) {
	return {
		has: async () => token !== undefined,
		get: async () => token,
		set: async () => undefined,
		delete: async () => undefined
	}
}
