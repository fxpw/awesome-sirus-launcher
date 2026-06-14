import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
	createWtfBackupResultSchema,
	deleteWtfBackupResultSchema,
	fpsPatchInstallResultSchema,
	fpsPatchStatusSchema,
	githubTokenInputSchema,
	launcherSettingsPatchSchema,
	restoreWtfBackupResultSchema,
	wtfBackupActionInputSchema,
	wtfBackupListSchema,
	wowPathValidationSchema
} from '../src/main/ipc/schemas'

describe('ipc schemas', () => {
	it('normalizes GitHub token input', () => {
		expect(githubTokenInputSchema.parse({ token: '  token  ' })).toEqual({ token: 'token' })
	})

	it('rejects unknown settings keys', () => {
		expect(() => launcherSettingsPatchSchema.parse({ unknown: true })).toThrow(ZodError)
	})

	it('validates wow path output shape', () => {
		expect(
			wowPathValidationSchema.parse({
				wowPath: 'F:/wow',
				valid: false,
				executablePath: 'F:/wow/Wow.exe',
				dataPath: 'F:/wow/Data',
				localeDataPath: 'F:/wow/Data/ruRU',
				interfacePath: 'F:/wow/Interface',
				addonsPath: 'F:/wow/Interface/AddOns',
				wtfPath: 'F:/wow/WTF',
				configWtfPath: 'F:/wow/WTF/Config.wtf',
				missing: ['Wow.exe']
			})
		).toMatchObject({
			valid: false,
			missing: ['Wow.exe']
		})
	})

	it('validates backup output shapes', () => {
		const backup = {
			id: 'wtf-backup-2026-06-14-10-20-30.zip',
			fileName: 'wtf-backup-2026-06-14-10-20-30.zip',
			archivePath: 'C:/launcher/backups/wtf-backup-2026-06-14-10-20-30.zip',
			size: 1024,
			createdAt: '2026-06-14T10:20:30.000Z'
		}

		expect(wtfBackupListSchema.parse([backup])).toEqual([backup])
		expect(createWtfBackupResultSchema.parse({ backup })).toEqual({ backup })
		expect(wtfBackupActionInputSchema.parse({ id: backup.id })).toEqual({ id: backup.id })
		expect(restoreWtfBackupResultSchema.parse({ restored: backup, safetyBackup: backup })).toEqual({
			restored: backup,
			safetyBackup: backup
		})
		expect(deleteWtfBackupResultSchema.parse({ deletedId: backup.id })).toEqual({
			deletedId: backup.id
		})
	})

	it('validates fps patch output shapes', () => {
		const status = {
			installed: true,
			patchPath: 'F:/wow/Data/ruRU/patch-ruRU-[.mpq',
			size: 2048,
			updatedAt: '2026-06-14T10:20:30.000Z',
			sourceUrls: ['https://example.test/patch.mpq']
		}

		expect(fpsPatchStatusSchema.parse(status)).toEqual(status)
		expect(fpsPatchInstallResultSchema.parse({ status, sourceUrl: status.sourceUrls[0] })).toEqual({
			status,
			sourceUrl: status.sourceUrls[0]
		})
	})
})
