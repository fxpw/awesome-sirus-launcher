<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import type {
	AccountListResult,
	AccountSummary,
	AddonsListResult,
	AppInfo,
	AppUpdateCheck,
	ClientCheckResult,
	ClientCheckProgress,
	ClientPatchFileInput,
	ClientPatchManifestResult,
	FpsPatchStatus,
	GitHubTokenStatus,
	LauncherSettings,
	LauncherSettingsPatch,
	MiningConfigInput,
	MiningState,
	WowPathValidation,
	WtfBackupSummary
} from '@shared/contracts'
import { clientPatchSourceUrls } from '@shared/contracts'
import AccountModal from '@renderer/elements/AccountModal.vue'
import AddonsPanel from '@renderer/elements/AddonsPanel.vue'
import DashboardFooter from '@renderer/blocks/DashboardFooter.vue'
import AppSidebar from '@renderer/blocks/AppSidebar.vue'
import ClientCheckPanel from '@renderer/elements/ClientCheckPanel.vue'
import ClientPathModal from '@renderer/elements/ClientPathModal.vue'
import DashboardHeader from '@renderer/blocks/DashboardHeader.vue'
import DashboardOverviewPanel from '@renderer/elements/DashboardOverviewPanel.vue'
import FpsPatchPanel from '@renderer/elements/FpsPatchPanel.vue'
import GitHubConnectionForm from '@renderer/elements/GitHubConnectionForm.vue'
import GitHubTokenForm from '@renderer/elements/GitHubTokenForm.vue'
import GitHubTokenModal from '@renderer/elements/GitHubTokenModal.vue'
import LaunchBehaviorForm from '@renderer/elements/LaunchBehaviorForm.vue'
import MiningPanel from '@renderer/elements/MiningPanel.vue'
import ThanksPanel from '@renderer/elements/ThanksPanel.vue'
import WowPathForm from '@renderer/elements/WowPathForm.vue'
import WtfBackupPathForm from '@renderer/elements/WtfBackupPathForm.vue'
import WtfBackupPanel from '@renderer/elements/WtfBackupPanel.vue'
import { launcherApi } from '@renderer/api/launcherApi'
import { useLocale } from '@renderer/composables/useLocale'
import { createClientFileKey } from '@renderer/shared/clientPatchFiles'
import { getUserErrorMessage } from '@renderer/shared/errors'
import type { MessageKey } from '@renderer/shared/i18n'

type LauncherSection =
	'dashboard' | 'addons' | 'client' | 'patch' | 'wtf' | 'mining' | 'settings' | 'thanks'

const sectionTitleKeys: Record<LauncherSection, MessageKey> = {
	dashboard: 'section.dashboard.title',
	addons: 'section.addons.title',
	client: 'section.client.title',
	patch: 'section.patch.title',
	wtf: 'section.wtf.title',
	mining: 'section.mining.title',
	settings: 'section.settings.title',
	thanks: 'section.thanks.title'
}

const sectionEyebrowKeys: Record<LauncherSection, MessageKey> = {
	dashboard: 'section.dashboard.eyebrow',
	addons: 'section.addons.eyebrow',
	client: 'section.client.eyebrow',
	patch: 'section.patch.eyebrow',
	wtf: 'section.wtf.eyebrow',
	mining: 'section.mining.eyebrow',
	settings: 'section.settings.eyebrow',
	thanks: 'section.thanks.eyebrow'
}

