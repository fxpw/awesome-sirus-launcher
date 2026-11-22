<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'
import type {
	ClientCheckResult,
	ClientCheckProgress,
	ClientPatchCheckFile,
	ClientPatchFileInput,
	ClientPatchManifestResult
} from '@shared/contracts'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import StatusBadge from '@renderer/components/StatusBadge.vue'
import { useLocale } from '@renderer/composables/useLocale'
import { createClientFileKey } from '@renderer/shared/clientPatchFiles'
import { isFocusLeaving } from '@renderer/shared/focus'

const props = defineProps<{
	manifest: ClientPatchManifestResult | null
	result: ClientCheckResult | null
	sourceUrls: readonly string[]
	selectedSourceUrl: string
	checking: boolean
	loadingManifest: boolean
	clearingCache: boolean
	downloadingKey: string
	downloadingAll: boolean
	progress: ClientCheckProgress | null
}>()

const emit = defineEmits<{
	selectSource: [sourceUrl: string]
	load: []
	check: []
	cancelCheck: []
	clearCache: []
	downloadFile: [input: ClientPatchFileInput]
	downloadMissing: []
}>()

const sizeFormat = new Intl.NumberFormat(undefined, {
	maximumFractionDigits: 2,
	minimumFractionDigits: 2
})
const largeSizeFormat = new Intl.NumberFormat(undefined, {
	maximumFractionDigits: 1,
	minimumFractionDigits: 0
})

const { t } = useLocale()
const sourceOpen = ref(false)

const checkedFilesByKey = computed(() => {
	const files = new Map<string, ClientPatchCheckFile>()
	for (const file of props.result?.files ?? []) files.set(createClientFileKey(file), file)

	return files
})

const tableRows = computed(() =>
	(props.manifest?.files ?? props.result?.files ?? []).map((file) => {
		const key = createClientFileKey(file)
		const status = checkedFilesByKey.value.get(key)?.status ?? 'pending'
		return {
			key,
			file,
			status,
			size: fileSize(file.expectedSize),
			statusLabel:
				status === 'pending' ? t('clientCheck.status.pending') : t(statusLabelKey(status))
		}
	})
)

const problemCount = computed(
	() => (props.result?.files ?? []).filter((file) => file.status !== 'ok').length
)
const summaryTone = computed(() =>
	props.result ? (problemCount.value === 0 ? 'ok' : 'warning') : undefined
)
const canDownloadMissing = computed(() => problemCount.value > 0)
const checkedCount = computed(() => props.result?.files.length ?? 0)
const totalCount = computed(() => props.manifest?.total ?? props.result?.total ?? 0)
const sourceDisabled = computed(
	() =>
		props.loadingManifest ||
		props.checking ||
		props.clearingCache ||
		props.downloadingAll ||
		Boolean(props.downloadingKey)
)
const progressLabel = computed(() => {
	if (!props.progress) return ''
	if (props.progress.phase === 'completed') return t('clientCheck.progress.completed')
	if (props.progress.fileName) {
		return t('clientCheck.progress.checkingFile', {
			file: props.progress.fileName,
			current: props.progress.current,
			total: props.progress.total
		})
	}

	return t('clientCheck.progress.checking', {
		current: props.progress.current,
		total: props.progress.total
	})
})

function statusLabelKey(status: ClientCheckResult['files'][number]['status']) {
	if (status === 'missing') return 'clientCheck.status.missing'
	if (status === 'outdated') return 'clientCheck.status.outdated'
	return 'clientCheck.status.ok'
}

function fileSize(size: number): string {
	const megabytes = size / 1024 / 1024
	if (megabytes >= 1024) return t('clientCheck.sizeGb', { size: formatSize(megabytes / 1024) })

	return t('clientCheck.sizeMb', { size: formatSize(Math.max(megabytes, 0.01)) })
}

function formatSize(size: number): string {
	return (size >= 10 ? largeSizeFormat : sizeFormat).format(size)
}

function toggleSourceMenu(): void {
	if (sourceDisabled.value) return
	sourceOpen.value = !sourceOpen.value
}

function selectSource(sourceUrl: string): void {
	sourceOpen.value = false
	emit('selectSource', sourceUrl)
}

function closeSourceMenu(event: FocusEvent): void {
	if (isFocusLeaving(event)) sourceOpen.value = false
}
</script>

