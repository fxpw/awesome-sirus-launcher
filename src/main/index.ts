import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { app, BrowserWindow, dialog, shell, type OpenDialogOptions } from 'electron'
import { is } from '@electron-toolkit/utils'
import { ipcChannels } from '@shared/contracts'
import { updateAccountConfigText } from '@core/accounts/configWtf'
import { createAccountService } from '@main/accounts/accountService'
import { createAddonService } from '@main/addons/addonService'
import { unzipToDirectory } from '@main/archive/unzipToDirectory'
import { createWtfBackupService } from '@main/backup/wtfBackupService'
import { createFileClientMd5Cache } from '@main/clientPatches/clientMd5Cache'
import { createClientPatchService } from '@main/clientPatches/clientPatchService'
import { downloadFile } from '@main/downloads/downloadFile'
import { fetchJson } from '@main/downloads/fetchJson'
import { md5File } from '@main/files/md5File'
import { createFpsPatchService } from '@main/fpsPatch/fpsPatchService'
import { registerIpcHandler } from '@main/ipc/ipcHandler'
import { createGameLaunchService } from '@main/launcher/gameLaunchService'
import { createChildProcessMiningRunner, createMiningService } from '@main/mining/miningService'
import { createAppUpdateService } from '@main/updater/appUpdateService'
import { getPreloadPath } from '@main/windowPaths'
import {
	accountConfigInputSchema,
	accountConfigPreviewSchema,
	accountListResultSchema,
	addAccountInputSchema,
	addCustomAddonInputSchema,
	addonActionInputSchema,
	addonDeleteResultSchema,
	addonInstallResultSchema,
	addonsListResultSchema,
	addonsUpdateAllResultSchema,
	appInfoSchema,
	appUpdateCheckSchema,
	appUpdateInstallResultSchema,
	clientPatchDownloadAllResultSchema,
	clientPatchDownloadResultSchema,
	clientPatchFileInputSchema,
	clientPatchManifestResultSchema,
	clientPatchSourceInputSchema,
	clientCheckResultSchema,
	createWtfBackupResultSchema,
	customAddonsTransferResultSchema,
	deleteWtfBackupResultSchema,
	fpsPatchDeleteResultSchema,
	fpsPatchInstallResultSchema,
	fpsPatchStatusSchema,
	gameLaunchResultSchema,
	githubTokenInputSchema,
	githubTokenStatusSchema,
	launcherSettingsPatchSchema,
	launcherSettingsSchema,
	minerPathInputSchema,
	miningConfigInputSchema,
	miningStateSchema,
	restoreWtfBackupResultSchema,
	selectAccountInputSchema,
	voidInputSchema,
	voidOutputSchema,
	wtfBackupActionInputSchema,
	wtfBackupListSchema,
	wowPathInputSchema,
	wowPathValidationSchema
} from '@main/ipc/schemas'
import { createElectronSecretStore } from '@main/secrets/electronSecretStore'
import { createFileSettingsStore } from '@main/settings/fileSettingsStore'
import { validateWowPath } from '@core/wow/wowPaths'