const appInfo = ref<AppInfo | null>(null)
const appUpdateCheck = ref<AppUpdateCheck | null>(null)
const appUpdateChecking = ref(false)
const appUpdateInstalling = ref(false)
const githubTokenStatus = ref<GitHubTokenStatus>({ configured: false })
const accounts = ref<AccountListResult>({ accounts: [] })
const settings = ref<LauncherSettings | null>(null)
const wowPath = ref('')
const wtfBackupPath = ref('')
const wowValidation = ref<WowPathValidation | null>(null)
const backups = ref<WtfBackupSummary[]>([])
const wtfBackupCreating = ref(false)
const fpsPatchStatus = ref<FpsPatchStatus | null>(null)
const fpsPatchInstalling = ref(false)
const gameLaunching = ref(false)
const clientCheckResult = ref<ClientCheckResult | null>(null)
const clientPatchManifest = ref<ClientPatchManifestResult | null>(null)
const selectedClientPatchSourceUrl = ref<string>(clientPatchSourceUrls[0])
const clientChecking = ref(false)
const clientCheckProgress = ref<ClientCheckProgress | null>(null)
const clientManifestLoading = ref(false)
const clientClearingCache = ref(false)
const clientDownloadingKey = ref('')
const clientDownloadingAll = ref(false)
const addonChecking = ref(false)
const addonCheckResult = ref<AddonsListResult | null>(null)
const miningState = ref<MiningState | null>(null)
const miningWorking = ref(false)
const githubToken = ref('')
const githubConnectionSaving = ref(false)
const githubConnectionTesting = ref(false)
const githubConnectionError = ref('')
const githubConnectionNotice = ref('')
const githubConnectionLastCheckUsedProxy = ref<boolean | undefined>()
const error = ref('')
const notice = ref('')
const tokenModalError = ref('')
const tokenModalOpen = ref(false)
const accountModalOpen = ref(false)
const accountLogin = ref('')
const accountPassword = ref('')
const accountModalError = ref('')
const activeSection = ref<LauncherSection>('dashboard')
let miningPollTimer: number | undefined
let removeClientCheckProgressListener: (() => void) | undefined

const { t } = useLocale()

const latestBackup = computed(() => backups.value[0] ?? null)
const effectiveWtfBackupPath = computed(() => {
	if (!settings.value) return ''
	if (settings.value.wtfBackupPath.trim()) return settings.value.wtfBackupPath
	if (!wowPath.value.trim()) return ''
	const base = wowPath.value.replace(/[/\\]+$/, '')
	return `${base}\\wtf_backup`
})
const activeTitle = computed(() => t(sectionTitleKeys[activeSection.value]))
const activeEyebrow = computed(() => t(sectionEyebrowKeys[activeSection.value]))
const clientProblemCount = computed(
	() => (clientCheckResult.value?.missing ?? 0) + (clientCheckResult.value?.outdated ?? 0)
)
const addonUpdateCount = computed(
	() => addonCheckResult.value?.addons.filter((addon) => addon.status === 'outdated').length ?? 0
)
const addonRemoteErrorCount = computed(
	() => addonCheckResult.value?.addons.filter((addon) => Boolean(addon.error)).length ?? 0
)
const footerStatusTone = computed(() => {
	if (error.value) return 'error'
	if (clientProblemCount.value > 0) return 'warning'
	if (addonRemoteErrorCount.value > 0) return 'warning'
	if (addonUpdateCount.value > 0) return 'warning'
	if (notice.value || clientCheckResult.value) return 'ok'
	return 'neutral'
})
const footerStatusText = computed(() => {
	if (error.value) return error.value
	if (clientDownloadingAll.value) {
		return t('footer.status.clientDownloadingAll', { count: clientProblemCount.value })
	}
	if (clientDownloadingKey.value) return t('footer.status.clientDownloadingOne')
	if (clientChecking.value) return t('footer.status.clientChecking')
	if (clientManifestLoading.value) return t('footer.status.clientManifest')
	if (fpsPatchInstalling.value) return t('footer.status.fpsPatch')
	if (appUpdateInstalling.value) return t('footer.status.appUpdateInstalling')
	if (appUpdateChecking.value) return t('footer.status.appUpdateChecking')
	if (addonChecking.value) return t('footer.status.addonsChecking')
	if (gameLaunching.value) return t('footer.status.launchingGame')
	if (wtfBackupCreating.value) return t('footer.status.wtfBackup')
	if (notice.value) return notice.value
	if (addonCheckResult.value) {
		if (addonRemoteErrorCount.value > 0) {
			return t('footer.status.addonsPartial', {
				count: addonRemoteErrorCount.value,
				total: addonCheckResult.value.total
			})
		}
		return addonUpdateCount.value > 0
			? t('footer.status.addonsOutdated', { count: addonUpdateCount.value })
			: t('footer.status.addonsOk', { total: addonCheckResult.value.total })
	}
	if (clientCheckResult.value) {
		return clientProblemCount.value > 0
			? t('footer.status.clientProblems', {
					count: clientProblemCount.value,
					total: clientCheckResult.value.total
				})
			: t('footer.status.clientOk', { total: clientCheckResult.value.total })
	}

	return t('footer.status.idle')
})
const shouldShowClientPathModal = computed(
	() => settings.value !== null && settings.value.wowPath.trim().length === 0
)

