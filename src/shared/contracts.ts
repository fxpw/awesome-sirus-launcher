export const launcherReleasesUrl = 'https://github.com/fxpw/awesome-sirus-launcher/releases'

export const ipcChannels = {
	app: {
		getInfo: 'app:get-info',
		checkUpdate: 'app:check-update',
		installUpdate: 'app:install-update'
	},
	github: {
		getTokenStatus: 'github:get-token-status',
		saveToken: 'github:save-token',
		clearToken: 'github:clear-token'
	},
	settings: {
		get: 'settings:get',
		save: 'settings:save',
		selectWowPath: 'settings:select-wow-path',
		selectWtfBackupPath: 'settings:select-wtf-backup-path'
	},
	backup: {
		listWtf: 'backup:list-wtf',
		createWtf: 'backup:create-wtf',
		restoreWtf: 'backup:restore-wtf',
		deleteWtf: 'backup:delete-wtf',
		openWtfFolder: 'backup:open-wtf-folder'
	},
	accounts: {
		list: 'accounts:list',
		add: 'accounts:add',
		select: 'accounts:select'
	},
	fpsPatch: {
		getStatus: 'fps-patch:get-status',
		install: 'fps-patch:install',
		delete: 'fps-patch:delete'
	},
	client: {
		list: 'client:list',
		check: 'client:check',
		cancelCheck: 'client:cancel-check',
		clearCheckCache: 'client:clear-check-cache',
		downloadFile: 'client:download-file',
		downloadMissing: 'client:download-missing'
	},
	addons: {
		list: 'addons:list',
		check: 'addons:check',
		install: 'addons:install',
		delete: 'addons:delete',
		updateAll: 'addons:update-all',
		addCustom: 'addons:add-custom',
		exportCustom: 'addons:export-custom',
		importCustom: 'addons:import-custom'
	},
	mining: {
		getState: 'mining:get-state',
		saveConfig: 'mining:save-config',
		selectMinerPath: 'mining:select-miner-path',
		start: 'mining:start',
		stop: 'mining:stop',
		resetStats: 'mining:reset-stats'
	},
	wow: {
		validatePath: 'wow:validate-path',
		previewAccountConfig: 'wow:preview-account-config',
		launchGame: 'wow:launch-game'
	}
} as const

export const clientPatchSourceUrls = [
	'https://s-patches.pro/api/client/patches',
	'https://s-patches.ru/api/client/patches',
	'https://sirus.world/api/client/patches'
] as const

export interface AppInfo {
	name: string
	version: string
}

export interface GitHubTokenStatus {
	configured: boolean
}

export interface GitHubRateLimit {
	limit?: number
	remaining?: number
	resetAt?: string
}

export interface GitHubTokenInput {
	token: string
}

export interface LauncherSettings {
	wowPath: string
	wtfBackupPath: string
	closeOnLaunch: boolean
	checkClientBeforeLaunch: boolean
	autoUpdateAddons: boolean
	allowPrereleaseUpdates: boolean
}

export type LauncherSettingsPatch = Partial<LauncherSettings>

export interface WowPathValidation {
	wowPath: string
	valid: boolean
	executablePath: string
	dataPath: string
	localeDataPath: string
	interfacePath: string
	addonsPath: string
	wtfPath: string
	configWtfPath: string
	missing: string[]
}

export interface AccountConfigInput {
	configText: string
	login: string
	password: string
}

export interface AccountConfigPreview {
	changed: boolean
	text: string
	touchedKeys: string[]
}

export interface AccountSummary {
	id: string
	login: string
}

export interface AccountListResult {
	accounts: AccountSummary[]
	selectedAccountId?: string
}

export interface AddAccountInput {
	login: string
	password: string
}

export interface SelectAccountInput {
	accountId: string
}

export interface ReleaseAsset {
	name: string
	downloadUrl: string
	size?: number
}

export interface AppRelease {
	version: string
	url: string
	notes?: string
	prerelease: boolean
	assets: ReleaseAsset[]
}

export interface AppUpdateCheck {
	currentVersion: string
	latest?: AppRelease
	updateAvailable: boolean
}