const secretStore = createElectronSecretStore(() => app.getPath('userData'))
const settingsStore = createFileSettingsStore(() => app.getPath('userData'))
const accountService = createAccountService(() => app.getPath('userData'), secretStore)
const wtfBackupService = createWtfBackupService(() => app.getPath('userData'), settingsStore)
const fpsPatchService = createFpsPatchService(
	() => app.getPath('userData'),
	settingsStore,
	downloadFile
)
const clientPatchService = createClientPatchService(
	settingsStore,
	fetchJson,
	md5File,
	downloadFile,
	() => app.getPath('temp'),
	createFileClientMd5Cache(() => app.getPath('userData'))
)
const addonService = createAddonService(
	() => app.getPath('userData'),
	settingsStore,
	secretStore,
	downloadFile,
	unzipToDirectory
)
const miningService = createMiningService(
	() => app.getPath('userData'),
	createChildProcessMiningRunner((executablePath, args) =>
		spawn(executablePath, args, {
			cwd: dirname(executablePath),
			detached: false,
			stdio: 'pipe',
			windowsHide: false
		})
	)
)
const gameLaunchService = createGameLaunchService(
	settingsStore,
	async (executablePath, cwd) => {
		const child = spawn(executablePath, [], {
			cwd,
			detached: true,
			stdio: 'ignore',
			windowsHide: false
		})
		child.unref()
	},
	(wowPath) => accountService.applySelectedToWowConfig(wowPath)
)
const appUpdateService = createAppUpdateService(
	app.getVersion(),
	settingsStore,
	secretStore,
	fetchJson,
	async (url, token) => {
		const response = await fetch(url, {
			headers: token ? { Authorization: `Bearer ${token}` } : undefined
		})
		if (!response.ok) {
			throw new Error(`Request failed ${response.status} ${response.statusText}`.trim())
		}

		return response.json()
	},
	downloadFile,
	async (installerPath) => {
		const child = spawn(installerPath, [], {
			detached: true,
			stdio: 'ignore',
			windowsHide: false
		})
		child.unref()
	},
	() => app.getPath('userData')
)

function createWindow(): void {
	const mainWindow = new BrowserWindow({
		width: 1500,
		height: 720,
		minWidth: 980,
		minHeight: 620,
		show: false,
		autoHideMenuBar: true,
		webPreferences: {
			preload: getPreloadPath(app.getAppPath()),
			sandbox: false,
			contextIsolation: true,
			nodeIntegration: false
		}
	})

	mainWindow.on('ready-to-show', () => {
		mainWindow.show()
	})

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url)
		return { action: 'deny' }
	})

	if (is.dev && process.env.ELECTRON_RENDERER_URL) {
		void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
	} else {
		void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
	}
}