onMounted(async () => {
	removeClientCheckProgressListener = launcherApi.client.onCheckProgress(
		(progress: ClientCheckProgress) => {
			clientCheckProgress.value = progress
		}
	)
	miningPollTimer = window.setInterval(() => {
		if (miningState.value?.status === 'running') void refreshMiningState()
	}, 2500)
	void checkAppUpdate()
	void launcherApi.fpsPatch.getStatus().then(
		(status) => (fpsPatchStatus.value = status),
		(err: unknown) => (error.value = getUserErrorMessage(err, t('app.initError')))
	)
	try {
		await Promise.all([
			launcherApi.app.getInfo().then((info) => (appInfo.value = info)),
			launcherApi.github
				.getTokenStatus()
				.then((status) => (githubTokenStatus.value = status)),
			launcherApi.accounts.list().then((list) => (accounts.value = list)),
			launcherApi.mining.getState().then((state) => (miningState.value = state)),
			reloadBackups(),
			launcherApi.settings.get().then((value) => {
				settings.value = value
				wowPath.value = value.wowPath
				wtfBackupPath.value = value.wtfBackupPath
			})
		])
		if (wowPath.value) {
			await validateWowPath()
			if (wowValidation.value?.valid) {
				if (settings.value?.checkClientBeforeLaunch) await checkClient()
				await scanAddonsOnStartup()
			}
		}
	} catch (err) {
		error.value = getUserErrorMessage(err, t('app.initError'))
	}
})

onUnmounted(() => {
	removeClientCheckProgressListener?.()
	if (miningPollTimer) window.clearInterval(miningPollTimer)
})

async function runAction(
	fallbackKey: MessageKey,
	action: () => Promise<void>,
	busy?: Ref<boolean>
): Promise<void> {
	error.value = ''
	notice.value = ''
	if (busy) busy.value = true
	try {
		await action()
	} catch (err) {
		error.value = getUserErrorMessage(err, t(fallbackKey))
	} finally {
		if (busy) busy.value = false
	}
}

async function validateWowPath(): Promise<void> {
	error.value = ''
	try {
		wowValidation.value = await launcherApi.wow.validatePath(wowPath.value)
	} catch (err) {
		error.value = getUserErrorMessage(err, t('wow.validateError'))
	}
}

function selectWowPath(): Promise<void> {
	return runAction('wow.selectError', async () => {
		settings.value = await launcherApi.settings.selectWowPath()
		wowPath.value = settings.value.wowPath
		wtfBackupPath.value = settings.value.wtfBackupPath
		fpsPatchStatus.value = await launcherApi.fpsPatch.getStatus()
		if (wowPath.value) await validateWowPath()
		await reloadBackups()
	})
}

function saveWowPath(): Promise<void> {
	return runAction('wow.saveError', async () => {
		settings.value = await launcherApi.settings.save({ wowPath: wowPath.value })
		wowPath.value = settings.value.wowPath
		wtfBackupPath.value = settings.value.wtfBackupPath
		await validateWowPath()
		fpsPatchStatus.value = await launcherApi.fpsPatch.getStatus()
		await reloadBackups()
		notice.value = t('wow.saved')
	})
}

function selectWtfBackupPath(): Promise<void> {
	return runAction('backup.path.selectError', async () => {
		settings.value = await launcherApi.settings.selectWtfBackupPath()
		wtfBackupPath.value = settings.value.wtfBackupPath
		await reloadBackups()
		notice.value = t('backup.path.saved')
	})
}

function saveWtfBackupPath(): Promise<void> {
	return runAction('backup.path.saveError', async () => {
		settings.value = await launcherApi.settings.save({ wtfBackupPath: wtfBackupPath.value })
		wtfBackupPath.value = settings.value.wtfBackupPath
		await reloadBackups()
		notice.value = t('backup.path.saved')
	})
}

