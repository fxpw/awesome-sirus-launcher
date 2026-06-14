import type {
	AccountConfigInput,
	GitHubTokenInput,
	LauncherSettingsPatch,
	WtfBackupActionInput
} from '@shared/contracts'

export const launcherApi = {
	app: {
		getInfo: () => window.launcher.app.getInfo()
	},
	github: {
		getTokenStatus: () => window.launcher.github.getTokenStatus(),
		saveToken: (input: GitHubTokenInput) => window.launcher.github.saveToken(input),
		clearToken: () => window.launcher.github.clearToken()
	},
	settings: {
		get: () => window.launcher.settings.get(),
		save: (patch: LauncherSettingsPatch) => window.launcher.settings.save(patch),
		selectWowPath: () => window.launcher.settings.selectWowPath()
	},
	backup: {
		listWtf: () => window.launcher.backup.listWtf(),
		createWtf: () => window.launcher.backup.createWtf(),
		restoreWtf: (input: WtfBackupActionInput) => window.launcher.backup.restoreWtf(input),
		deleteWtf: (input: WtfBackupActionInput) => window.launcher.backup.deleteWtf(input),
		openWtfFolder: () => window.launcher.backup.openWtfFolder()
	},
	fpsPatch: {
		getStatus: () => window.launcher.fpsPatch.getStatus(),
		install: () => window.launcher.fpsPatch.install()
	},
	client: {
		check: () => window.launcher.client.check()
	},
	wow: {
		validatePath: (wowPath: string) => window.launcher.wow.validatePath(wowPath),
		previewAccountConfig: (input: AccountConfigInput) =>
			window.launcher.wow.previewAccountConfig(input)
	}
}
