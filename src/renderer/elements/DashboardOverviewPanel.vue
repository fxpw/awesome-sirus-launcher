<script setup lang="ts">
import type {
	AppUpdateCheck,
	ClientCheckResult,
	FpsPatchStatus,
	WowPathValidation,
	WtfBackupSummary
} from '@shared/contracts'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import StatusBadge from '@renderer/components/StatusBadge.vue'
import { useLocale } from '@renderer/composables/useLocale'
import { getFpsPatchState } from '@renderer/shared/fpsPatchStatus'
import { Archive, Download, FolderOpen, Play, Puzzle, SearchCheck, Trash2, X } from '@lucide/vue'

type StatusTone = 'neutral' | 'ok' | 'warning' | 'error'

const backupWarningAgeMs = 7 * 24 * 60 * 60 * 1000
const backupErrorAgeMs = 14 * 24 * 60 * 60 * 1000

const props = defineProps<{
	wowValidation: WowPathValidation | null
	fpsPatchStatus: FpsPatchStatus | null
	clientCheckResult: ClientCheckResult | null
	latestBackup: WtfBackupSummary | null
	appUpdateCheck: AppUpdateCheck | null
	addonUpdateCount: number
	addonsChecked: boolean
	checkingAppUpdate: boolean
	installingAppUpdate: boolean
	checkingAddons: boolean
	checkingClient: boolean
	updatingClient: boolean
	installingFpsPatch: boolean
	creatingBackup: boolean
	launchingGame: boolean
}>()

defineEmits<{
	selectWowPath: []
	launchGame: []
	installFpsPatch: []
	deleteFpsPatch: []
	checkAppUpdate: []
	installAppUpdate: []
	openAddons: []
	checkClient: []
	cancelClientCheck: []
	updateClient: []
	createBackup: []
}>()

const { t } = useLocale()

function clientTone(): StatusTone {
	if (!props.clientCheckResult) return 'neutral'
	return props.clientCheckResult.missing === 0 && props.clientCheckResult.outdated === 0
		? 'ok'
		: 'warning'
}

function clientLabel(): string {
	if (!props.clientCheckResult) return t('dashboard.client.waiting')
	if (props.clientCheckResult.missing === 0 && props.clientCheckResult.outdated === 0) {
		return t('dashboard.client.ok')
	}

	return t('dashboard.client.problem', {
		missing: props.clientCheckResult.missing,
		outdated: props.clientCheckResult.outdated
	})
}

function hasClientProblems(): boolean {
	return Boolean(props.clientCheckResult?.missing || props.clientCheckResult?.outdated)
}

function addonsTone(): StatusTone {
	if (!props.addonsChecked) return 'neutral'
	return props.addonUpdateCount > 0 ? 'warning' : 'ok'
}

function addonsLabel(): string {
	if (!props.addonsChecked) return t('dashboard.addons.unknown')
	if (props.addonUpdateCount > 0) {
		return t('dashboard.addons.outdated', { count: props.addonUpdateCount })
	}

	return t('dashboard.addons.ok')
}

function formatBackupDate(backup: WtfBackupSummary | null): string {
	if (!backup) return t('dashboard.backup.none')

	return new Intl.DateTimeFormat(undefined, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(backup.createdAt))
}

function backupAgeMs(backup: WtfBackupSummary | null): number {
	if (!backup) return 0

	return Math.max(Date.now() - new Date(backup.createdAt).getTime(), 0)
}

function backupTone(): StatusTone {
	if (!props.latestBackup) return 'warning'

	const ageMs = backupAgeMs(props.latestBackup)
	if (ageMs > backupErrorAgeMs) return 'error'
	if (ageMs > backupWarningAgeMs) return 'warning'

	return 'ok'
}

function backupStatusLabel(): string {
	if (!props.latestBackup) return t('dashboard.status.makeBackup')

	const ageMs = backupAgeMs(props.latestBackup)
	if (ageMs > backupErrorAgeMs) return t('dashboard.status.backupVeryOld')
	if (ageMs > backupWarningAgeMs) return t('dashboard.status.backupOld')

	return t('dashboard.status.backedUp')
}

function appUpdateTone(): StatusTone {
	if (!props.appUpdateCheck) return 'neutral'
	return props.appUpdateCheck.updateAvailable ? 'warning' : 'ok'
}

function appUpdateLabel(): string {
	if (!props.appUpdateCheck) return t('appUpdate.unknown')
	if (props.appUpdateCheck.updateAvailable && props.appUpdateCheck.latest) {
		return t('appUpdate.available', { version: props.appUpdateCheck.latest.version })
	}

	return t('appUpdate.latest', { version: props.appUpdateCheck.currentVersion })
}
</script>

