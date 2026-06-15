import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
	accountListResultSchema,
	addAccountInputSchema,
	clientCheckResultSchema,
	createWtfBackupResultSchema,
	deleteWtfBackupResultSchema,
	fpsPatchDeleteResultSchema,
	fpsPatchInstallResultSchema,
	fpsPatchStatusSchema,
	gameLaunchResultSchema,
	githubTokenInputSchema,
	launcherSettingsPatchSchema,
	miningConfigInputSchema,
	miningStateSchema,
	restoreWtfBackupResultSchema,
	selectAccountInputSchema,
	wtfBackupActionInputSchema,
	wtfBackupListSchema,
	wowPathValidationSchema
} from '../src/main/ipc/schemas'
import { clientPatchSourceUrls } from '../src/shared/contracts'

describe('ipc schemas', () => {
	it('normalizes GitHub token input', () => {
		expect(githubTokenInputSchema.parse({ token: '  token  ' })).toEqual({ token: 'token' })
	})

	it('rejects unknown settings keys', () => {
		expect(() => launcherSettingsPatchSchema.parse({ unknown: true })).toThrow(ZodError)
	})

	it('validates account input and output shapes', () => {
		const account = { id: 'account-1', login: 'fxpw' }

		expect(addAccountInputSchema.parse({ login: ' fxpw ', password: 'secret' })).toEqual({
			login: 'fxpw',
			password: 'secret'
		})
		expect(selectAccountInputSchema.parse({ accountId: account.id })).toEqual({
			accountId: account.id
		})
		expect(
			accountListResultSchema.parse({
				accounts: [account],
				selectedAccountId: account.id
			})
		).toEqual({
			accounts: [account],
			selectedAccountId: account.id
		})
	})

	it('validates wow path output shape', () => {
		expect(
			wowPathValidationSchema.parse({
				wowPath: 'F:/wow',
				valid: false,
				executablePath: 'F:/wow/run.exe',
				dataPath: 'F:/wow/Data',
				localeDataPath: 'F:/wow/Data/ruRU',
				interfacePath: 'F:/wow/Interface',
				addonsPath: 'F:/wow/Interface/AddOns',
				wtfPath: 'F:/wow/WTF',
				configWtfPath: 'F:/wow/WTF/Config.wtf',
				missing: ['run.exe']
			})
		).toMatchObject({
			valid: false,
			missing: ['run.exe']
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
		expect(
			restoreWtfBackupResultSchema.parse({ restored: backup, safetyBackup: backup })
		).toEqual({
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
			freshness: 'latest',
			remoteSize: 2048,
			remoteUpdatedAt: '2026-06-14T10:20:30.000Z',
			remoteSourceUrl: 'https://example.test/patch.mpq',
			sourceUrls: ['https://example.test/patch.mpq']
		}

		expect(fpsPatchStatusSchema.parse(status)).toEqual(status)
		expect(
			fpsPatchInstallResultSchema.parse({ status, sourceUrl: status.sourceUrls[0] })
		).toEqual({
			status,
			sourceUrl: status.sourceUrls[0]
		})
		expect(fpsPatchDeleteResultSchema.parse({ status, deleted: true })).toEqual({
			status,
			deleted: true
		})
	})

	it('validates game launch output shape', () => {
		const result = {
			launchedAt: '2026-06-14T10:20:30.000Z',
			executablePath: 'F:/wow/run.exe'
		}

		expect(gameLaunchResultSchema.parse(result)).toEqual(result)
	})

	it('validates mining input and output shapes', () => {
		const config = {
			consentAccepted: true,
			minerPath: 'C:/miners/miner.exe',
			arguments: '--server pool.example:3333 --user wallet.worker',
			poolUrl: 'pool.example:3333',
			walletAddress: 'wallet',
			workerName: 'worker',
			coinSymbol: 'COIN'
		}

		expect(miningConfigInputSchema.parse({ consentAccepted: true })).toEqual({
			consentAccepted: true
		})
		expect(
			miningStateSchema.parse({
				status: 'running',
				config,
				commandPreview: 'miner.exe --server pool.example:3333 --user wallet.worker',
				startedAt: '2026-06-14T10:20:30.000Z',
				hashrate: '42 MH/s',
				acceptedSharesTotal: 2,
				acceptedSharesSession: 1,
				receivedTotal: 0,
				receivedSession: 0,
				lastOutput: 'accepted'
			})
		).toMatchObject({ status: 'running', config })
	})

	it('validates client check output shape', () => {
		const file = {
			fileName: 'patch.mpq',
			relativePath: '/Data/',
			targetPath: 'F:/wow/Data/patch.mpq',
			expectedMd5: '6149eaf8791547a8f87454d687a46b29',
			actualMd5: '6149eaf8791547a8f87454d687a46b29',
			expectedSize: 10,
			actualSize: 10,
			downloadUrl: 'https://example.test/patch.mpq',
			status: 'ok'
		}

		expect(
			clientCheckResultSchema.parse({
				checkedAt: '2026-06-14T10:20:30.000Z',
				sourceUrl: 'https://s-patches.pro/api/client/patches',
				availableSourceUrls: [...clientPatchSourceUrls],
				total: 1,
				ok: 1,
				missing: 0,
				outdated: 0,
				files: [file]
			})
		).toMatchObject({ total: 1, files: [file] })
	})
})