function registerIpcHandlers(): void {
	registerIpcHandler(ipcChannels.app.getInfo, voidInputSchema, appInfoSchema, () => ({
		name: app.getName(),
		version: app.getVersion()
	}))

	registerIpcHandler(
		ipcChannels.app.checkUpdate,
		voidInputSchema,
		appUpdateCheckSchema,
		async () => appUpdateService.check()
	)

	registerIpcHandler(
		ipcChannels.app.installUpdate,
		voidInputSchema,
		appUpdateInstallResultSchema,
		async () => {
			const result = await appUpdateService.install()
			setTimeout(() => app.quit(), 1000)
			return result
		}
	)

	registerIpcHandler(
		ipcChannels.github.getTokenStatus,
		voidInputSchema,
		githubTokenStatusSchema,
		async () => ({
			configured: await secretStore.has('github-token')
		})
	)

	registerIpcHandler(
		ipcChannels.github.saveToken,
		githubTokenInputSchema,
		githubTokenStatusSchema,
		async (input) => {
			await secretStore.set('github-token', input.token)
			return { configured: true }
		}
	)

	registerIpcHandler(
		ipcChannels.github.clearToken,
		voidInputSchema,
		githubTokenStatusSchema,
		async () => {
			await secretStore.delete('github-token')
			return { configured: false }
		}
	)

	registerIpcHandler(
		ipcChannels.accounts.list,
		voidInputSchema,
		accountListResultSchema,
		async () => accountService.list()
	)

	registerIpcHandler(
		ipcChannels.accounts.add,
		addAccountInputSchema,
		accountListResultSchema,
		async (input) => accountService.add(input)
	)

	registerIpcHandler(
		ipcChannels.accounts.select,
		selectAccountInputSchema,
		accountListResultSchema,
		async (input) => accountService.select(input)
	)

	registerIpcHandler(
		ipcChannels.settings.get,
		voidInputSchema,
		launcherSettingsSchema,
		async () => settingsStore.get()
	)

	registerIpcHandler(
		ipcChannels.settings.save,
		launcherSettingsPatchSchema,
		launcherSettingsSchema,
		async (patch) => settingsStore.save(patch)
	)

	registerIpcHandler(
		ipcChannels.settings.selectWowPath,
		voidInputSchema,
		launcherSettingsSchema,
		async (_input, event) => {
			const parentWindow = BrowserWindow.fromWebContents(event.sender)
			const dialogOptions: OpenDialogOptions = {
				title: 'Выбрать папку World of Warcraft Sirus',
				properties: ['openDirectory']
			}
			const result = parentWindow
				? await dialog.showOpenDialog(parentWindow, dialogOptions)
				: await dialog.showOpenDialog(dialogOptions)

			if (result.canceled || !result.filePaths[0]) return settingsStore.get()
			return settingsStore.save({ wowPath: result.filePaths[0] })
		}
	)

	registerIpcHandler(ipcChannels.backup.listWtf, voidInputSchema, wtfBackupListSchema, async () =>
		wtfBackupService.list()
	)

	registerIpcHandler(
		ipcChannels.backup.createWtf,
		voidInputSchema,
		createWtfBackupResultSchema,
		async () => wtfBackupService.create()
	)

	registerIpcHandler(
		ipcChannels.backup.restoreWtf,
		wtfBackupActionInputSchema,
		restoreWtfBackupResultSchema,
		async (input) => wtfBackupService.restore(input)
	)

	registerIpcHandler(
		ipcChannels.backup.deleteWtf,
		wtfBackupActionInputSchema,
		deleteWtfBackupResultSchema,
		async (input) => wtfBackupService.delete(input)
	)

	registerIpcHandler(
		ipcChannels.backup.openWtfFolder,
		voidInputSchema,
		voidOutputSchema,
		async () => {
			await wtfBackupService.list()
			const openError = await shell.openPath(wtfBackupService.getBackupsDir())
			if (openError) throw new Error(openError)
			return undefined
		}
	)

	registerIpcHandler(
		ipcChannels.fpsPatch.getStatus,
		voidInputSchema,
		fpsPatchStatusSchema,
		async () => fpsPatchService.getStatus()
	)

	registerIpcHandler(
		ipcChannels.fpsPatch.install,
		voidInputSchema,
		fpsPatchInstallResultSchema,
		async () => fpsPatchService.install()
	)

	registerIpcHandler(
		ipcChannels.fpsPatch.delete,
		voidInputSchema,
		fpsPatchDeleteResultSchema,
		async () => fpsPatchService.delete()
	)

	registerIpcHandler(
		ipcChannels.client.list,
		clientPatchSourceInputSchema,
		clientPatchManifestResultSchema,
		async (input) => clientPatchService.list(input)
	)

	registerIpcHandler(
		ipcChannels.client.check,
		clientPatchSourceInputSchema,
		clientCheckResultSchema,
		async (input) => clientPatchService.check(input)
	)

	registerIpcHandler(
		ipcChannels.client.downloadFile,
		clientPatchFileInputSchema,
		clientPatchDownloadResultSchema,
		async (input) => clientPatchService.downloadFile(input)
	)

	registerIpcHandler(
		ipcChannels.client.downloadMissing,
		clientPatchSourceInputSchema,
		clientPatchDownloadAllResultSchema,
		async (input) => clientPatchService.downloadMissing(input)
	)

	registerIpcHandler(ipcChannels.addons.list, voidInputSchema, addonsListResultSchema, async () =>
		addonService.list()
	)

	registerIpcHandler(
		ipcChannels.addons.check,
		voidInputSchema,
		addonsListResultSchema,
		async () => addonService.check()
	)

	registerIpcHandler(
		ipcChannels.addons.install,
		addonActionInputSchema,
		addonInstallResultSchema,
		async (input) => addonService.install(input)
	)

	registerIpcHandler(
		ipcChannels.addons.delete,
		addonActionInputSchema,
		addonDeleteResultSchema,
		async (input) => addonService.delete(input)
	)

	registerIpcHandler(
		ipcChannels.addons.updateAll,
		voidInputSchema,
		addonsUpdateAllResultSchema,
		async () => addonService.updateAll()
	)

	registerIpcHandler(
		ipcChannels.addons.addCustom,
		addCustomAddonInputSchema,
		addonsListResultSchema,
		async (input) => addonService.addCustom(input)
	)

	registerIpcHandler(
		ipcChannels.addons.exportCustom,
		voidInputSchema,
		customAddonsTransferResultSchema,
		async (_input, event) => {
			const parentWindow = BrowserWindow.fromWebContents(event.sender)
			const dialogOptions = {
				title: 'Экспорт пользовательских аддонов',
				defaultPath: 'awesome-sirus-custom-addons.json',
				filters: [{ name: 'JSON', extensions: ['json'] }]
			}
			const result = parentWindow
				? await dialog.showSaveDialog(parentWindow, dialogOptions)
				: await dialog.showSaveDialog(dialogOptions)
			if (result.canceled || !result.filePath) return undefined

			return addonService.exportCustom(result.filePath)
		}
	)

	registerIpcHandler(
		ipcChannels.addons.importCustom,
		voidInputSchema,
		customAddonsTransferResultSchema,
		async (_input, event) => {
			const parentWindow = BrowserWindow.fromWebContents(event.sender)
			const dialogOptions: OpenDialogOptions = {
				title: 'Импорт пользовательских аддонов',
				properties: ['openFile'],
				filters: [{ name: 'JSON', extensions: ['json'] }]
			}
			const result = parentWindow
				? await dialog.showOpenDialog(parentWindow, dialogOptions)
				: await dialog.showOpenDialog(dialogOptions)
			if (result.canceled || !result.filePaths[0]) return undefined

			return addonService.importCustom(result.filePaths[0])
		}
	)

	registerIpcHandler(ipcChannels.mining.getState, voidInputSchema, miningStateSchema, async () =>
		miningService.getState()
	)

	registerIpcHandler(
		ipcChannels.mining.saveConfig,
		miningConfigInputSchema,
		miningStateSchema,
		async (input) => miningService.saveConfig(input)
	)

	registerIpcHandler(
		ipcChannels.mining.selectMinerPath,
		voidInputSchema,
		miningStateSchema,
		async (_input, event) => {
			const parentWindow = BrowserWindow.fromWebContents(event.sender)
			const dialogOptions: OpenDialogOptions = {
				title: 'Выбрать exe-файл майнера',
				properties: ['openFile'],
				filters: [{ name: 'Executable', extensions: ['exe'] }]
			}
			const result = parentWindow
				? await dialog.showOpenDialog(parentWindow, dialogOptions)
				: await dialog.showOpenDialog(dialogOptions)

			if (result.canceled || !result.filePaths[0]) return miningService.getState()
			return miningService.selectMinerPath(minerPathInputSchema.parse(result.filePaths[0]))
		}
	)

	registerIpcHandler(ipcChannels.mining.start, voidInputSchema, miningStateSchema, async () =>
		miningService.start()
	)

	registerIpcHandler(ipcChannels.mining.stop, voidInputSchema, miningStateSchema, async () =>
		miningService.stop()
	)

	registerIpcHandler(
		ipcChannels.mining.resetStats,
		voidInputSchema,
		miningStateSchema,
		async () => miningService.resetStats()
	)

	registerIpcHandler(
		ipcChannels.wow.validatePath,
		wowPathInputSchema,
		wowPathValidationSchema,
		async (wowPath) => validateWowPath(wowPath)
	)

	registerIpcHandler(
		ipcChannels.wow.previewAccountConfig,
		accountConfigInputSchema,
		accountConfigPreviewSchema,
		async (input) =>
			updateAccountConfigText(input.configText, {
				login: input.login,
				password: input.password
			})
	)

	registerIpcHandler(
		ipcChannels.wow.launchGame,
		voidInputSchema,
		gameLaunchResultSchema,
		async () => gameLaunchService.launch()
	)
}

app.whenReady().then(() => {
	registerIpcHandlers()
	createWindow()

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('before-quit', () => {
	void miningService.stop()
})

app.on('window-all-closed', () => {
	void miningService.stop()
	if (process.platform !== 'darwin') app.quit()
})
