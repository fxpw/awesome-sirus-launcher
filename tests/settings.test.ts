import { describe, expect, it } from 'vitest'
import {
	applyLauncherSettingsPatch,
	defaultLauncherSettings,
	normalizeLauncherSettings
} from '../src/core/settings/launcherSettings'

describe('launcher settings', () => {
	it('returns defaults for invalid input', () => {
		expect(normalizeLauncherSettings(null)).toEqual(defaultLauncherSettings)
	})

	it('normalizes known fields and drops unknown data', () => {
		const settings = normalizeLauncherSettings({
			wowPath: '  F:/games/sirus/World of Warcraft Sirus  ',
			closeOnLaunch: true,
			checkClientBeforeLaunch: false,
			autoUpdateAddons: true,
			allowPrereleaseUpdates: true,
			random: 'ignored'
		})

		expect(settings.wowPath).toMatch(/F:[\\/]+games[\\/]+sirus[\\/]+World of Warcraft Sirus$/)
		expect(settings.closeOnLaunch).toBe(true)
		expect(settings.checkClientBeforeLaunch).toBe(false)
		expect(settings.autoUpdateAddons).toBe(true)
		expect(settings.allowPrereleaseUpdates).toBe(true)
		expect(settings.githubProxyEnabled).toBe(false)
		expect(settings.githubProxyUrl).toBe('')
	})

	it('applies partial patches without losing existing values', () => {
		const settings = applyLauncherSettingsPatch(
			{
				wowPath: 'F:/games/sirus',
				wtfBackupPath: '',
				closeOnLaunch: false,
				checkClientBeforeLaunch: true,
				autoUpdateAddons: false,
				allowPrereleaseUpdates: false,
				githubProxyEnabled: false,
				githubProxyUrl: ''
			},
			{
				closeOnLaunch: true,
				autoUpdateAddons: true
			}
		)

		expect(settings.closeOnLaunch).toBe(true)
		expect(settings.checkClientBeforeLaunch).toBe(true)
		expect(settings.autoUpdateAddons).toBe(true)
		expect(settings.allowPrereleaseUpdates).toBe(false)
	})

	it('normalizes and enables a manual GitHub proxy', () => {
		const settings = applyLauncherSettingsPatch(defaultLauncherSettings, {
			githubProxyEnabled: true,
			githubProxyUrl: '  socks5://127.0.0.1:1080/  '
		})

		expect(settings.githubProxyEnabled).toBe(true)
		expect(settings.githubProxyUrl).toBe('socks5://127.0.0.1:1080')
	})

	it('rejects an enabled proxy without an address or with embedded credentials', () => {
		expect(() =>
			applyLauncherSettingsPatch(defaultLauncherSettings, { githubProxyEnabled: true })
		).toThrow('Укажи адрес прокси')
		expect(() =>
			applyLauncherSettingsPatch(defaultLauncherSettings, {
				githubProxyEnabled: true,
				githubProxyUrl: 'http://user:password@localhost:8080'
			})
		).toThrow('логином и паролем')
	})

	it('allows disabling a proxy even when the draft address is invalid', () => {
		const settings = applyLauncherSettingsPatch(
			{
				...defaultLauncherSettings,
				githubProxyEnabled: true,
				githubProxyUrl: 'http://127.0.0.1:7890'
			},
			{ githubProxyEnabled: false, githubProxyUrl: 'not-a-proxy' }
		)

		expect(settings.githubProxyEnabled).toBe(false)
		expect(settings.githubProxyUrl).toBe('')
	})
})