<template>
	<BasePanel class="overview-panel">
		<div class="panel-heading">
			<div>
				<h3>{{ t('dashboard.title') }}</h3>
				<p>{{ t('dashboard.description') }}</p>
			</div>
		</div>

		<div class="tile-grid">
			<div class="info-tile">
				<span class="tile-label">{{ t('dashboard.tile.clientPath') }}</span>
				<strong>{{ wowValidation?.valid ? t('wow.valid') : t('wow.invalid') }}</strong>
				<StatusBadge :tone="wowValidation?.valid ? 'ok' : 'warning'">
					{{
						wowValidation?.valid
							? t('dashboard.status.ready')
							: t('dashboard.status.chooseFolder')
					}}
				</StatusBadge>
				<div class="tile-actions">
					<BaseButton variant="secondary" @click="$emit('selectWowPath')">
						<FolderOpen :size="16" />
						{{ t('wow.select') }}
					</BaseButton>
					<BaseButton
						:disabled="!wowValidation?.valid || launchingGame"
						@click="$emit('launchGame')"
					>
						<Play :size="16" />
						{{ launchingGame ? t('game.launching') : t('game.launch') }}
					</BaseButton>
				</div>
			</div>

			<div class="info-tile">
				<span class="tile-label">{{ t('dashboard.tile.addons') }}</span>
				<strong>{{ addonsLabel() }}</strong>
				<StatusBadge :tone="addonsTone()">
					{{
						addonsChecked
							? t('dashboard.status.checked')
							: t('dashboard.status.notChecked')
					}}
				</StatusBadge>
				<div class="tile-actions">
					<BaseButton
						variant="secondary"
						:disabled="checkingAddons"
						@click="$emit('openAddons')"
					>
						<Puzzle :size="16" />
						{{
							checkingAddons
								? t('footer.checkingAddons')
								: addonUpdateCount > 0
									? t('footer.checkAddonsCount', { count: addonUpdateCount })
									: t('footer.checkAddons')
						}}
					</BaseButton>
				</div>
			</div>

			<div class="info-tile">
				<span class="tile-label">{{ t('dashboard.tile.fpsPatch') }}</span>
				<strong>{{ t(getFpsPatchState(fpsPatchStatus).labelKey) }}</strong>
				<StatusBadge :tone="getFpsPatchState(fpsPatchStatus).tone">
					{{
						fpsPatchStatus?.freshness === 'latest'
							? t('dashboard.status.installed')
							: fpsPatchStatus?.freshness === 'outdated'
								? t('dashboard.status.updateAvailable')
								: fpsPatchStatus?.installed
									? t('dashboard.status.notChecked')
									: t('dashboard.status.canInstall')
					}}
				</StatusBadge>
				<div class="tile-actions">
					<BaseButton
						v-if="!fpsPatchStatus?.installed || fpsPatchStatus.freshness === 'outdated'"
						:disabled="installingFpsPatch"
						@click="$emit('installFpsPatch')"
					>
						<Download :size="16" />
						{{
							installingFpsPatch
								? t('fpsPatch.installing')
								: fpsPatchStatus?.installed
									? t('fpsPatch.reinstall')
									: t('fpsPatch.install')
						}}
					</BaseButton>
					<BaseButton
						v-else
						variant="danger"
						:disabled="installingFpsPatch"
						@click="$emit('deleteFpsPatch')"
					>
						<Trash2 :size="16" />
						{{ t('fpsPatch.delete') }}
					</BaseButton>
				</div>
			</div>

			<div class="info-tile">
				<span class="tile-label">{{ t('dashboard.tile.clientCheck') }}</span>
				<strong>{{ clientLabel() }}</strong>
				<StatusBadge :tone="clientTone()">
					{{
						clientCheckResult
							? t('dashboard.status.checked')
							: t('dashboard.status.notChecked')
					}}
				</StatusBadge>
				<div class="tile-actions">
					<BaseButton
						:variant="checkingClient ? 'danger' : 'primary'"
						@click="checkingClient ? $emit('cancelClientCheck') : $emit('checkClient')"
					>
						<X v-if="checkingClient" :size="16" />
						<SearchCheck v-else :size="16" />
						{{ checkingClient ? t('clientCheck.stop') : t('clientCheck.check') }}
					</BaseButton>
					<BaseButton
						v-if="hasClientProblems()"
						:disabled="checkingClient || updatingClient"
						@click="$emit('updateClient')"
					>
						<Download :size="16" />
						{{
							updatingClient
								? t('clientCheck.downloadingAll')
								: t('clientCheck.updateAll')
						}}
					</BaseButton>
				</div>
			</div>

			<div class="info-tile">
				<span class="tile-label">{{ t('dashboard.tile.wtfBackup') }}</span>
				<strong>{{ formatBackupDate(latestBackup) }}</strong>
				<StatusBadge :tone="backupTone()">
					{{ backupStatusLabel() }}
				</StatusBadge>
				<div class="tile-actions">
					<BaseButton :disabled="creatingBackup" @click="$emit('createBackup')">
						<Archive :size="16" />
						{{ creatingBackup ? t('backup.creating') : t('backup.create') }}
					</BaseButton>
				</div>
			</div>

			<div class="info-tile">
				<span class="tile-label">{{ t('dashboard.tile.appUpdate') }}</span>
				<strong>{{ appUpdateLabel() }}</strong>
				<StatusBadge :tone="appUpdateTone()">
					{{
						appUpdateCheck?.updateAvailable
							? t('dashboard.status.updateAvailable')
							: appUpdateCheck
								? t('dashboard.status.ready')
								: t('dashboard.status.notChecked')
					}}
				</StatusBadge>
				<div class="tile-actions">
					<BaseButton
						v-if="appUpdateCheck?.updateAvailable"
						:disabled="installingAppUpdate"
						@click="$emit('installAppUpdate')"
					>
						<Download :size="16" />
						{{
							installingAppUpdate ? t('appUpdate.installing') : t('appUpdate.install')
						}}
					</BaseButton>
					<BaseButton
						v-else
						variant="secondary"
						:disabled="checkingAppUpdate"
						@click="$emit('checkAppUpdate')"
					>
						<Download :size="16" />
						{{ checkingAppUpdate ? t('appUpdate.checking') : t('appUpdate.check') }}
					</BaseButton>
				</div>
			</div>
		</div>
	</BasePanel>
</template>
