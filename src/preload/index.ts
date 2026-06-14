import { contextBridge, ipcRenderer } from 'electron'
import type {
  AccountConfigInput,
  GitHubTokenInput,
  LauncherApi,
  LauncherSettingsPatch,
  WtfBackupActionInput
} from '@shared/contracts'
import { ipcChannels } from '@shared/contracts'

const api: LauncherApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(ipcChannels.app.getInfo)
  },
  github: {
    getTokenStatus: () => ipcRenderer.invoke(ipcChannels.github.getTokenStatus),
    saveToken: (input: GitHubTokenInput) => ipcRenderer.invoke(ipcChannels.github.saveToken, input),
    clearToken: () => ipcRenderer.invoke(ipcChannels.github.clearToken)
  },
  settings: {
    get: () => ipcRenderer.invoke(ipcChannels.settings.get),
    save: (patch: LauncherSettingsPatch) => ipcRenderer.invoke(ipcChannels.settings.save, patch),
    selectWowPath: () => ipcRenderer.invoke(ipcChannels.settings.selectWowPath)
  },
  backup: {
    listWtf: () => ipcRenderer.invoke(ipcChannels.backup.listWtf),
    createWtf: () => ipcRenderer.invoke(ipcChannels.backup.createWtf),
    restoreWtf: (input: WtfBackupActionInput) =>
      ipcRenderer.invoke(ipcChannels.backup.restoreWtf, input),
    deleteWtf: (input: WtfBackupActionInput) =>
      ipcRenderer.invoke(ipcChannels.backup.deleteWtf, input),
    openWtfFolder: () => ipcRenderer.invoke(ipcChannels.backup.openWtfFolder)
  },
  wow: {
    validatePath: (wowPath: string) => ipcRenderer.invoke(ipcChannels.wow.validatePath, wowPath),
    previewAccountConfig: (input: AccountConfigInput) =>
      ipcRenderer.invoke(ipcChannels.wow.previewAccountConfig, input)
  }
}

contextBridge.exposeInMainWorld('launcher', api)
