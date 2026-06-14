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
			allowPrereleaseUpdates: true,
			random: 'ignored'
		})

		expect(settings.wowPath).toMatch(/F:[\\/]+games[\\/]+sirus[\\/]+World of Warcraft Sirus$/)
		expect(settings.closeOnLaunch).toBe(true)
		expect(settings.checkClientBeforeLaunch).toBe(false)
		expect(settings.allowPrereleaseUpdates).toBe(true)
	})

	it('applies partial patches without losing existing values', () => {
		const settings = applyLauncherSettingsPatch(
			{
				wowPath: 'F:/games/sirus',
				closeOnLaunch: false,
				checkClientBeforeLaunch: true,
				allowPrereleaseUpdates: false
			},
			{
				closeOnLaunch: true
			}
		)

		expect(settings.closeOnLaunch).toBe(true)
		expect(settings.checkClientBeforeLaunch).toBe(true)
		expect(settings.allowPrereleaseUpdates).toBe(false)
	})
})
