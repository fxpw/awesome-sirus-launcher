export const ipcChannels = {
  app: {
    getInfo: 'app:get-info',
    checkUpdate: 'app:check-update'
  },
  github: {
    getTokenStatus: 'github:get-token-status',
    saveToken: 'github:save-token',
    clearToken: 'github:clear-token'
  },
  settings: {
    get: 'settings:get',
    save: 'settings:save',
    selectWowPath: 'settings:select-wow-path'
  },
  backup: {
    listWtf: 'backup:list-wtf',
    createWtf: 'backup:create-wtf',
    restoreWtf: 'backup:restore-wtf',
    deleteWtf: 'backup:delete-wtf',
    openWtfFolder: 'backup:open-wtf-folder'
  },
  wow: {
    validatePath: 'wow:validate-path',
    previewAccountConfig: 'wow:preview-account-config'
  }
} as const

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
  closeOnLaunch: boolean
  checkClientBeforeLaunch: boolean
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

export interface LauncherApi {
  app: {
    getInfo(): Promise<AppInfo>
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
  }
  backup: {
    listWtf(): Promise<WtfBackupSummary[]>
    createWtf(): Promise<CreateWtfBackupResult>
    restoreWtf(input: WtfBackupActionInput): Promise<RestoreWtfBackupResult>
    deleteWtf(input: WtfBackupActionInput): Promise<DeleteWtfBackupResult>
    openWtfFolder(): Promise<void>
  }
  wow: {
    validatePath(wowPath: string): Promise<WowPathValidation>
    previewAccountConfig(input: AccountConfigInput): Promise<AccountConfigPreview>
  }
}