function resetWtfBackupPath(): Promise<void> {
	return runAction('backup.path.saveError', async () => {
		wtfBackupPath.value = ''
		settings.value = await launcherApi.settings.save({ wtfBackupPath: '' })
		await reloadBackups()
		notice.value = t('backup.path.resetDone')
	})
}

async function reloadBackups(): Promise<void> {
	try {
		backups.value = await launcherApi.backup.listWtf()
	} catch {
		backups.value = []
	}
}

function toggleSetting(
	key: 'closeOnLaunch' | 'checkClientBeforeLaunch' | 'autoUpdateAddons'
): Promise<void> {
	return runAction('launch.saveError', async () => {
		if (!settings.value) return
		settings.value = await launcherApi.settings.save({ [key]: !settings.value[key] })
	})
}

async function checkAppUpdate(): Promise<void> {
	error.value = ''
	appUpdateChecking.value = true
	try {
		appUpdateCheck.value = await launcherApi.app.checkUpdate()
	} catch (err) {
		error.value = getUserErrorMessage(err, t('appUpdate.checkError'))
	} finally {
		appUpdateChecking.value = false
	}
}

async function installAppUpdate(): Promise<void> {
	error.value = ''
	notice.value = ''
	appUpdateInstalling.value = true
	try {
		const result = await launcherApi.app.installUpdate()
		notice.value = t('appUpdate.installStarted', { version: result.version })
	} catch (err) {
		error.value = getUserErrorMessage(err, t('appUpdate.installError'))
		appUpdateInstalling.value = false
	}
}

async function saveGitHubToken(): Promise<void> {
	error.value = ''
	notice.value = ''
	tokenModalError.value = ''
	try {
		githubTokenStatus.value = await launcherApi.github.saveToken({ token: githubToken.value })
		githubToken.value = ''
		tokenModalOpen.value = false
		notice.value = t('token.saved')
	} catch (err) {
		const message = getUserErrorMessage(err, t('token.saveError'))
		if (tokenModalOpen.value) tokenModalError.value = message
		else error.value = message
	}
}

async function clearGitHubToken(): Promise<void> {
	error.value = ''
	notice.value = ''
	tokenModalError.value = ''
	try {
		githubTokenStatus.value = await launcherApi.github.clearToken()
		githubToken.value = ''
		tokenModalOpen.value = false
		notice.value = t('token.cleared')
	} catch (err) {
		const message = getUserErrorMessage(err, t('token.clearError'))
		if (tokenModalOpen.value) tokenModalError.value = message
		else error.value = message
	}
}

async function saveGitHubConnectionSettings(patch: LauncherSettingsPatch): Promise<void> {
	githubConnectionError.value = ''
	githubConnectionNotice.value = ''
	githubConnectionLastCheckUsedProxy.value = undefined
	githubConnectionSaving.value = true
	try {
		settings.value = await launcherApi.settings.save(patch)
		githubConnectionNotice.value = t('githubConnection.saved')
	} catch (err) {
		githubConnectionError.value = getUserErrorMessage(err, t('githubConnection.saveError'))
	} finally {
		githubConnectionSaving.value = false
	}
}

async function testGitHubConnection(patch: LauncherSettingsPatch): Promise<void> {
	githubConnectionError.value = ''
	githubConnectionNotice.value = ''
	githubConnectionLastCheckUsedProxy.value = undefined
	githubConnectionTesting.value = true
	try {
		settings.value = await launcherApi.settings.save(patch)
		const result = await launcherApi.github.testConnection()
		githubConnectionLastCheckUsedProxy.value = result.usingProxy
		githubConnectionNotice.value = t('githubConnection.testSuccess')
	} catch (err) {
		githubConnectionError.value = getUserErrorMessage(err, t('githubConnection.testError'))
	} finally {
		githubConnectionTesting.value = false
	}
}

async function addAccount(): Promise<void> {
	error.value = ''
	notice.value = ''
	accountModalError.value = ''
	try {
		accounts.value = await launcherApi.accounts.add({
			login: accountLogin.value,
			password: accountPassword.value
		})
		accountLogin.value = ''
		accountPassword.value = ''
		accountModalOpen.value = false
		notice.value = t('account.saved')
	} catch (err) {
		accountModalError.value = getUserErrorMessage(err, t('account.saveError'))
	}
}

