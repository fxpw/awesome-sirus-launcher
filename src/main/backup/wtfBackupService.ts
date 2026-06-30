import { mkdir, readdir, rm, stat, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type {
	CreateWtfBackupResult,
	DeleteWtfBackupResult,
	RestoreWtfBackupResult,
	WtfBackupActionInput,
	WtfBackupSummary
} from '@shared/contracts'
import {
	createWtfBackupPlan,
	createWtfRestorePlan,
	resolveWtfBackupsDir
} from '@core/backup/wtfBackup'
import type { SettingsStore } from '@main/settings/fileSettingsStore'
import { unzipToDirectory } from '@main/archive/unzipToDirectory'
import { zipDirectory } from '@main/archive/zipDirectory'

export interface WtfBackupService {
	list(): Promise<WtfBackupSummary[]>
	create(): Promise<CreateWtfBackupResult>
	restore(input: WtfBackupActionInput): Promise<RestoreWtfBackupResult>
	delete(input: WtfBackupActionInput): Promise<DeleteWtfBackupResult>
	getBackupsDir(): Promise<string>
}

export function createWtfBackupService(settingsStore: SettingsStore): WtfBackupService {
	async function getBackupsDir(): Promise<string> {
		const settings = await settingsStore.get()
		const backupsDir = resolveWtfBackupsDir(settings.wowPath, settings.wtfBackupPath)
		if (!backupsDir) {
			throw new Error('Сначала укажите папку WoW или выберите папку для бекапов WTF')
		}

		return backupsDir
	}

	return {
		async list() {
			const backupsDir = await getBackupsDir()
			return listWtfBackups(backupsDir)
		},
		async create() {
			const settings = await settingsStore.get()
			if (!settings.wowPath) throw new Error('Сначала выберите папку WoW')

			const backupsDir = await getBackupsDir()
			const plan = createWtfBackupPlan(settings.wowPath, backupsDir)
			await zipDirectory(plan.sourceDir, plan.archivePath)
			const fileStat = await stat(plan.archivePath)

			return {
				backup: {
					id: plan.fileName,
					fileName: plan.fileName,
					archivePath: plan.archivePath,
					size: fileStat.size,
					createdAt: plan.createdAt
				}
			}
		},
		async restore(input) {
			const settings = await settingsStore.get()
			if (!settings.wowPath) throw new Error('Сначала выберите папку WoW')

			const backupsDir = await getBackupsDir()
			const restored = await getWtfBackupById(backupsDir, input.id)
			const plan = createWtfRestorePlan(settings.wowPath, backupsDir, restored.archivePath)
			await zipDirectory(plan.safetyBackupPlan.sourceDir, plan.safetyBackupPlan.archivePath)
			const safetyBackupStat = await stat(plan.safetyBackupPlan.archivePath)

			await rm(plan.targetDir, { recursive: true, force: true })
			await mkdir(plan.targetDir, { recursive: true })
			await unzipToDirectory(plan.archivePath, plan.targetDir)

			return {
				restored,
				safetyBackup: {
					id: plan.safetyBackupPlan.fileName,
					fileName: plan.safetyBackupPlan.fileName,
					archivePath: plan.safetyBackupPlan.archivePath,
					size: safetyBackupStat.size,
					createdAt: plan.safetyBackupPlan.createdAt
				}
			}
		},
		async delete(input) {
			const backupsDir = await getBackupsDir()
			const backup = await getWtfBackupById(backupsDir, input.id)
			await unlink(backup.archivePath)

			return {
				deletedId: backup.id
			}
		},
		getBackupsDir
	}
}

async function listWtfBackups(backupsDir: string): Promise<WtfBackupSummary[]> {
	await mkdir(backupsDir, { recursive: true })
	const entries = await readdir(backupsDir, { withFileTypes: true })
	const backups = await Promise.all(
		entries
			.filter((entry) => entry.isFile() && entry.name.endsWith('.zip'))
			.map(async (entry) => {
				const archivePath = join(backupsDir, entry.name)
				const fileStat = await stat(archivePath)

				return {
					id: entry.name,
					fileName: entry.name,
					archivePath,
					size: fileStat.size,
					createdAt: fileStat.birthtime.toISOString()
				}
			})
	)

	return backups.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

async function getWtfBackupById(backupsDir: string, id: string): Promise<WtfBackupSummary> {
	if (!id.endsWith('.zip') || id.includes('/') || id.includes('\\')) {
		throw new Error('Некорректный backup id')
	}

	const archivePath = resolve(backupsDir, id)
	const backups = await listWtfBackups(backupsDir)
	const backup = backups.find((item) => resolve(item.archivePath) === archivePath)
	if (!backup) throw new Error('Backup WTF не найден')

	return backup
}
