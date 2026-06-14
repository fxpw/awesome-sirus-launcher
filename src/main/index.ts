import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { ipcChannels } from '@shared/contracts'
import { updateAccountConfigText } from '@core/accounts/configWtf'
import { createWtfBackupService } from '@main/backup/wtfBackupService'
import { downloadFile } from '@main/downloads/downloadFile'
import { createFpsPatchService } from '@main/fpsPatch/fpsPatchService'
import { registerIpcHandler } from '@main/ipc/ipcHandler'
import {
  accountConfigInputSchema,
  accountConfigPreviewSchema,
  appInfoSchema,
  createWtfBackupResultSchema,
  deleteWtfBackupResultSchema,
  fpsPatchInstallResultSchema,
  fpsPatchStatusSchema,
  githubTokenInputSchema,
  githubTokenStatusSchema,
  launcherSettingsPatchSchema,
  launcherSettingsSchema,
  restoreWtfBackupResultSchema,
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
const wtfBackupService = createWtfBackupService(() => app.getPath('userData'), settingsStore)
const fpsPatchService = createFpsPatchService(() => app.getPath('userData'), settingsStore, downloadFile)

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
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

	registerIpcHandler(ipcChannels.settings.get, voidInputSchema, launcherSettingsSchema, async () =>
		settingsStore.get()
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
		async () => {
			const result = await dialog.showOpenDialog({
				title: 'Выбрать папку World of Warcraft Sirus',
				properties: ['openDirectory']
			})

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
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
