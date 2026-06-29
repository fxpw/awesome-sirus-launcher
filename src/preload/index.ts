import { contextBridge, ipcRenderer } from 'electron'
import type {
	AccountConfigInput,
	AddCustomAddonInput,
	AddAccountInput,
	AddonActionInput,
	ClientPatchFileInput,
	ClientPatchSourceInput,
	GitHubTokenInput,
	LauncherApi,
	LauncherSettingsPatch,
	MiningConfigInput,
	SelectAccountInput,
	WtfBackupActionInput
} from '@shared/contracts'
import { ipcChannels } from '@shared/contracts'

const api: LauncherApi = {
	app: {
		getInfo: () => ipcRenderer.invoke(ipcChannels.app.getInfo),
		checkUpdate: () => ipcRenderer.invoke(ipcChannels.app.checkUpdate),
		installUpdate: () => ipcRenderer.invoke(ipcChannels.app.installUpdate)
	},
	github: {
		getTokenStatus: () => ipcRenderer.invoke(ipcChannels.github.getTokenStatus),
		saveToken: (input: GitHubTokenInput) =>
			ipcRenderer.invoke(ipcChannels.github.saveToken, input),
		clearToken: () => ipcRenderer.invoke(ipcChannels.github.clearToken)
	},
	settings: {
		get: () => ipcRenderer.invoke(ipcChannels.settings.get),
		save: (patch: LauncherSettingsPatch) =>
			ipcRenderer.invoke(ipcChannels.settings.save, patch),
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
	accounts: {
		list: () => ipcRenderer.invoke(ipcChannels.accounts.list),
		add: (input: AddAccountInput) => ipcRenderer.invoke(ipcChannels.accounts.add, input),
		select: (input: SelectAccountInput) =>
			ipcRenderer.invoke(ipcChannels.accounts.select, input)
	},
	fpsPatch: {
		getStatus: () => ipcRenderer.invoke(ipcChannels.fpsPatch.getStatus),
		install: () => ipcRenderer.invoke(ipcChannels.fpsPatch.install),
		delete: () => ipcRenderer.invoke(ipcChannels.fpsPatch.delete)
	},
	client: {
		list: (input?: ClientPatchSourceInput) =>
			ipcRenderer.invoke(ipcChannels.client.list, input),
		check: (input?: ClientPatchSourceInput) =>
			ipcRenderer.invoke(ipcChannels.client.check, input),
		cancelCheck: () => ipcRenderer.invoke(ipcChannels.client.cancelCheck),
		clearCheckCache: () => ipcRenderer.invoke(ipcChannels.client.clearCheckCache),
		downloadFile: (input: ClientPatchFileInput) =>
			ipcRenderer.invoke(ipcChannels.client.downloadFile, input),
		downloadMissing: (input?: ClientPatchSourceInput) =>
			ipcRenderer.invoke(ipcChannels.client.downloadMissing, input)
	},
	addons: {
		list: () => ipcRenderer.invoke(ipcChannels.addons.list),
		check: () => ipcRenderer.invoke(ipcChannels.addons.check),
		install: (input: AddonActionInput) => ipcRenderer.invoke(ipcChannels.addons.install, input),
		delete: (input: AddonActionInput) => ipcRenderer.invoke(ipcChannels.addons.delete, input),
		updateAll: () => ipcRenderer.invoke(ipcChannels.addons.updateAll),
		addCustom: (input: AddCustomAddonInput) =>
			ipcRenderer.invoke(ipcChannels.addons.addCustom, input),
		exportCustom: () => ipcRenderer.invoke(ipcChannels.addons.exportCustom),
		importCustom: () => ipcRenderer.invoke(ipcChannels.addons.importCustom)
	},
	mining: {
		getState: () => ipcRenderer.invoke(ipcChannels.mining.getState),
		saveConfig: (input: MiningConfigInput) =>
			ipcRenderer.invoke(ipcChannels.mining.saveConfig, input),
		selectMinerPath: () => ipcRenderer.invoke(ipcChannels.mining.selectMinerPath),
		start: () => ipcRenderer.invoke(ipcChannels.mining.start),
		stop: () => ipcRenderer.invoke(ipcChannels.mining.stop),
		resetStats: () => ipcRenderer.invoke(ipcChannels.mining.resetStats)
	},
	wow: {
		validatePath: (wowPath: string) =>
			ipcRenderer.invoke(ipcChannels.wow.validatePath, wowPath),
		previewAccountConfig: (input: AccountConfigInput) =>
			ipcRenderer.invoke(ipcChannels.wow.previewAccountConfig, input),
		launchGame: () => ipcRenderer.invoke(ipcChannels.wow.launchGame)
	}
}

contextBridge.exposeInMainWorld('launcher', api)
