<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'
import type {
	ClientCheckResult,
	ClientPatchCheckFile,
	ClientPatchFileInput,
	ClientPatchManifestResult
} from '@shared/contracts'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import StatusBadge from '@renderer/components/StatusBadge.vue'
import { useLocale } from '@renderer/composables/useLocale'

const props = defineProps<{
	manifest: ClientPatchManifestResult | null
	result: ClientCheckResult | null
	sourceUrls: string[]
	selectedSourceUrl: string
	checking: boolean
	loadingManifest: boolean
	clearingCache: boolean
	downloadingKey: string
	downloadingAll: boolean
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

const { t } = useLocale()
const sourceOpen = ref(false)

const checkedFilesByKey = computed(() => {
	const files = new Map<string, ClientPatchCheckFile>()
	for (const file of props.result?.files ?? []) files.set(createFileKey(file), file)

	return files
})

const tableFiles = computed(() => props.manifest?.files ?? props.result?.files ?? [])

const problemCount = computed(
	() => (props.result?.files ?? []).filter((file) => file.status !== 'ok').length
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

function statusLabelKey(status: ClientCheckResult['files'][number]['status']) {
	if (status === 'missing') return 'clientCheck.status.missing'
	if (status === 'outdated') return 'clientCheck.status.outdated'
	return 'clientCheck.status.ok'
}

function createFileKey(file: Pick<ClientPatchFileInput, 'fileName' | 'relativePath'>): string {
	return `${file.relativePath}\u0000${file.fileName}`
}

function fileStatus(file: Pick<ClientPatchFileInput, 'fileName' | 'relativePath'>) {
	return checkedFilesByKey.value.get(createFileKey(file))?.status ?? 'pending'
}

function fileStatusLabel(file: Pick<ClientPatchFileInput, 'fileName' | 'relativePath'>): string {
	const status = fileStatus(file)
	return status === 'pending' ? t('clientCheck.status.pending') : t(statusLabelKey(status))
}

function fileSize(size: number): string {
	const megabytes = size / 1024 / 1024
	if (megabytes >= 1024) return t('clientCheck.sizeGb', { size: formatSize(megabytes / 1024) })

	return t('clientCheck.sizeMb', { size: formatSize(Math.max(megabytes, 0.01)) })
}

function formatSize(size: number): string {
	return new Intl.NumberFormat(undefined, {
		maximumFractionDigits: size >= 10 ? 1 : 2,
		minimumFractionDigits: size >= 10 ? 0 : 2
	}).format(size)
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
	const nextTarget = event.relatedTarget
	if (nextTarget instanceof Node && event.currentTarget instanceof Node) {
		if (event.currentTarget.contains(nextTarget)) return
	}

	sourceOpen.value = false
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
					:disabled="
						checking ||
						loadingManifest ||
						clearingCache ||
						downloadingAll ||
						Boolean(downloadingKey)
					"
					@click="$emit('clearCache')"
				>
					{{ clearingCache ? t('clientCheck.clearingCache') : t('clientCheck.clearCache') }}
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
				<StatusBadge :tone="result ? (problemCount === 0 ? 'ok' : 'warning') : undefined">
					{{
						t('clientCheck.checkedCount', { checked: checkedCount, total: totalCount })
					}}
				</StatusBadge>
				<StatusBadge :tone="result ? (problemCount === 0 ? 'ok' : 'warning') : undefined">
					{{ t('clientCheck.problemCount', { total: problemCount }) }}
				</StatusBadge>
			</div>
			<div class="client-check-summary__meta">
				<span>{{ t('clientCheck.manifestLoaded', { total: totalCount }) }}</span>
				<span class="path-text">{{ manifest?.sourceUrl ?? selectedSourceUrl }}</span>
			</div>
		</div>

		<div v-if="tableFiles.length > 0" class="client-files-table">
			<div class="client-files-table__head">
				<span>{{ t('clientCheck.table.file') }}</span>
				<span>{{ t('clientCheck.table.size') }}</span>
				<span>{{ t('clientCheck.table.status') }}</span>
				<span>{{ t('clientCheck.table.action') }}</span>
			</div>
			<div
				v-for="file in tableFiles"
				:key="createFileKey(file)"
				class="client-files-table__row"
			>
				<div class="path-text">
					<strong>{{ file.fileName }}</strong>
					<span>{{ file.relativePath }}</span>
				</div>
				<span>{{ fileSize(file.expectedSize) }}</span>
				<StatusBadge
					:tone="
						fileStatus(file) === 'ok'
							? 'ok'
							: fileStatus(file) === 'pending'
								? undefined
								: 'warning'
					"
				>
					{{ fileStatusLabel(file) }}
				</StatusBadge>
				<BaseButton
					variant="secondary"
					:disabled="downloadingKey === createFileKey(file) || downloadingAll"
					@click="
						$emit('downloadFile', {
							fileName: file.fileName,
							relativePath: file.relativePath
						})
					"
				>
					{{
						downloadingKey === createFileKey(file)
							? t('clientCheck.downloading')
							: t('clientCheck.downloadFile')
					}}
				</BaseButton>
			</div>
		</div>
	</BasePanel>
</template>
