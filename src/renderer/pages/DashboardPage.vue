<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type {
	AccountListResult,
	AddonsListResult,
	AppInfo,
	AppUpdateCheck,
	ClientCheckResult,
	ClientPatchFileInput,
	ClientPatchManifestResult,
	FpsPatchStatus,
	GitHubTokenStatus,
	LauncherSettings,
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
import GitHubTokenForm from '@renderer/elements/GitHubTokenForm.vue'
import GitHubTokenModal from '@renderer/elements/GitHubTokenModal.vue'
import LaunchBehaviorForm from '@renderer/elements/LaunchBehaviorForm.vue'
import MiningPanel from '@renderer/elements/MiningPanel.vue'
import ThanksPanel from '@renderer/elements/ThanksPanel.vue'
import WowPathForm from '@renderer/elements/WowPathForm.vue'
import WtfBackupPanel from '@renderer/elements/WtfBackupPanel.vue'
import { launcherApi } from '@renderer/api/launcherApi'
import { useLocale } from '@renderer/composables/useLocale'
import { useTheme } from '@renderer/composables/useTheme'
import type { MessageKey } from '@renderer/shared/i18n'

type LauncherSection =
	| 'dashboard'
	| 'addons'
	| 'client'
	| 'patch'
	| 'wtf'
	| 'mining'
	| 'settings'
	| 'thanks'

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
const clientManifestLoading = ref(false)
const clientClearingCache = ref(false)
const clientDownloadingKey = ref('')
const clientDownloadingAll = ref(false)
const addonChecking = ref(false)
const addonCheckResult = ref<AddonsListResult | null>(null)
const miningState = ref<MiningState | null>(null)
const miningWorking = ref(false)
const githubToken = ref('')
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

const { t } = useLocale()
useTheme()

const latestBackup = computed(() => backups.value[0] ?? null)
const activeTitle = computed(() => t(sectionTitleKeys[activeSection.value]))
const activeEyebrow = computed(() => t(sectionEyebrowKeys[activeSection.value]))
const clientProblemCount = computed(
	() => (clientCheckResult.value?.missing ?? 0) + (clientCheckResult.value?.outdated ?? 0)
)
const addonUpdateCount = computed(
	() => addonCheckResult.value?.addons.filter((addon) => addon.status === 'outdated').length ?? 0
)
const footerStatusTone = computed(() => {
	if (error.value) return 'error'
	if (clientProblemCount.value > 0) return 'warning'
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
	try {
		appInfo.value = await launcherApi.app.getInfo()
		void checkAppUpdate()
		githubTokenStatus.value = await launcherApi.github.getTokenStatus()
		accounts.value = await launcherApi.accounts.list()
		settings.value = await launcherApi.settings.get()
		backups.value = await launcherApi.backup.listWtf()
		fpsPatchStatus.value = await launcherApi.fpsPatch.getStatus()
		miningState.value = await launcherApi.mining.getState()
		wowPath.value = settings.value.wowPath
		if (wowPath.value) {
			await validateWowPath()
			if (wowValidation.value?.valid) {
				if (settings.value.checkClientBeforeLaunch) {
					await checkClient()
				}
				await scanAddonsOnStartup()
			}
		}
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('app.initError')
	}

	miningPollTimer = window.setInterval(() => {
		if (miningState.value?.status === 'running') void refreshMiningState()
	}, 2500)
})

onUnmounted(() => {
	if (miningPollTimer) window.clearInterval(miningPollTimer)
})

async function validateWowPath(): Promise<void> {
	error.value = ''
	try {
		wowValidation.value = await launcherApi.wow.validatePath(wowPath.value)
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('wow.validateError')
	}
}

async function selectWowPath(): Promise<void> {
	error.value = ''
	notice.value = ''
	try {
		settings.value = await launcherApi.settings.selectWowPath()
		wowPath.value = settings.value.wowPath
		fpsPatchStatus.value = await launcherApi.fpsPatch.getStatus()
		if (wowPath.value) await validateWowPath()
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('wow.selectError')
	}
}

async function saveWowPath(): Promise<void> {
	error.value = ''
	notice.value = ''
	try {
		settings.value = await launcherApi.settings.save({ wowPath: wowPath.value })
		wowPath.value = settings.value.wowPath
		await validateWowPath()
		fpsPatchStatus.value = await launcherApi.fpsPatch.getStatus()
		notice.value = t('wow.saved')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('wow.saveError')
	}
}

async function toggleSetting(
	key: 'closeOnLaunch' | 'checkClientBeforeLaunch' | 'autoUpdateAddons' | 'allowPrereleaseUpdates'
): Promise<void> {
	if (!settings.value) return
	settings.value = await launcherApi.settings.save({ [key]: !settings.value[key] })
}

async function checkAppUpdate(): Promise<void> {
	error.value = ''
	appUpdateChecking.value = true
	try {
		appUpdateCheck.value = await launcherApi.app.checkUpdate()
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('appUpdate.checkError')
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
		error.value = err instanceof Error ? err.message : t('appUpdate.installError')
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
		const message = err instanceof Error ? err.message : t('token.saveError')
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
		const message = err instanceof Error ? err.message : t('token.clearError')
		if (tokenModalOpen.value) tokenModalError.value = message
		else error.value = message
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
		accountModalError.value = err instanceof Error ? err.message : t('account.saveError')
	}
}

async function selectAccount(accountId: string): Promise<void> {
	error.value = ''
	notice.value = ''
	try {
		accounts.value = await launcherApi.accounts.select({ accountId })
		notice.value = t('account.selected')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('account.selectError')
	}
}

async function createWtfBackup(): Promise<void> {
	error.value = ''
	notice.value = ''
	wtfBackupCreating.value = true
	try {
		const result = await launcherApi.backup.createWtf()
		backups.value = [
			result.backup,
			...backups.value.filter((backup) => backup.id !== result.backup.id)
		]
		notice.value = t('backup.created')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('backup.createError')
	} finally {
		wtfBackupCreating.value = false
	}
}

async function restoreWtfBackup(backup: WtfBackupSummary): Promise<void> {
	if (!confirm(t('backup.restoreConfirm', { name: backup.fileName }))) return

	error.value = ''
	notice.value = ''
	try {
		await launcherApi.backup.restoreWtf({ id: backup.id })
		backups.value = await launcherApi.backup.listWtf()
		notice.value = t('backup.restored')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('backup.restoreError')
	}
}

async function deleteWtfBackup(backup: WtfBackupSummary): Promise<void> {
	if (!confirm(t('backup.deleteConfirm', { name: backup.fileName }))) return

	error.value = ''
	notice.value = ''
	try {
		const result = await launcherApi.backup.deleteWtf({ id: backup.id })
		backups.value = backups.value.filter((item) => item.id !== result.deletedId)
		notice.value = t('backup.deleted')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('backup.deleteError')
	}
}

async function openWtfBackupFolder(): Promise<void> {
	error.value = ''
	try {
		await launcherApi.backup.openWtfFolder()
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('backup.openError')
	}
}

async function installFpsPatch(): Promise<void> {
	error.value = ''
	notice.value = ''
	fpsPatchInstalling.value = true
	try {
		const result = await launcherApi.fpsPatch.install()
		fpsPatchStatus.value = result.status
		notice.value = t('fpsPatch.installedNotice')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('fpsPatch.installError')
	} finally {
		fpsPatchInstalling.value = false
	}
}

async function deleteFpsPatch(): Promise<void> {
	error.value = ''
	notice.value = ''
	fpsPatchInstalling.value = true
	try {
		const result = await launcherApi.fpsPatch.delete()
		fpsPatchStatus.value = result.status
		notice.value = t('fpsPatch.deletedNotice')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('fpsPatch.deleteError')
	} finally {
		fpsPatchInstalling.value = false
	}
}

async function launchGame(): Promise<void> {
	error.value = ''
	notice.value = ''
	gameLaunching.value = true
	try {
		if (miningState.value?.status === 'running') {
			miningState.value = await launcherApi.mining.stop()
		}
		await launcherApi.wow.launchGame()
		notice.value = t('game.launched')
		if (settings.value?.closeOnLaunch) window.close()
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('game.launchError')
	} finally {
		gameLaunching.value = false
	}
}

async function checkClient(): Promise<void> {
	error.value = ''
	notice.value = ''
	clientChecking.value = true
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
		const message = err instanceof Error ? err.message : t('clientCheck.error')
		if (message === 'Проверка клиента остановлена') notice.value = t('clientCheck.stopped')
		else error.value = message
	} finally {
		clientChecking.value = false
	}
}

