import { join, normalize, resolve } from 'node:path'
import { getWowPaths } from '../wow/wowPaths'

export interface WtfBackupPlan {
	sourceDir: string
	archivePath: string
	fileName: string
	createdAt: string
}

export interface WtfRestorePlan {
	targetDir: string
	archivePath: string
	safetyBackupPlan: WtfBackupPlan
}

export function createWtfBackupPlan(
	wowPath: string,
	backupsDir: string,
	date = new Date()
): WtfBackupPlan {
	const paths = getWowPaths(wowPath)
	const createdAt = date.toISOString()
	const fileName = createWtfBackupFileName(date)
	const archivePath = normalize(resolve(backupsDir, fileName))

	return {
		sourceDir: paths.wtfPath,
		archivePath,
		fileName,
		createdAt
	}
}

export function createWtfRestorePlan(
	wowPath: string,
	backupsDir: string,
	archivePath: string,
	date = new Date()
): WtfRestorePlan {
	const paths = getWowPaths(wowPath)

	return {
		targetDir: paths.wtfPath,
		archivePath: normalize(resolve(archivePath)),
		safetyBackupPlan: createWtfBackupPlan(wowPath, backupsDir, date)
	}
}

export function createWtfBackupFileName(date = new Date()): string {
	const stamp = date
		.toISOString()
		.replace(/\.\d{3}Z$/, '')
		.replace(/[-:T]/g, '-')

	return `wtf-backup-${stamp}.zip`
}

export function resolveWtfBackupsDir(wowPath: string, customPath?: string): string {
	const trimmedCustom = customPath?.trim()
	if (trimmedCustom) return normalize(resolve(trimmedCustom))

	const trimmedWow = wowPath.trim()
	if (!trimmedWow) return ''

	return normalize(join(resolve(trimmedWow), 'wtf_backup'))
}