function selectAccount(accountId: string): Promise<void> {
	return runAction('account.selectError', async () => {
		accounts.value = await launcherApi.accounts.select({ accountId })
		notice.value = t('account.selected')
	})
}

async function deleteAccount(account: AccountSummary): Promise<void> {
	if (!confirm(t('account.deleteConfirm', { login: account.login }))) return

	await runAction('account.deleteError', async () => {
		accounts.value = await launcherApi.accounts.delete({ accountId: account.id })
		notice.value = t('account.deleted')
	})
}

function createWtfBackup(): Promise<void> {
	return runAction(
		'backup.createError',
		async () => {
			const result = await launcherApi.backup.createWtf()
			backups.value = [
				result.backup,
				...backups.value.filter((backup) => backup.id !== result.backup.id)
			]
			notice.value = t('backup.created')
		},
		wtfBackupCreating
	)
}

async function restoreWtfBackup(backup: WtfBackupSummary): Promise<void> {
	if (!confirm(t('backup.restoreConfirm', { name: backup.fileName }))) return

	await runAction('backup.restoreError', async () => {
		await launcherApi.backup.restoreWtf({ id: backup.id })
		backups.value = await launcherApi.backup.listWtf()
		notice.value = t('backup.restored')
	})
}

async function deleteWtfBackup(backup: WtfBackupSummary): Promise<void> {
	if (!confirm(t('backup.deleteConfirm', { name: backup.fileName }))) return

	await runAction('backup.deleteError', async () => {
		const result = await launcherApi.backup.deleteWtf({ id: backup.id })
		backups.value = backups.value.filter((item) => item.id !== result.deletedId)
		notice.value = t('backup.deleted')
	})
}

async function openWtfBackupFolder(): Promise<void> {
	error.value = ''
	try {
		await launcherApi.backup.openWtfFolder()
	} catch (err) {
		error.value = getUserErrorMessage(err, t('backup.openError'))
	}
}

function installFpsPatch(): Promise<void> {
	return runAction(
		'fpsPatch.installError',
		async () => {
			const result = await launcherApi.fpsPatch.install()
			fpsPatchStatus.value = result.status
			notice.value = t('fpsPatch.installedNotice')
		},
		fpsPatchInstalling
	)
}

async function deleteFpsPatch(): Promise<void> {
	if (!confirm(t('fpsPatch.deleteConfirm'))) return

	await runAction(
		'fpsPatch.deleteError',
		async () => {
			const result = await launcherApi.fpsPatch.delete()
			fpsPatchStatus.value = result.status
			notice.value = t('fpsPatch.deletedNotice')
		},
		fpsPatchInstalling
	)
}

function launchGame(): Promise<void> {
	return runAction(
		'game.launchError',
		async () => {
			if (miningState.value?.status === 'running') {
				miningState.value = await launcherApi.mining.stop()
			}
			await launcherApi.wow.launchGame()
			notice.value = t('game.launched')
			if (settings.value?.closeOnLaunch) window.close()
		},
		gameLaunching
	)
}

async function checkClient(): Promise<void> {
	error.value = ''
	notice.value = ''
	clientChecking.value = true
	clientCheckProgress.value = null
	try {
		if (!clientPatchManifest.value) {
			clientPatchManifest.value = await launcherApi.client.list({
				sourceUrl: selectedClientPatchSourceUrl.value
			})
			selectedClientPatchSourceUrl.value = clientPatchManifest.value.sourceUrl
		}
		clientCheckResult.value = await launcherApi.client.check({
			sourceUrl: selectedClientPatchSourceUrl.value
		})
		selectedClientPatchSourceUrl.value = clientCheckResult.value.sourceUrl
		if (clientPatchManifest.value.sourceUrl !== clientCheckResult.value.sourceUrl) {
			clientPatchManifest.value = await launcherApi.client.list({
				sourceUrl: clientCheckResult.value.sourceUrl
			})
			selectedClientPatchSourceUrl.value = clientPatchManifest.value.sourceUrl
		}
		notice.value = t('clientCheck.checked')
	} catch (err) {
		const message = getUserErrorMessage(err, t('clientCheck.error'))
		if (message === 'Проверка клиента остановлена') notice.value = t('clientCheck.stopped')
		else error.value = message
	} finally {
		clientChecking.value = false
	}
}