export interface AppUpdateInstallResult {
	installedAt: string
	version: string
	asset: ReleaseAsset
	downloadedPath: string
}

export interface WtfBackupSummary {
	id: string
	fileName: string
	archivePath: string
	size: number
	createdAt: string
}

export interface CreateWtfBackupResult {
	backup: WtfBackupSummary
}

export interface WtfBackupActionInput {
	id: string
}

export interface RestoreWtfBackupResult {
	restored: WtfBackupSummary
	safetyBackup: WtfBackupSummary
}

export interface DeleteWtfBackupResult {
	deletedId: string
}

export type FpsPatchFreshness = 'missing' | 'latest' | 'outdated' | 'unknown'

export interface FpsPatchStatus {
	installed: boolean
	patchPath: string
	size?: number
	updatedAt?: string
	freshness: FpsPatchFreshness
	localHash?: string
	remoteBuild?: number
	remoteHash?: string
	remoteSize?: number
	remoteUpdatedAt?: string
	remoteSourceUrl?: string
	checkError?: string
	sourceUrls: string[]
}

export interface FpsPatchInstallResult {
	status: FpsPatchStatus
	sourceUrl: string
}

export interface FpsPatchDeleteResult {
	status: FpsPatchStatus
	deleted: boolean
}

export interface GameLaunchResult {
	launchedAt: string
	executablePath: string
}

export type ClientPatchFileStatus = 'ok' | 'missing' | 'outdated'

export interface ClientPatchCheckFile {
	fileName: string
	relativePath: string
	targetPath: string
	expectedMd5: string
	actualMd5?: string
	expectedSize: number
	actualSize?: number
	downloadUrl: string
	status: ClientPatchFileStatus
}

export interface ClientPatchManifestFile {
	fileName: string
	relativePath: string
	targetPath: string
	expectedMd5: string
	expectedSize: number
	downloadUrl: string
	updatedAt?: string
}

export interface ClientPatchManifestResult {
	loadedAt: string
	sourceUrl: string
	availableSourceUrls: string[]
	total: number
	files: ClientPatchManifestFile[]
}

export interface ClientCheckResult {
	checkedAt: string
	sourceUrl: string
	availableSourceUrls: string[]
	total: number
	ok: number
	missing: number
	outdated: number
	files: ClientPatchCheckFile[]
}

export interface ClientPatchFileInput {
	fileName: string
	relativePath: string
	sourceUrl?: string
}

export interface ClientPatchSourceInput {
	sourceUrl?: string
}

export interface ClientPatchDownloadResult {
	downloadedAt: string
	file: ClientPatchCheckFile
}

export interface ClientPatchDownloadAllResult {
	downloadedAt: string
	total: number
	files: ClientPatchCheckFile[]
}

export type AddonCatalogSource = 'community' | 'sirus' | 'custom'
export type AddonStatus = 'not-installed' | 'installed' | 'outdated' | 'manual-git' | 'unknown'

export interface AddonCatalogEntry {
	id: string
	source: AddonCatalogSource
	name: string
	versionUrl?: string
	versionFolder?: string
	versionFile?: string
	branch: string
	folders: string[]
	description?: string
	githubUrl?: string
	repo?: string
	forumUrl?: string
	bugReportUrl?: string
	author?: string
	category?: string
}

export interface AddonSummary extends AddonCatalogEntry {
	status: AddonStatus
	installedVersion?: string
	remoteVersion?: string
	installedFolders: string[]
	missingFolders: string[]
	gitFolders: string[]
	error?: string
}

export interface AddonsListResult {
	loadedAt: string
	total: number
	community: number
	sirus: number
	custom: number
	addons: AddonSummary[]
}

export interface AddonActionInput {
	addonId: string
}

export interface AddonInstallResult {
	installedAt: string
	addon: AddonSummary
	installedFolders: string[]
	skippedGitFolders: string[]
}

export interface AddonDeleteResult {
	deletedAt: string
	addon: AddonSummary
	deletedFolders: string[]
}

export interface AddonsUpdateAllResult {
	updatedAt: string
	total: number
	installed: AddonInstallResult[]
	skipped: AddonSummary[]
}

