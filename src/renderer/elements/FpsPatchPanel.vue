<script setup lang="ts">
import type { FpsPatchStatus } from '@shared/contracts'
import { Download, RefreshCw, Trash2 } from '@lucide/vue'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import StatusBadge from '@renderer/components/StatusBadge.vue'
import { useLocale } from '@renderer/composables/useLocale'

const props = defineProps<{
	status: FpsPatchStatus | null
	installing: boolean
}>()

defineEmits<{
	install: []
	delete: []
}>()

const { t } = useLocale()

function statusTone(): 'neutral' | 'ok' | 'warning' {
	if (!props.status?.installed) return 'warning'
	if (props.status.freshness === 'latest') return 'ok'
	if (props.status.freshness === 'outdated') return 'warning'
	return 'neutral'
}

function statusLabel(): string {
	if (!props.status?.installed) return t('fpsPatch.missing')
	if (props.status.freshness === 'latest') return t('fpsPatch.latest')
	if (props.status.freshness === 'outdated') return t('fpsPatch.outdated')
	return t('fpsPatch.unknown')
}

function formatSize(size?: number): string {
	if (!size) return ''
	return t('fpsPatch.size', { size: Math.max(1, Math.round(size / 1024)) })
}

function formatHash(hash?: string): string {
	if (!hash) return ''
	return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}
</script>

<template>
	<BasePanel>
		<div class="panel-heading">
			<div>
				<h3>{{ t('fpsPatch.title') }}</h3>
				<p>{{ t('fpsPatch.description') }}</p>
			</div>
			<div class="patch-actions">
				<BaseButton :disabled="installing" @click="$emit('install')">
					<RefreshCw v-if="props.status?.installed" :size="18" />
					<Download v-else :size="18" />
					{{
						installing
							? t('fpsPatch.installing')
							: props.status?.installed
								? t('fpsPatch.reinstall')
								: t('fpsPatch.install')
					}}
				</BaseButton>
				<StatusBadge :tone="statusTone()">
					{{ statusLabel() }}
				</StatusBadge>
				<BaseButton
					v-if="status?.installed"
					variant="danger"
					:disabled="installing"
					@click="$emit('delete')"
				>
					<Trash2 :size="18" />
					{{ t('fpsPatch.delete') }}
				</BaseButton>
			</div>
		</div>

		<div class="result">
			<p v-if="status?.patchPath" class="path-text">{{ status.patchPath }}</p>
			<p v-if="status?.size">
				{{ t('fpsPatch.localSize', { size: formatSize(status.size) }) }}
			</p>
			<p v-if="status?.remoteSize">
				{{ t('fpsPatch.remoteSize', { size: formatSize(status.remoteSize) }) }}
			</p>
			<p v-if="status?.remoteBuild">
				{{ t('fpsPatch.remoteBuild', { build: status.remoteBuild }) }}
			</p>
			<p v-if="status?.remoteHash">
				{{ t('fpsPatch.remoteHash', { hash: formatHash(status.remoteHash) }) }}
			</p>
			<p v-if="status?.localHash">
				{{ t('fpsPatch.localHash', { hash: formatHash(status.localHash) }) }}
			</p>
			<p v-if="status?.remoteUpdatedAt">
				{{
					t('fpsPatch.remoteUpdatedAt', {
						date: new Date(status.remoteUpdatedAt).toLocaleString()
					})
				}}
			</p>
			<p v-if="status?.checkError" class="muted-text">
				{{ t('fpsPatch.checkError') }}
			</p>
		</div>
	</BasePanel>
</template>