function cancelClientCheck(): Promise<void> {
	return runAction('clientCheck.stopError', async () => {
		await launcherApi.client.cancelCheck()
		notice.value = t('clientCheck.stopping')
	})
}

function clearClientCheckCache(): Promise<void> {
	return runAction(
		'clientCheck.clearCacheError',
		async () => {
			await launcherApi.client.clearCheckCache()
			notice.value = t('clientCheck.cacheCleared')
		},
		clientClearingCache
	)
}

function loadClientManifest(): Promise<void> {
	return runAction(
		'clientCheck.loadError',
		async () => {
			clientPatchManifest.value = await launcherApi.client.list({
				sourceUrl: selectedClientPatchSourceUrl.value
			})
			selectedClientPatchSourceUrl.value = clientPatchManifest.value.sourceUrl
			notice.value = t('clientCheck.loaded')
		},
		clientManifestLoading
	)
}

async function downloadClientFile(input: ClientPatchFileInput): Promise<void> {
	clientDownloadingKey.value = createClientFileKey(input)
	clientCheckProgress.value = null
	await runAction('clientCheck.downloadError', async () => {
		await launcherApi.client.downloadFile({
			...input,
			sourceUrl: selectedClientPatchSourceUrl.value
		})
		clientCheckResult.value = await launcherApi.client.check({
			sourceUrl: selectedClientPatchSourceUrl.value
		})
		selectedClientPatchSourceUrl.value = clientCheckResult.value.sourceUrl
		notice.value = t('clientCheck.downloadedFile')
	})
	clientDownloadingKey.value = ''
}

function downloadMissingClientFiles(): Promise<void> {
	return runAction(
		'clientCheck.downloadError',
		async () => {
			clientCheckProgress.value = null
			const result = await launcherApi.client.downloadMissing({
				sourceUrl: selectedClientPatchSourceUrl.value
			})
			clientCheckResult.value = await launcherApi.client.check({
				sourceUrl: selectedClientPatchSourceUrl.value
			})
			selectedClientPatchSourceUrl.value = clientCheckResult.value.sourceUrl
			notice.value = t('clientCheck.downloadedAll', { total: result.total })
		},
		clientDownloadingAll
	)
}

function navigate(section: string): void {
	activeSection.value = section as LauncherSection
	error.value = ''
	notice.value = ''
	if (activeSection.value === 'client' && !clientPatchManifest.value) {
		void loadClientManifest()
	}
}

async function checkAddons(): Promise<void> {
	navigate('addons')
	await runAddonCheck()
}

async function scanAddonsOnStartup(): Promise<void> {
	await runAddonCheck()
	if (!settings.value?.autoUpdateAddons || addonUpdateCount.value === 0) return

	addonChecking.value = true
	try {
		const result = await launcherApi.addons.updateAll()
		const checked = await launcherApi.addons.check()
		addonCheckResult.value = checked
		const failedUpdates = result.skipped.filter((addon) => Boolean(addon.error)).length
		const failedChecks = checked.addons.filter((addon) => Boolean(addon.error)).length
		if (failedUpdates > 0) {
			error.value = t('addons.updatePartialWarning', {
				updated: result.total,
				failed: failedUpdates
			})
			notice.value = ''
		} else {
			notice.value = failedChecks > 0 ? '' : t('addons.updatedAll', { total: result.total })
		}
	} catch (err) {
		error.value = getUserErrorMessage(err, t('addons.error'))
	} finally {
		addonChecking.value = false
	}
}

async function runAddonCheck(): Promise<void> {
	addonChecking.value = true
	try {
		const result = await launcherApi.addons.check()
		addonCheckResult.value = result
		const failed = result.addons.filter((addon) => Boolean(addon.error)).length
		notice.value = failed ? '' : t('footer.status.addonsChecked', { total: result.total })
	} catch (err) {
		error.value = getUserErrorMessage(err, t('addons.error'))
	} finally {
		addonChecking.value = false
	}
}

