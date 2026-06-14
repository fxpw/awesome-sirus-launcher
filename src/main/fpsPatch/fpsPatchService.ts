import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { FpsPatchInstallResult, FpsPatchStatus } from '@shared/contracts'
import {
  createFpsPatchInstallPlan,
  fpsPatchSourceUrls
} from '../../core/fpsPatch/fpsPatch'
import type { SettingsStore } from '@main/settings/fileSettingsStore'

export type DownloadFile = (url: string, targetPath: string) => Promise<void>

export interface FpsPatchService {
  getStatus(): Promise<FpsPatchStatus>
  install(): Promise<FpsPatchInstallResult>
}

export function createFpsPatchService(
  getUserDataPath: () => string,
  settingsStore: SettingsStore,
  downloadFile: DownloadFile
): FpsPatchService {
  const getTempDir = () => join(getUserDataPath(), 'downloads', 'fps-patch')

  return {
    async getStatus() {
      const settings = await settingsStore.get()
      if (!settings.wowPath) return createMissingStatus('')

      const plan = createFpsPatchInstallPlan(settings.wowPath, getTempDir())
      return readFpsPatchStatus(plan.targetPath)
    },
    async install() {
      const settings = await settingsStore.get()
      if (!settings.wowPath) throw new Error('Сначала выберите папку WoW')

      const plan = createFpsPatchInstallPlan(settings.wowPath, getTempDir())
      await mkdir(dirname(plan.targetPath), { recursive: true })
      await mkdir(dirname(plan.tempPath), { recursive: true })
      await rm(plan.tempPath, { force: true })

      const sourceUrl = await downloadWithFallback(plan.sourceUrls, plan.tempPath, downloadFile)
      await rm(plan.targetPath, { force: true })
      await rename(plan.tempPath, plan.targetPath)

      return {
        status: await readFpsPatchStatus(plan.targetPath),
        sourceUrl
      }
    }
  }
}

async function readFpsPatchStatus(patchPath: string): Promise<FpsPatchStatus> {
  try {
    const patchStat = await stat(patchPath)

    return {
      installed: patchStat.isFile(),
      patchPath,
      size: patchStat.size,
      updatedAt: patchStat.mtime.toISOString(),
      sourceUrls: [...fpsPatchSourceUrls]
    }
  } catch {
    return createMissingStatus(patchPath)
  }
}

function createMissingStatus(patchPath: string): FpsPatchStatus {
  return {
    installed: false,
    patchPath,
    sourceUrls: [...fpsPatchSourceUrls]
  }
}

async function downloadWithFallback(
  sourceUrls: string[],
  tempPath: string,
  downloadFile: DownloadFile
): Promise<string> {
  const errors: string[] = []

  for (const sourceUrl of sourceUrls) {
    try {
      await downloadFile(sourceUrl, tempPath)
      return sourceUrl
    } catch (error) {
      await rm(tempPath, { force: true })
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  throw new Error(`Не удалось скачать FPS-патч: ${errors.join('; ')}`)
}
