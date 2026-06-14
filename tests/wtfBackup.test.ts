import { describe, expect, it } from 'vitest'
import {
	createWtfBackupFileName,
	createWtfBackupPlan,
	createWtfRestorePlan
} from '../src/core/backup/wtfBackup'

describe('wtf backup core', () => {
	it('creates stable backup file name', () => {
		expect(createWtfBackupFileName(new Date('2026-06-14T10:20:30.000Z'))).toBe(
			'wtf-backup-2026-06-14-10-20-30.zip'
		)
	})

	it('creates backup plan from wow path and backups dir', () => {
		const plan = createWtfBackupPlan(
			'F:/games/sirus/World of Warcraft Sirus',
			'C:/Users/fxpw/AppData/Roaming/launcher/backups/wtf',
			new Date('2026-06-14T10:20:30.000Z')
		)

		expect(plan.sourceDir).toMatch(/World of Warcraft Sirus[\\/]WTF$/)
		expect(plan.archivePath).toMatch(/wtf-backup-2026-06-14-10-20-30\.zip$/)
		expect(plan.createdAt).toBe('2026-06-14T10:20:30.000Z')
	})

	it('creates restore plan with safety backup', () => {
		const plan = createWtfRestorePlan(
			'F:/games/sirus/World of Warcraft Sirus',
			'C:/launcher/backups/wtf',
			'C:/launcher/backups/wtf/wtf-backup-2026-06-14-10-20-30.zip',
			new Date('2026-06-15T10:20:30.000Z')
		)

		expect(plan.targetDir).toMatch(/World of Warcraft Sirus[\\/]WTF$/)
		expect(plan.archivePath).toMatch(/wtf-backup-2026-06-14-10-20-30\.zip$/)
		expect(plan.safetyBackupPlan.fileName).toBe('wtf-backup-2026-06-15-10-20-30.zip')
	})
})