function selectClientPatchSource(sourceUrl: string): void {
	selectedClientPatchSourceUrl.value = sourceUrl
	clientPatchManifest.value = null
	clientCheckResult.value = null
	notice.value = ''
	error.value = ''
}

function updateAddonCheckResult(result: AddonsListResult): void {
	addonCheckResult.value = result
	notice.value = ''
}

function saveMiningConfig(patch: MiningConfigInput): Promise<void> {
	return runAction(
		'mining.saveError',
		async () => {
			miningState.value = await launcherApi.mining.saveConfig(patch)
			notice.value = t('mining.saved')
		},
		miningWorking
	)
}

function selectMinerPath(): Promise<void> {
	return runAction(
		'mining.selectError',
		async () => {
			miningState.value = await launcherApi.mining.selectMinerPath()
		},
		miningWorking
	)
}

function startMining(): Promise<void> {
	return runAction(
		'mining.startError',
		async () => {
			miningState.value = await launcherApi.mining.start()
			notice.value = t('mining.started')
		},
		miningWorking
	)
}

function stopMining(): Promise<void> {
	return runAction(
		'mining.stopError',
		async () => {
			miningState.value = await launcherApi.mining.stop()
			notice.value = t('mining.stopped')
		},
		miningWorking
	)
}

async function resetMiningStats(): Promise<void> {
	if (!confirm(t('mining.resetConfirm'))) return

	await runAction(
		'mining.resetError',
		async () => {
			miningState.value = await launcherApi.mining.resetStats()
			notice.value = t('mining.statsReset')
		},
		miningWorking
	)
}

async function refreshMiningState(): Promise<void> {
	miningState.value = await launcherApi.mining.getState().catch(() => miningState.value)
}
</script>

