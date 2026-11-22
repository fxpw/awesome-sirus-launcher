import { join } from 'node:path'
import type { LauncherSettings, LauncherSettingsPatch } from '@shared/contracts'
import {
	applyLauncherSettingsPatch,
	normalizeLauncherSettings
} from '@core/settings/launcherSettings'
import { readJsonFile, writeJsonFile } from '@main/files/jsonFile'

export interface SettingsStore {
	get(): Promise<LauncherSettings>
	save(patch: LauncherSettingsPatch): Promise<LauncherSettings>
}

export function createFileSettingsStore(getUserDataPath: () => string): SettingsStore {
	const getFilePath = () => join(getUserDataPath(), 'settings.json')

	return {
		async get() {
			return readSettings(getFilePath())
		},
		async save(patch) {
			const current = await readSettings(getFilePath())
			const next = applyLauncherSettingsPatch(current, patch)
			await writeJsonFile(getFilePath(), next)
			return next
		}
	}
}

async function readSettings(filePath: string): Promise<LauncherSettings> {
	return normalizeLauncherSettings(await readJsonFile(filePath))
}
