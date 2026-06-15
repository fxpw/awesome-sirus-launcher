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

function getLauncher(): LauncherApi {
	if (!window.launcher) {
		throw new Error(
			'Electron preload API не доступен. Перезапусти dev-режим через npm run dev и открывай именно окно Electron.'
		)
	}

	return window.launcher
}

export const launcherApi = {
	app: {
		getInfo: () => getLauncher().app.getInfo(),
		checkUpdate: () => getLauncher().app.checkUpdate(),
		installUpdate: () => getLauncher().app.installUpdate()
	},
	github: {
		getTokenStatus: () => getLauncher().github.getTokenStatus(),
		saveToken: (input: GitHubTokenInput) => getLauncher().github.saveToken(input),
		clearToken: () => getLauncher().github.clearToken()
	},
	settings: {
		get: () => getLauncher().settings.get(),
		save: (patch: LauncherSettingsPatch) => getLauncher().settings.save(patch),
		selectWowPath: () => getLauncher().settings.selectWowPath()
	},
	backup: {
		listWtf: () => getLauncher().backup.listWtf(),
		createWtf: () => getLauncher().backup.createWtf(),
		restoreWtf: (input: WtfBackupActionInput) => getLauncher().backup.restoreWtf(input),
		deleteWtf: (input: WtfBackupActionInput) => getLauncher().backup.deleteWtf(input),
		openWtfFolder: () => getLauncher().backup.openWtfFolder()
	},
	accounts: {
		list: () => getLauncher().accounts.list(),
		add: (input: AddAccountInput) => getLauncher().accounts.add(input),
		select: (input: SelectAccountInput) => getLauncher().accounts.select(input)
	},
	fpsPatch: {
		getStatus: () => getLauncher().fpsPatch.getStatus(),
		install: () => getLauncher().fpsPatch.install(),
		delete: () => getLauncher().fpsPatch.delete()
	},
	client: {
		list: (input?: ClientPatchSourceInput) => getLauncher().client.list(input),
		check: (input?: ClientPatchSourceInput) => getLauncher().client.check(input),
		downloadFile: (input: ClientPatchFileInput) => getLauncher().client.downloadFile(input),
		downloadMissing: (input?: ClientPatchSourceInput) =>
			getLauncher().client.downloadMissing(input)
	},
	addons: {
		list: () => getLauncher().addons.list(),
		check: () => getLauncher().addons.check(),
		install: (input: AddonActionInput) => getLauncher().addons.install(input),
		delete: (input: AddonActionInput) => getLauncher().addons.delete(input),
		updateAll: () => getLauncher().addons.updateAll(),
		addCustom: (input: AddCustomAddonInput) => getLauncher().addons.addCustom(input),
		exportCustom: () => getLauncher().addons.exportCustom(),
		importCustom: () => getLauncher().addons.importCustom()
	},
	mining: {
		getState: () => getLauncher().mining.getState(),
		saveConfig: (input: MiningConfigInput) => getLauncher().mining.saveConfig(input),
		selectMinerPath: () => getLauncher().mining.selectMinerPath(),
		start: () => getLauncher().mining.start(),
		stop: () => getLauncher().mining.stop(),
		resetStats: () => getLauncher().mining.resetStats()
	},
	wow: {
		validatePath: (wowPath: string) => getLauncher().wow.validatePath(wowPath),
		previewAccountConfig: (input: AccountConfigInput) =>
			getLauncher().wow.previewAccountConfig(input),
		launchGame: () => getLauncher().wow.launchGame()
	}
}
