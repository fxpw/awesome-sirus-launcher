import { normalize, resolve } from 'node:path'
import type { LauncherSettings, LauncherSettingsPatch } from '@shared/contracts'

export const defaultLauncherSettings: LauncherSettings = {
  wowPath: '',
  closeOnLaunch: false,
  checkClientBeforeLaunch: false,
  allowPrereleaseUpdates: false
}

export function normalizeLauncherSettings(value: unknown): LauncherSettings {
  if (!isRecord(value)) return { ...defaultLauncherSettings }

  return {
    wowPath: normalizeWowPath(value.wowPath),
    closeOnLaunch: value.closeOnLaunch === true,
    checkClientBeforeLaunch: value.checkClientBeforeLaunch === true,
    allowPrereleaseUpdates: value.allowPrereleaseUpdates === true
  }
}

export function applyLauncherSettingsPatch(
  current: LauncherSettings,
  patch: LauncherSettingsPatch
): LauncherSettings {
  return normalizeLauncherSettings({
    ...current,
    ...patch
  })
}

function normalizeWowPath(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed ? normalize(resolve(trimmed)) : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