async function cancelClientCheck(): Promise<void> {
	error.value = ''
	notice.value = ''
	try {
		await launcherApi.client.cancelCheck()
		notice.value = t('clientCheck.stopping')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('clientCheck.stopError')
	}
}

async function clearClientCheckCache(): Promise<void> {
	error.value = ''
	notice.value = ''
	clientClearingCache.value = true
	try {
		await launcherApi.client.clearCheckCache()
		notice.value = t('clientCheck.cacheCleared')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('clientCheck.clearCacheError')
	} finally {
		clientClearingCache.value = false
	}
}

async function loadClientManifest(): Promise<void> {
	error.value = ''
	notice.value = ''
	clientManifestLoading.value = true
	try {
		clientPatchManifest.value = await launcherApi.client.list({
			sourceUrl: selectedClientPatchSourceUrl.value
		})
		selectedClientPatchSourceUrl.value = clientPatchManifest.value.sourceUrl
		notice.value = t('clientCheck.loaded')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('clientCheck.loadError')
	} finally {
		clientManifestLoading.value = false
	}
}

async function downloadClientFile(input: ClientPatchFileInput): Promise<void> {
	error.value = ''
	notice.value = ''
	clientDownloadingKey.value = createClientFileKey(input)
	try {
		await launcherApi.client.downloadFile({
			...input,
			sourceUrl: selectedClientPatchSourceUrl.value
		})
		clientCheckResult.value = await launcherApi.client.check({
			sourceUrl: selectedClientPatchSourceUrl.value
		})
		selectedClientPatchSourceUrl.value = clientCheckResult.value.sourceUrl
		notice.value = t('clientCheck.downloadedFile')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('clientCheck.downloadError')
	} finally {
		clientDownloadingKey.value = ''
	}
}