<template>
	<main class="shell">
		<DashboardHeader
			:accounts="accounts"
			:github-token-status="githubTokenStatus"
			:title="activeTitle"
			:eyebrow="activeEyebrow"
			@open-token="tokenModalOpen = true"
			@open-account="accountModalOpen = true"
			@select-account="selectAccount"
			@delete-account="deleteAccount"
		/>

		<AppSidebar :app-info="appInfo" :active-section="activeSection" @navigate="navigate" />

		<section class="workspace">
			<Transition name="section-fade" mode="out-in">
				<div :key="activeSection" class="workspace-section">
					<DashboardOverviewPanel
						v-if="activeSection === 'dashboard'"
						:wow-validation="wowValidation"
						:fps-patch-status="fpsPatchStatus"
						:client-check-result="clientCheckResult"
						:latest-backup="latestBackup"
						:app-update-check="appUpdateCheck"
						:addon-update-count="addonUpdateCount"
						:addons-checked="Boolean(addonCheckResult)"
						:checking-app-update="appUpdateChecking"
						:installing-app-update="appUpdateInstalling"
						:checking-addons="addonChecking"
						:checking-client="clientChecking"
						:updating-client="clientDownloadingAll || Boolean(clientDownloadingKey)"
						:installing-fps-patch="fpsPatchInstalling"
						:creating-backup="wtfBackupCreating"
						:launching-game="gameLaunching"
						@select-wow-path="selectWowPath"
						@launch-game="launchGame"
						@install-fps-patch="installFpsPatch"
						@delete-fps-patch="deleteFpsPatch"
						@check-app-update="checkAppUpdate"
						@install-app-update="installAppUpdate"
						@open-addons="checkAddons"
						@check-client="checkClient"
						@cancel-client-check="cancelClientCheck"
						@update-client="downloadMissingClientFiles"
						@create-backup="createWtfBackup"
					/>

					<AddonsPanel
						v-else-if="activeSection === 'addons'"
						:addon-result="addonCheckResult"
						:checking-external="addonChecking"
						@checked="updateAddonCheckResult"
						@open-settings="navigate('settings')"
					/>

					<ClientCheckPanel
						v-else-if="activeSection === 'client'"
						:manifest="clientPatchManifest"
						:result="clientCheckResult"
						:source-urls="clientPatchSourceUrls"
						:selected-source-url="selectedClientPatchSourceUrl"
						:checking="clientChecking"
						:loading-manifest="clientManifestLoading"
						:clearing-cache="clientClearingCache"
						:downloading-key="clientDownloadingKey"
						:downloading-all="clientDownloadingAll"
						:progress="clientCheckProgress"
						@select-source="selectClientPatchSource"
						@load="loadClientManifest"
						@check="checkClient"
						@cancel-check="cancelClientCheck"
						@clear-cache="clearClientCheckCache"
						@download-file="downloadClientFile"
						@download-missing="downloadMissingClientFiles"
					/>

					<FpsPatchPanel
						v-else-if="activeSection === 'patch'"
						:status="fpsPatchStatus"
						:installing="fpsPatchInstalling"
						@install="installFpsPatch"
						@delete="deleteFpsPatch"
					/>

					<WtfBackupPanel
						v-else-if="activeSection === 'wtf'"
						:backups="backups"
						:creating="wtfBackupCreating"
						:backup-path="effectiveWtfBackupPath"
						@create="createWtfBackup"
						@restore="restoreWtfBackup"
						@delete="deleteWtfBackup"
						@open-folder="openWtfBackupFolder"
					/>

					<MiningPanel
						v-else-if="activeSection === 'mining'"
						:state="miningState"
						:working="miningWorking"
						:error="error"
						:notice="notice"
						@save="saveMiningConfig"
						@select-miner="selectMinerPath"
						@start="startMining"
						@stop="stopMining"
						@reset-stats="resetMiningStats"
					/>

					<ThanksPanel v-else-if="activeSection === 'thanks'" />

					<template v-else>
						<WowPathForm
							v-model:wow-path="wowPath"
							:validation="wowValidation"
							:error="error"
							:notice="notice"
							@select="selectWowPath"
							@save="saveWowPath"
						/>

						<WtfBackupPathForm
							v-model:wtf-backup-path="wtfBackupPath"
							:wow-path="wowPath"
							:error="error"
							:notice="notice"
							@select="selectWtfBackupPath"
							@save="saveWtfBackupPath"
							@reset="resetWtfBackupPath"
						/>

						<LaunchBehaviorForm
							v-if="settings"
							:settings="settings"
							@toggle="toggleSetting"
						/>

						<GitHubConnectionForm
							v-if="settings"
							:enabled="settings.githubProxyEnabled"
							:proxy-url="settings.githubProxyUrl"
							:saving="githubConnectionSaving"
							:testing="githubConnectionTesting"
							:error="githubConnectionError"
							:notice="githubConnectionNotice"
							:last-check-used-proxy="githubConnectionLastCheckUsedProxy"
							@save="saveGitHubConnectionSettings"
							@test="testGitHubConnection"
						/>

						<GitHubTokenForm
							v-model:token="githubToken"
							@save="saveGitHubToken"
							@clear="clearGitHubToken"
						/>
					</template>
				</div>
			</Transition>
		</section>

		<DashboardFooter
			:checking-client="
				clientChecking || clientDownloadingAll || Boolean(clientDownloadingKey)
			"
			:checking-addons="addonChecking"
			:addon-update-count="addonUpdateCount"
			:can-launch-game="Boolean(wowValidation?.valid)"
			:launching-game="gameLaunching"
			:status-text="footerStatusText"
			:status-tone="footerStatusTone"
			@check-client="checkClient"
			@cancel-client-check="cancelClientCheck"
			@check-addons="checkAddons"
			@launch-game="launchGame"
		/>

		<ClientPathModal
			v-if="shouldShowClientPathModal"
			v-model:wow-path="wowPath"
			:error="error"
			@select="selectWowPath"
			@save="saveWowPath"
		/>

		<GitHubTokenModal
			v-if="tokenModalOpen"
			v-model:token="githubToken"
			:error="tokenModalError"
			@save="saveGitHubToken"
			@clear="clearGitHubToken"
			@close="tokenModalOpen = false"
		/>

		<AccountModal
			v-if="accountModalOpen"
			v-model:login="accountLogin"
			v-model:password="accountPassword"
			:error="accountModalError"
			@save="addAccount"
			@close="accountModalOpen = false"
		/>
	</main>
</template>
