import { z } from 'zod'

export const voidInputSchema = z.undefined()
export const voidOutputSchema = z.undefined()

export const appInfoSchema = z.object({
	name: z.string(),
	version: z.string()
})

export const githubTokenStatusSchema = z.object({
	configured: z.boolean()
})

export const githubTokenInputSchema = z.object({
	token: z.string().trim().min(1, 'GitHub token пустой')
})

export const launcherSettingsSchema = z.object({
	wowPath: z.string(),
	closeOnLaunch: z.boolean(),
	checkClientBeforeLaunch: z.boolean(),
	allowPrereleaseUpdates: z.boolean()
})

export const launcherSettingsPatchSchema = z
	.object({
		wowPath: z.string().optional(),
		closeOnLaunch: z.boolean().optional(),
		checkClientBeforeLaunch: z.boolean().optional(),
		allowPrereleaseUpdates: z.boolean().optional()
	})
	.strict()

export const wowPathInputSchema = z.string()

export const wowPathValidationSchema = z.object({
	wowPath: z.string(),
	valid: z.boolean(),
	executablePath: z.string(),
	dataPath: z.string(),
	localeDataPath: z.string(),
	interfacePath: z.string(),
	addonsPath: z.string(),
	wtfPath: z.string(),
	configWtfPath: z.string(),
	missing: z.array(z.string())
})

export const accountConfigInputSchema = z.object({
	configText: z.string(),
	login: z.string(),
	password: z.string()
})

export const accountConfigPreviewSchema = z.object({
  changed: z.boolean(),
  text: z.string(),
  touchedKeys: z.array(z.string())
})

export const wtfBackupSummarySchema = z.object({
  id: z.string(),
  fileName: z.string(),
  archivePath: z.string(),
  size: z.number(),
  createdAt: z.string()
})

export const wtfBackupListSchema = z.array(wtfBackupSummarySchema)

export const createWtfBackupResultSchema = z.object({
  backup: wtfBackupSummarySchema
})

export const wtfBackupActionInputSchema = z.object({
  id: z.string().min(1)
})

export const restoreWtfBackupResultSchema = z.object({
  restored: wtfBackupSummarySchema,
  safetyBackup: wtfBackupSummarySchema
})

export const deleteWtfBackupResultSchema = z.object({
  deletedId: z.string()
})

export const fpsPatchStatusSchema = z.object({
  installed: z.boolean(),
  patchPath: z.string(),
  size: z.number().optional(),
  updatedAt: z.string().optional(),
  sourceUrls: z.array(z.string())
})

export const fpsPatchInstallResultSchema = z.object({
  status: fpsPatchStatusSchema,
  sourceUrl: z.string()
})