async function downloadMissingClientFiles(): Promise<void> {
	error.value = ''
	notice.value = ''
	clientDownloadingAll.value = true
	try {
		const result = await launcherApi.client.downloadMissing({
			sourceUrl: selectedClientPatchSourceUrl.value
		})
		clientCheckResult.value = await launcherApi.client.check({
			sourceUrl: selectedClientPatchSourceUrl.value
		})
		selectedClientPatchSourceUrl.value = clientCheckResult.value.sourceUrl
		notice.value = t('clientCheck.downloadedAll', { total: result.total })
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('clientCheck.downloadError')
	} finally {
		clientDownloadingAll.value = false
	}
}

function createClientFileKey(input: ClientPatchFileInput): string {
	return `${input.relativePath}\u0000${input.fileName}`
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
		notice.value = t('addons.updatedAll', { total: result.total })
		addonCheckResult.value = await launcherApi.addons.check()
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('addons.error')
	} finally {
		addonChecking.value = false
	}
}

async function runAddonCheck(): Promise<void> {
	addonChecking.value = true
	try {
		const result = await launcherApi.addons.check()
		addonCheckResult.value = result
		notice.value = t('footer.status.addonsChecked', { total: result.total })
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('addons.error')
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
	notice.value = t('footer.status.addonsChecked', { total: result.total })
}

async function saveMiningConfig(patch: MiningConfigInput): Promise<void> {
	error.value = ''
	notice.value = ''
	miningWorking.value = true
	try {
		miningState.value = await launcherApi.mining.saveConfig(patch)
		notice.value = t('mining.saved')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('mining.saveError')
	} finally {
		miningWorking.value = false
	}
}

async function selectMinerPath(): Promise<void> {
	error.value = ''
	notice.value = ''
	miningWorking.value = true
	try {
		miningState.value = await launcherApi.mining.selectMinerPath()
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('mining.selectError')
	} finally {
		miningWorking.value = false
	}
}

async function startMining(): Promise<void> {
	error.value = ''
	notice.value = ''
	miningWorking.value = true
	try {
		miningState.value = await launcherApi.mining.start()
		notice.value = t('mining.started')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('mining.startError')
	} finally {
		miningWorking.value = false
	}
}

async function stopMining(): Promise<void> {
	error.value = ''
	notice.value = ''
	miningWorking.value = true
	try {
		miningState.value = await launcherApi.mining.stop()
		notice.value = t('mining.stopped')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('mining.stopError')
	} finally {
		miningWorking.value = false
	}
}

async function resetMiningStats(): Promise<void> {
	if (!confirm(t('mining.resetConfirm'))) return

	error.value = ''
	notice.value = ''
	miningWorking.value = true
	try {
		miningState.value = await launcherApi.mining.resetStats()
		notice.value = t('mining.statsReset')
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('mining.resetError')
	} finally {
		miningWorking.value = false
	}
}

async function refreshMiningState(): Promise<void> {
	try {
		miningState.value = await launcherApi.mining.getState()
	} catch {
		// Footer already carries actionable errors from direct user actions.
	}
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
					/>

					<ClientCheckPanel
						v-else-if="activeSection === 'client'"
						:manifest="clientPatchManifest"
						:result="clientCheckResult"
						:source-urls="[...clientPatchSourceUrls]"
						:selected-source-url="selectedClientPatchSourceUrl"
						:checking="clientChecking"
						:loading-manifest="clientManifestLoading"
						:clearing-cache="clientClearingCache"
						:downloading-key="clientDownloadingKey"
						:downloading-all="clientDownloadingAll"
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

						<LaunchBehaviorForm
							v-if="settings"
							:settings="settings"
							@toggle="toggleSetting"
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
