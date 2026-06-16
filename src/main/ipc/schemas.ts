import { z } from 'zod'

export const voidInputSchema = z.undefined()
export const voidOutputSchema = z.undefined()

export const appInfoSchema = z.object({
	name: z.string(),
	version: z.string()
})

export const releaseAssetSchema = z.object({
	name: z.string(),
	downloadUrl: z.string(),
	size: z.number().optional()
})

export const appReleaseSchema = z.object({
	version: z.string(),
	url: z.string(),
	notes: z.string().optional(),
	prerelease: z.boolean(),
	assets: z.array(releaseAssetSchema)
})

export const appUpdateCheckSchema = z.object({
	currentVersion: z.string(),
	latest: appReleaseSchema.optional(),
	updateAvailable: z.boolean()
})

export const appUpdateInstallResultSchema = z.object({
	installedAt: z.string(),
	version: z.string(),
	asset: releaseAssetSchema,
	downloadedPath: z.string()
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
	autoUpdateAddons: z.boolean(),
	allowPrereleaseUpdates: z.boolean()
})

export const launcherSettingsPatchSchema = z
	.object({
		wowPath: z.string().optional(),
		closeOnLaunch: z.boolean().optional(),
		checkClientBeforeLaunch: z.boolean().optional(),
		autoUpdateAddons: z.boolean().optional(),
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

export const accountSummarySchema = z.object({
	id: z.string(),
	login: z.string()
})

export const accountListResultSchema = z.object({
	accounts: z.array(accountSummarySchema),
	selectedAccountId: z.string().optional()
})

export const addAccountInputSchema = z
	.object({
		login: z.string().trim().min(1, 'Логин аккаунта пустой'),
		password: z.string().min(1, 'Пароль аккаунта пустой')
	})
	.strict()

export const selectAccountInputSchema = z
	.object({
		accountId: z.string().min(1)
	})
	.strict()

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
	freshness: z.enum(['missing', 'latest', 'outdated', 'unknown']),
	localHash: z.string().optional(),
	remoteBuild: z.number().optional(),
	remoteHash: z.string().optional(),
	remoteSize: z.number().optional(),
	remoteUpdatedAt: z.string().optional(),
	remoteSourceUrl: z.string().optional(),
	checkError: z.string().optional(),
	sourceUrls: z.array(z.string())
})

export const fpsPatchInstallResultSchema = z.object({
	status: fpsPatchStatusSchema,
	sourceUrl: z.string()
})

export const fpsPatchDeleteResultSchema = z.object({
	status: fpsPatchStatusSchema,
	deleted: z.boolean()
})

export const gameLaunchResultSchema = z.object({
	launchedAt: z.string(),
	executablePath: z.string()
})

export const clientPatchFileStatusSchema = z.enum(['ok', 'missing', 'outdated'])

export const clientPatchCheckFileSchema = z.object({
	fileName: z.string(),
	relativePath: z.string(),
	targetPath: z.string(),
	expectedMd5: z.string(),
	actualMd5: z.string().optional(),
	expectedSize: z.number(),
	actualSize: z.number().optional(),
	downloadUrl: z.string(),
	status: clientPatchFileStatusSchema
})

export const clientPatchManifestFileSchema = z.object({
	fileName: z.string(),
	relativePath: z.string(),
	targetPath: z.string(),
	expectedMd5: z.string(),
	expectedSize: z.number(),
	downloadUrl: z.string(),
	updatedAt: z.string().optional()
})

export const clientPatchManifestResultSchema = z.object({
	loadedAt: z.string(),
	sourceUrl: z.string(),
	availableSourceUrls: z.array(z.string()),
	total: z.number(),
	files: z.array(clientPatchManifestFileSchema)
})

export const clientCheckResultSchema = z.object({
	checkedAt: z.string(),
	sourceUrl: z.string(),
	availableSourceUrls: z.array(z.string()),
	total: z.number(),
	ok: z.number(),
	missing: z.number(),
	outdated: z.number(),
	files: z.array(clientPatchCheckFileSchema)
})

export const clientPatchFileInputSchema = z
	.object({
		fileName: z.string().min(1),
		relativePath: z.string(),
		sourceUrl: z.string().optional()
	})
	.strict()

export const clientPatchSourceInputSchema = z
	.object({
		sourceUrl: z.string().optional()
	})
	.strict()
	.optional()

