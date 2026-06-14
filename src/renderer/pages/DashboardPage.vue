<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type {
  AppInfo,
  FpsPatchStatus,
  GitHubTokenStatus,
  LauncherSettings,
  WowPathValidation,
  WtfBackupSummary
} from '@shared/contracts'
import AppSidebar from '@renderer/blocks/AppSidebar.vue'
import DashboardHeader from '@renderer/blocks/DashboardHeader.vue'
import FpsPatchPanel from '@renderer/elements/FpsPatchPanel.vue'
import GitHubTokenForm from '@renderer/elements/GitHubTokenForm.vue'
import LaunchBehaviorForm from '@renderer/elements/LaunchBehaviorForm.vue'
import WowPathForm from '@renderer/elements/WowPathForm.vue'
import WtfBackupPanel from '@renderer/elements/WtfBackupPanel.vue'
import { launcherApi } from '@renderer/api/launcherApi'
import { useLocale } from '@renderer/composables/useLocale'
import { useTheme } from '@renderer/composables/useTheme'

const appInfo = ref<AppInfo | null>(null)
const githubTokenStatus = ref<GitHubTokenStatus>({ configured: false })
const settings = ref<LauncherSettings | null>(null)
const wowPath = ref('')
const wowValidation = ref<WowPathValidation | null>(null)
const backups = ref<WtfBackupSummary[]>([])
const fpsPatchStatus = ref<FpsPatchStatus | null>(null)
const fpsPatchInstalling = ref(false)
const githubToken = ref('')
const error = ref('')
const notice = ref('')

const { t } = useLocale()
useTheme()

onMounted(async () => {
	appInfo.value = await launcherApi.app.getInfo()
	githubTokenStatus.value = await launcherApi.github.getTokenStatus()
  settings.value = await launcherApi.settings.get()
  backups.value = await launcherApi.backup.listWtf()
  fpsPatchStatus.value = await launcherApi.fpsPatch.getStatus()
  wowPath.value = settings.value.wowPath
	if (wowPath.value) await validateWowPath()
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
	settings.value = await launcherApi.settings.selectWowPath()
	wowPath.value = settings.value.wowPath
  fpsPatchStatus.value = await launcherApi.fpsPatch.getStatus()
	if (wowPath.value) await validateWowPath()
}

async function saveWowPath(): Promise<void> {
	error.value = ''
	notice.value = ''
	settings.value = await launcherApi.settings.save({ wowPath: wowPath.value })
	wowPath.value = settings.value.wowPath
	await validateWowPath()
  fpsPatchStatus.value = await launcherApi.fpsPatch.getStatus()
	notice.value = t('wow.saved')
}

async function toggleSetting(
	key: 'closeOnLaunch' | 'checkClientBeforeLaunch' | 'allowPrereleaseUpdates'
): Promise<void> {
	if (!settings.value) return
	settings.value = await launcherApi.settings.save({ [key]: !settings.value[key] })
}

async function saveGitHubToken(): Promise<void> {
	error.value = ''
	notice.value = ''
	githubTokenStatus.value = await launcherApi.github.saveToken({ token: githubToken.value })
	githubToken.value = ''
	notice.value = t('token.saved')
}

async function clearGitHubToken(): Promise<void> {
	error.value = ''
	notice.value = ''
	githubTokenStatus.value = await launcherApi.github.clearToken()
	githubToken.value = ''
  notice.value = t('token.cleared')
}

async function createWtfBackup(): Promise<void> {
  error.value = ''
  notice.value = ''
  const result = await launcherApi.backup.createWtf()
  backups.value = [result.backup, ...backups.value.filter((backup) => backup.id !== result.backup.id)]
  notice.value = t('backup.created')
}

async function restoreWtfBackup(backup: WtfBackupSummary): Promise<void> {
  if (!confirm(t('backup.restoreConfirm', { name: backup.fileName }))) return

  error.value = ''
  notice.value = ''
  await launcherApi.backup.restoreWtf({ id: backup.id })
  backups.value = await launcherApi.backup.listWtf()
  notice.value = t('backup.restored')
}

async function deleteWtfBackup(backup: WtfBackupSummary): Promise<void> {
  if (!confirm(t('backup.deleteConfirm', { name: backup.fileName }))) return

  error.value = ''
  notice.value = ''
  const result = await launcherApi.backup.deleteWtf({ id: backup.id })
  backups.value = backups.value.filter((item) => item.id !== result.deletedId)
  notice.value = t('backup.deleted')
}

async function openWtfBackupFolder(): Promise<void> {
  error.value = ''
  await launcherApi.backup.openWtfFolder()
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
</script>

<template>
	<main class="shell">
		<AppSidebar :app-info="appInfo" />

		<section class="workspace">
			<DashboardHeader :github-token-status="githubTokenStatus" />

			<WowPathForm
				v-model:wow-path="wowPath"
				:validation="wowValidation"
				:error="error"
				:notice="notice"
				@select="selectWowPath"
				@save="saveWowPath"
			/>

      <LaunchBehaviorForm v-if="settings" :settings="settings" @toggle="toggleSetting" />

      <FpsPatchPanel
        :status="fpsPatchStatus"
        :installing="fpsPatchInstalling"
        @install="installFpsPatch"
      />

      <WtfBackupPanel
        :backups="backups"
        @create="createWtfBackup"
        @restore="restoreWtfBackup"
        @delete="deleteWtfBackup"
        @open-folder="openWtfBackupFolder"
      />

      <GitHubTokenForm
				v-model:token="githubToken"
				@save="saveGitHubToken"
				@clear="clearGitHubToken"
			/>
		</section>
	</main>
</template>
