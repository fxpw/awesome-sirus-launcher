import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createFpsPatchInstallPlan,
  fpsPatchFileName,
  fpsPatchSourceUrls
} from '../src/core/fpsPatch/fpsPatch'
import { createFpsPatchService, type DownloadFile } from '../src/main/fpsPatch/fpsPatchService'
import type { SettingsStore } from '../src/main/settings/fileSettingsStore'
import type { LauncherSettings } from '../src/shared/contracts'

describe('fps patch core', () => {
  it('creates install plan for WoW locale data directory', () => {
    const plan = createFpsPatchInstallPlan(
      'F:/games/sirus/World of Warcraft Sirus',
      'C:/launcher/downloads/fps-patch'
    )

    expect(plan.targetPath).toMatch(/World of Warcraft Sirus[\\/]Data[\\/]ruRU[\\/]patch-ruRU-\[\.mpq$/)
    expect(plan.tempPath).toMatch(/patch-ruRU-\[\.mpq\.tmp$/)
    expect(plan.sourceUrls).toEqual([...fpsPatchSourceUrls])
  })
})

describe('fps patch service', () => {
  it('downloads through fallback and installs patch atomically', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sirus-fps-patch-'))
    const wowPath = join(root, 'wow')
    const userDataPath = join(root, 'user-data')
    await mkdir(join(wowPath, 'Data', 'ruRU'), { recursive: true })

    const triedUrls: string[] = []
    const downloadFile: DownloadFile = async (url, targetPath) => {
      triedUrls.push(url)
      if (triedUrls.length === 1) throw new Error('primary failed')
      await writeFile(targetPath, `downloaded from ${url}`)
    }

    const service = createFpsPatchService(
      () => userDataPath,
      createMemorySettingsStore({ wowPath }),
      downloadFile
    )

    const result = await service.install()
    const targetPath = join(wowPath, 'Data', 'ruRU', fpsPatchFileName)

    expect(triedUrls).toEqual([...fpsPatchSourceUrls])
    await expect(readFile(targetPath, 'utf8')).resolves.toBe(`downloaded from ${fpsPatchSourceUrls[1]}`)
    expect(result.sourceUrl).toBe(fpsPatchSourceUrls[1])
    expect(result.status.installed).toBe(true)
    expect(result.status.patchPath).toBe(targetPath)
    await expect(stat(targetPath)).resolves.toMatchObject({ size: result.status.size })
  })
})

function createMemorySettingsStore(patch: Partial<LauncherSettings>): SettingsStore {
  const settings: LauncherSettings = {
    wowPath: '',
    closeOnLaunch: false,
    checkClientBeforeLaunch: true,
    allowPrereleaseUpdates: false,
    ...patch
  }

  return {
    async get() {
      return settings
    },
    async save(nextPatch) {
      Object.assign(settings, nextPatch)
      return settings
    }
  }
}