export const clientPatchDownloadResultSchema = z.object({
	downloadedAt: z.string(),
	file: clientPatchCheckFileSchema
})

export const clientPatchDownloadAllResultSchema = z.object({
	downloadedAt: z.string(),
	total: z.number(),
	files: z.array(clientPatchCheckFileSchema)
})

export const addonCatalogSourceSchema = z.enum(['community', 'sirus', 'custom'])
export const addonStatusSchema = z.enum([
	'not-installed',
	'installed',
	'outdated',
	'manual-git',
	'unknown'
])

export const addonCatalogEntrySchema = z.object({
	id: z.string(),
	source: addonCatalogSourceSchema,
	name: z.string(),
	versionUrl: z.string().optional(),
	versionFolder: z.string().optional(),
	versionFile: z.string().optional(),
	branch: z.string(),
	folders: z.array(z.string()),
	description: z.string().optional(),
	githubUrl: z.string().optional(),
	repo: z.string().optional(),
	forumUrl: z.string().optional(),
	bugReportUrl: z.string().optional(),
	author: z.string().optional(),
	category: z.string().optional()
})

export const addonSummarySchema = addonCatalogEntrySchema.extend({
	status: addonStatusSchema,
	installedVersion: z.string().optional(),
	remoteVersion: z.string().optional(),
	installedFolders: z.array(z.string()),
	missingFolders: z.array(z.string()),
	gitFolders: z.array(z.string()),
	error: z.string().optional()
})

export const addonsListResultSchema = z.object({
	loadedAt: z.string(),
	total: z.number(),
	community: z.number(),
	sirus: z.number(),
	custom: z.number(),
	addons: z.array(addonSummarySchema)
})

export const addonActionInputSchema = z
	.object({
		addonId: z.string().min(1)
	})
	.strict()

export const addonInstallResultSchema = z.object({
	installedAt: z.string(),
	addon: addonSummarySchema,
	installedFolders: z.array(z.string()),
	skippedGitFolders: z.array(z.string())
})

export const addonDeleteResultSchema = z.object({
	deletedAt: z.string(),
	addon: addonSummarySchema,
	deletedFolders: z.array(z.string())
})

export const addonsUpdateAllResultSchema = z.object({
	updatedAt: z.string(),
	total: z.number(),
	installed: z.array(addonInstallResultSchema),
	skipped: z.array(addonSummarySchema)
})

export const customAddonsTransferResultSchema = z
	.object({
		filePath: z.string(),
		total: z.number(),
		addons: z.array(addonCatalogEntrySchema)
	})
	.optional()

export const miningStatusSchema = z.enum(['not-configured', 'stopped', 'running', 'failed'])

export const miningConfigSchema = z.object({
	consentAccepted: z.boolean(),
	minerPath: z.string(),
	arguments: z.string(),
	poolUrl: z.string(),
	walletAddress: z.string(),
	workerName: z.string(),
	coinSymbol: z.string()
})

export const miningConfigInputSchema = z
	.object({
		consentAccepted: z.boolean().optional(),
		minerPath: z.string().optional(),
		arguments: z.string().optional(),
		poolUrl: z.string().optional(),
		walletAddress: z.string().optional(),
		workerName: z.string().optional(),
		coinSymbol: z.string().optional()
	})
	.strict()

export const minerPathInputSchema = z.string()

export const miningStateSchema = z.object({
	status: miningStatusSchema,
	config: miningConfigSchema,
	commandPreview: z.string(),
	startedAt: z.string().optional(),
	stoppedAt: z.string().optional(),
	hashrate: z.string(),
	acceptedSharesTotal: z.number(),
	acceptedSharesSession: z.number(),
	receivedTotal: z.number(),
	receivedSession: z.number(),
	lastOutput: z.string(),
	error: z.string().optional()
})

export const addCustomAddonInputSchema = z
	.object({
		name: z.string().trim().min(1, 'Название аддона пустое'),
		githubUrl: z.string().trim().url('Нужна ссылка на GitHub репозиторий'),
		branch: z.string().trim().optional(),
		folders: z.array(z.string().trim().min(1)).optional(),
		versionUrl: z.string().trim().url().optional(),
		versionFolder: z.string().trim().min(1).optional(),
		versionFile: z.string().trim().min(1).optional(),
		description: z.string().trim().optional()
	})
	.strict()
