import {
	checkForAppUpdate,
	mapGitHubRelease,
	type GitHubReleaseResponse
} from '../../core/updater/appUpdate'
import { getPortableUpdateDownloadPath } from '../../core/updater/portableUpdateScript'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AppUpdateCheck, AppUpdateInstallResult, ReleaseAsset } from '../../shared/contracts'
import type { SettingsStore } from '../settings/fileSettingsStore'
import type { SecretStore } from '../secrets/memorySecretStore'

export const appReleasesUrl =
	'https://api.github.com/repos/fxpw/awesome-sirus-launcher/releases?per_page=20'

interface PortableUpdateInput {
	downloadedPath: string
	executablePath: string
}

interface AppUpdateRuntime {
	isPortableLaunch?: () => boolean
	getExecutablePath?: () => string
	runPortableUpdate?: (input: PortableUpdateInput) => Promise<void>
}

export function createAppUpdateService(
	currentVersion: string,
	settingsStore: SettingsStore,
	secretStore: SecretStore,
	fetchJson: (url: string) => Promise<unknown>,
	fetchJsonWithToken: (url: string, token?: string) => Promise<unknown>,
	downloadFile: (url: string, targetPath: string, options?: { token?: string }) => Promise<void>,
	runInstaller: (installerPath: string) => Promise<void>,
	getUserDataPath: () => string,
	runtime: AppUpdateRuntime = {}
): { check(): Promise<AppUpdateCheck>; install(): Promise<AppUpdateInstallResult> } {
	async function check(): Promise<AppUpdateCheck> {
		const settings = await settingsStore.get()
		const token = await secretStore.get('github-token')
		let payload: unknown

		try {
			payload = await fetchJson(appReleasesUrl)
		} catch (err) {
			if (!isGitHubReleasesUnavailable(err)) throw err

			if (token) {
				try {
					payload = await fetchJsonWithToken(appReleasesUrl, token)
				} catch (tokenErr) {
					if (!isGitHubReleasesUnavailable(tokenErr)) throw tokenErr
				}
			}

			if (!payload) {
				return {
					currentVersion,
					updateAvailable: false
				}
			}
		}

		if (!Array.isArray(payload))
			throw new Error('GitHub Releases response должен быть массивом')

		const releases = payload.map(toGitHubReleaseResponse).map(mapGitHubRelease)
		return checkForAppUpdate(currentVersion, releases, settings.allowPrereleaseUpdates)
	}

	return {
		check,
		async install() {
			const update = await check()
			if (!update.updateAvailable || !update.latest) {
				throw new Error('Обновление лаунчера не найдено')
			}

			const isPortableLaunch = runtime.isPortableLaunch?.() ?? false
			const asset = selectInstallAsset(update.latest.assets, isPortableLaunch)
			if (!asset) throw new Error('В релизе нет Windows .exe установщика')

			const targetPath = isPortableLaunch
				? getPortableUpdateDownloadPath(asset.name, getPortableExecutablePath(runtime))
				: join(getUserDataPath(), 'updates', sanitizeFileName(asset.name))
			await mkdir(dirname(targetPath), { recursive: true })

			await downloadUpdateAsset(asset.downloadUrl, targetPath)
			if (isPortableLaunch) {
				if (!runtime.runPortableUpdate) {
					throw new Error('Portable updater не настроен')
				}
				await runtime.runPortableUpdate({
					downloadedPath: targetPath,
					executablePath: getPortableExecutablePath(runtime)
				})
			} else {
				await runInstaller(targetPath)
			}

			return {
				installedAt: new Date().toISOString(),
				version: update.latest.version,
				asset,
				downloadedPath: targetPath
			}
		}
	}

	async function downloadUpdateAsset(url: string, targetPath: string): Promise<void> {
		const token = await secretStore.get('github-token')
		try {
			await downloadFile(url, targetPath)
		} catch (err) {
			if (!token || !isGitHubAssetUnavailable(err)) throw err
			await downloadFile(url, targetPath, { token })
		}
	}
}

export function selectInstallAsset(
	assets: ReleaseAsset[],
	preferPortable = false
): ReleaseAsset | undefined {
	const candidates = assets.filter((asset) => {
		const name = asset.name.toLowerCase()
		return name.endsWith('.exe') && !name.endsWith('.exe.blockmap')
	})

	if (preferPortable) {
		return (
			candidates.find((asset) => /portable/i.test(asset.name)) ??
			candidates.find((asset) => /setup/i.test(asset.name)) ??
			candidates[0]
		)
	}

	return (
		candidates.find((asset) => /setup/i.test(asset.name)) ??
		candidates.find((asset) => /portable/i.test(asset.name)) ??
		candidates[0]
	)
}

function sanitizeFileName(fileName: string): string {
	return fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
}

function getPortableExecutablePath(runtime: AppUpdateRuntime): string {
	const executablePath = runtime.getExecutablePath?.()
	if (!executablePath) throw new Error('Путь к portable лаунчеру не найден')
	return executablePath
}

function isGitHubReleasesUnavailable(err: unknown): boolean {
	if (!(err instanceof Error)) return false
	return /Request failed 404\b/.test(err.message)
}

function isGitHubAssetUnavailable(err: unknown): boolean {
	if (!(err instanceof Error)) return false
	return /Download failed (?:403|404)\b/.test(err.message)
}

function toGitHubReleaseResponse(value: unknown): GitHubReleaseResponse {
	if (!isRecord(value)) throw new Error('GitHub release должен быть объектом')
	const assets = Array.isArray(value.assets) ? value.assets.map(toGitHubReleaseAsset) : []

	return {
		tag_name: readString(value, 'tag_name'),
		html_url: readString(value, 'html_url'),
		body: typeof value.body === 'string' ? value.body : null,
		prerelease: value.prerelease === true,
		assets
	}
}

function toGitHubReleaseAsset(value: unknown): GitHubReleaseResponse['assets'][number] {
	if (!isRecord(value)) throw new Error('GitHub release asset должен быть объектом')

	const size = typeof value.size === 'number' ? value.size : undefined
	return {
		name: readString(value, 'name'),
		browser_download_url: readString(value, 'browser_download_url'),
		size
	}
}

function readString(record: Record<string, unknown>, key: string): string {
	const value = record[key]
	if (typeof value !== 'string')
		throw new Error(`GitHub release field ${key} должен быть строкой`)
	return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}
