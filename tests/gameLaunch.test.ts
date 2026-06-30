import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createGameLaunchService } from '../src/main/launcher/gameLaunchService'
import type { SettingsStore } from '../src/main/settings/fileSettingsStore'
import type { LauncherSettings } from '../src/shared/contracts'

describe('game launch service', () => {
	it('launches validated run.exe from the selected wow path', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-game-launch-'))
		const wowPath = join(root, 'wow')
		await mkdir(join(wowPath, 'Data'), { recursive: true })
		await mkdir(join(wowPath, 'Interface'), { recursive: true })
		await mkdir(join(wowPath, 'WTF'), { recursive: true })
		await writeFile(join(wowPath, 'run.exe'), '')

		const launched: Array<{ executablePath: string; cwd: string }> = []
		const service = createGameLaunchService(
			createMemorySettingsStore({ wowPath }),
			async (executablePath, cwd) => {
				launched.push({ executablePath, cwd })
			}
		)

		const result = await service.launch()

		expect(launched).toEqual([{ executablePath: join(wowPath, 'run.exe'), cwd: wowPath }])
		expect(result.executablePath).toBe(join(wowPath, 'run.exe'))
	})

	it('rejects launch when run.exe is missing', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-game-launch-missing-'))
		const wowPath = join(root, 'wow')
		await mkdir(join(wowPath, 'Data'), { recursive: true })
		await mkdir(join(wowPath, 'Interface'), { recursive: true })
		await mkdir(join(wowPath, 'WTF'), { recursive: true })

		const service = createGameLaunchService(
			createMemorySettingsStore({ wowPath }),
			async () => undefined
		)

		await expect(service.launch()).rejects.toThrow('run.exe')
	})

	it('runs before-launch hook before starting run.exe', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-game-launch-account-'))
		const wowPath = join(root, 'wow')
		await mkdir(join(wowPath, 'Data'), { recursive: true })
		await mkdir(join(wowPath, 'Interface'), { recursive: true })
		await mkdir(join(wowPath, 'WTF'), { recursive: true })
		await writeFile(join(wowPath, 'run.exe'), '')

		const calls: string[] = []
		const service = createGameLaunchService(
			createMemorySettingsStore({ wowPath }),
			async () => {
				calls.push('launch')
			},
			async (nextWowPath) => {
				expect(nextWowPath).toBe(wowPath)
				calls.push('before')
			}
		)

		await service.launch()

		expect(calls).toEqual(['before', 'launch'])
	})
})

function createMemorySettingsStore(patch: Partial<LauncherSettings>): SettingsStore {
	const settings: LauncherSettings = {
		wowPath: '',
		wtfBackupPath: '',
		closeOnLaunch: false,
		checkClientBeforeLaunch: true,
		autoUpdateAddons: false,
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
