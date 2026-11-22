import { dirname } from 'node:path'
import type { GameLaunchResult } from '@shared/contracts'
import { validateWowPath } from '@core/wow/wowPaths'
import type { SettingsStore } from '@main/settings/fileSettingsStore'

export type LaunchProcess = (executablePath: string, cwd: string) => Promise<void>
export type BeforeGameLaunch = (wowPath: string) => Promise<void>

export interface GameLaunchService {
	launch(): Promise<GameLaunchResult>
}

export function createGameLaunchService(
	settingsStore: SettingsStore,
	launchProcess: LaunchProcess,
	beforeLaunch: BeforeGameLaunch = async () => undefined
): GameLaunchService {
	return {
		async launch() {
			const settings = await settingsStore.get()
			if (!settings.wowPath) throw new Error('Сначала выберите папку WoW')

			const validation = validateWowPath(settings.wowPath)
			if (!validation.valid) {
				throw new Error(`Клиент WoW не готов: ${validation.missing.join(', ')}`)
			}

			await beforeLaunch(settings.wowPath)
			await launchProcess(validation.executablePath, dirname(validation.executablePath))

			return {
				launchedAt: new Date().toISOString(),
				executablePath: validation.executablePath
			}
		}
	}
}