export interface CustomAddonsTransferResult {
	filePath: string
	total: number
	addons: AddonCatalogEntry[]
}

export type MiningStatus = 'not-configured' | 'stopped' | 'running' | 'failed'

export interface MiningConfig {
	consentAccepted: boolean
	minerPath: string
	arguments: string
	poolUrl: string
	walletAddress: string
	workerName: string
	coinSymbol: string
}

export type MiningConfigInput = Partial<MiningConfig>

export interface MiningState {
	status: MiningStatus
	config: MiningConfig
	commandPreview: string
	startedAt?: string
	stoppedAt?: string
	hashrate: string
	acceptedSharesTotal: number
	acceptedSharesSession: number
	receivedTotal: number
	receivedSession: number
	lastOutput: string
	error?: string
}

export interface AddCustomAddonInput {
	name: string
	githubUrl: string
	branch?: string
	folders?: string[]
	versionUrl?: string
	versionFolder?: string
	versionFile?: string
	description?: string
}

export interface LauncherApi {
	app: {
		getInfo(): Promise<AppInfo>
		checkUpdate(): Promise<AppUpdateCheck>
		installUpdate(): Promise<AppUpdateInstallResult>
	}
	github: {
		getTokenStatus(): Promise<GitHubTokenStatus>
		saveToken(input: GitHubTokenInput): Promise<GitHubTokenStatus>
		clearToken(): Promise<GitHubTokenStatus>
	}
	settings: {
		get(): Promise<LauncherSettings>
		save(patch: LauncherSettingsPatch): Promise<LauncherSettings>
		selectWowPath(): Promise<LauncherSettings>
		selectWtfBackupPath(): Promise<LauncherSettings>
	}
	backup: {
		listWtf(): Promise<WtfBackupSummary[]>
		createWtf(): Promise<CreateWtfBackupResult>
		restoreWtf(input: WtfBackupActionInput): Promise<RestoreWtfBackupResult>
		deleteWtf(input: WtfBackupActionInput): Promise<DeleteWtfBackupResult>
		openWtfFolder(): Promise<void>
	}
	accounts: {
		list(): Promise<AccountListResult>
		add(input: AddAccountInput): Promise<AccountListResult>
		select(input: SelectAccountInput): Promise<AccountListResult>
	}
	fpsPatch: {
		getStatus(): Promise<FpsPatchStatus>
		install(): Promise<FpsPatchInstallResult>
		delete(): Promise<FpsPatchDeleteResult>
	}
	client: {
		list(input?: ClientPatchSourceInput): Promise<ClientPatchManifestResult>
		check(input?: ClientPatchSourceInput): Promise<ClientCheckResult>
		cancelCheck(): Promise<void>
		clearCheckCache(): Promise<void>
		downloadFile(input: ClientPatchFileInput): Promise<ClientPatchDownloadResult>
		downloadMissing(input?: ClientPatchSourceInput): Promise<ClientPatchDownloadAllResult>
	}
	addons: {
		list(): Promise<AddonsListResult>
		check(): Promise<AddonsListResult>
		install(input: AddonActionInput): Promise<AddonInstallResult>
		delete(input: AddonActionInput): Promise<AddonDeleteResult>
		updateAll(): Promise<AddonsUpdateAllResult>
		addCustom(input: AddCustomAddonInput): Promise<AddonsListResult>
		exportCustom(): Promise<CustomAddonsTransferResult | undefined>
		importCustom(): Promise<CustomAddonsTransferResult | undefined>
	}
	mining: {
		getState(): Promise<MiningState>
		saveConfig(input: MiningConfigInput): Promise<MiningState>
		selectMinerPath(): Promise<MiningState>
		start(): Promise<MiningState>
		stop(): Promise<MiningState>
		resetStats(): Promise<MiningState>
	}
	wow: {
		validatePath(wowPath: string): Promise<WowPathValidation>
		previewAccountConfig(input: AccountConfigInput): Promise<AccountConfigPreview>
		launchGame(): Promise<GameLaunchResult>
	}
}
