import { normalize, resolve } from 'node:path'
import type { LauncherSettings, LauncherSettingsPatch } from '@shared/contracts'
import { normalizeGitHubProxyUrl, validateGitHubProxySettings } from '@core/github/githubProxy'

export const defaultLauncherSettings: LauncherSettings = {
	wowPath: '',
	wtfBackupPath: '',
	closeOnLaunch: false,
	checkClientBeforeLaunch: false,
	autoUpdateAddons: false,
	allowPrereleaseUpdates: false,
	githubProxyEnabled: false,
	githubProxyUrl: ''
}

export function normalizeLauncherSettings(value: unknown): LauncherSettings {
	if (!isRecord(value)) return { ...defaultLauncherSettings }

	const githubProxyUrl = normalizeGitHubProxyUrl(value.githubProxyUrl)
	return {
		wowPath: normalizeWowPath(value.wowPath),
		wtfBackupPath: normalizeOptionalPath(value.wtfBackupPath),
		closeOnLaunch: value.closeOnLaunch === true,
		checkClientBeforeLaunch: value.checkClientBeforeLaunch === true,
		autoUpdateAddons: value.autoUpdateAddons === true,
		allowPrereleaseUpdates: value.allowPrereleaseUpdates === true,
		githubProxyEnabled: value.githubProxyEnabled === true && Boolean(githubProxyUrl),
		githubProxyUrl
	}
}

export function applyLauncherSettingsPatch(
	current: LauncherSettings,
	patch: LauncherSettingsPatch
): LauncherSettings {
	const proxySettings = validateGitHubProxySettings({
		enabled: patch.githubProxyEnabled ?? current.githubProxyEnabled,
		url: patch.githubProxyUrl ?? current.githubProxyUrl
	})

	return normalizeLauncherSettings({
		...current,
		...patch,
		githubProxyEnabled: proxySettings.enabled,
		githubProxyUrl: proxySettings.url
	})
}

function normalizeWowPath(value: unknown): string {
	return normalizeOptionalPath(value)
}

function normalizeOptionalPath(value: unknown): string {
	if (typeof value !== 'string') return ''
	const trimmed = value.trim()
	return trimmed ? normalize(resolve(trimmed)) : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}
