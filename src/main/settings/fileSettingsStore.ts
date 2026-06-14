import { dirname, join } from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { LauncherSettings, LauncherSettingsPatch } from '@shared/contracts'
import {
  applyLauncherSettingsPatch,
  defaultLauncherSettings,
  normalizeLauncherSettings
} from '@core/settings/launcherSettings'

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
      await writeSettings(getFilePath(), next)
      return next
    }
  }
}

async function readSettings(filePath: string): Promise<LauncherSettings> {
  if (!existsSync(filePath)) return { ...defaultLauncherSettings }

  const raw = await readFile(filePath, 'utf8')
  return normalizeLauncherSettings(JSON.parse(raw))
}

async function writeSettings(filePath: string, settings: LauncherSettings): Promise<void> {
  const tempPath = `${filePath}.tmp`
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(tempPath, JSON.stringify(settings, null, 2), 'utf8')
  await rename(tempPath, filePath)
}