<template>
	<BasePanel>
		<div class="panel-heading">
			<div>
				<h3>{{ t('clientCheck.title') }}</h3>
				<p>{{ t('clientCheck.description') }}</p>
			</div>
			<div class="panel-heading__actions">
				<div class="source-select" @focusout="closeSourceMenu">
					<span>{{ t('clientCheck.source') }}</span>
					<button
						class="source-select__button"
						type="button"
						:disabled="sourceDisabled"
						:aria-expanded="sourceOpen"
						@click="toggleSourceMenu"
					>
						<span>{{ selectedSourceUrl }}</span>
						<ChevronDown :size="16" />
					</button>
					<div v-if="sourceOpen" class="source-select__menu">
						<button
							v-for="sourceUrl in sourceUrls"
							:key="sourceUrl"
							class="source-select__option"
							:class="{
								'source-select__option--active': sourceUrl === selectedSourceUrl
							}"
							type="button"
							@click="selectSource(sourceUrl)"
						>
							<span>{{ sourceUrl }}</span>
							<Check v-if="sourceUrl === selectedSourceUrl" :size="16" />
						</button>
					</div>
				</div>
				<BaseButton variant="secondary" :disabled="loadingManifest" @click="$emit('load')">
					{{ loadingManifest ? t('clientCheck.loading') : t('clientCheck.load') }}
				</BaseButton>
				<BaseButton
					:variant="checking ? 'danger' : 'primary'"
					:disabled="!checking && !manifest"
					@click="checking ? $emit('cancelCheck') : $emit('check')"
				>
					{{ checking ? t('clientCheck.stop') : t('clientCheck.check') }}
				</BaseButton>
				<BaseButton
					variant="secondary"
					:disabled="sourceDisabled"
					@click="$emit('clearCache')"
				>
					{{
						clearingCache ? t('clientCheck.clearingCache') : t('clientCheck.clearCache')
					}}
				</BaseButton>
				<BaseButton
					v-if="canDownloadMissing"
					:disabled="
						checking || loadingManifest || downloadingAll || Boolean(downloadingKey)
					"
					@click="$emit('downloadMissing')"
				>
					{{
						downloadingAll
							? t('clientCheck.downloadingAll')
							: t('clientCheck.updateAll')
					}}
				</BaseButton>
			</div>
		</div>

		<div class="client-check-summary">
			<div class="client-check-summary__status">
				<StatusBadge :tone="summaryTone">
					{{
						t('clientCheck.checkedCount', { checked: checkedCount, total: totalCount })
					}}
				</StatusBadge>
				<StatusBadge :tone="summaryTone">
					{{ t('clientCheck.problemCount', { total: problemCount }) }}
				</StatusBadge>
			</div>
			<div class="client-check-summary__meta">
				<span>{{ t('clientCheck.manifestLoaded', { total: totalCount }) }}</span>
				<span class="path-text">{{ manifest?.sourceUrl ?? selectedSourceUrl }}</span>
			</div>
		</div>

		<div v-if="progress" class="operation-progress">
			<div class="operation-progress__meta">
				<strong>{{ t('clientCheck.progress.title') }}</strong>
				<span>{{ progressLabel }}</span>
			</div>
			<div class="operation-progress__bar" aria-hidden="true">
				<span :style="{ width: `${progress.percent}%` }" />
			</div>
			<div class="operation-progress__stats">
				<span>{{ progress.percent }}%</span>
				<span>{{ progress.current }} / {{ progress.total }}</span>
			</div>
		</div>

		<div v-if="tableRows.length > 0" class="client-files-table">
			<div class="client-files-table__head">
				<span>{{ t('clientCheck.table.file') }}</span>
				<span>{{ t('clientCheck.table.size') }}</span>
				<span>{{ t('clientCheck.table.status') }}</span>
				<span>{{ t('clientCheck.table.action') }}</span>
			</div>
			<div v-for="row in tableRows" :key="row.key" class="client-files-table__row">
				<div class="path-text">
					<strong>{{ row.file.fileName }}</strong>
					<span>{{ row.file.relativePath }}</span>
				</div>
				<span>{{ row.size }}</span>
				<StatusBadge
					:tone="
						row.status === 'ok'
							? 'ok'
							: row.status === 'pending'
								? undefined
								: 'warning'
					"
				>
					{{ row.statusLabel }}
				</StatusBadge>
				<BaseButton
					variant="secondary"
					:disabled="downloadingKey === row.key || downloadingAll"
					@click="
						$emit('downloadFile', {
							fileName: row.file.fileName,
							relativePath: row.file.relativePath
						})
					"
				>
					{{
						downloadingKey === row.key
							? t('clientCheck.downloading')
							: t('clientCheck.downloadFile')
					}}
				</BaseButton>
			</div>
		</div>
	</BasePanel>
</template>
