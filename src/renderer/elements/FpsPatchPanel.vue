<script setup lang="ts">
import type { FpsPatchStatus } from '@shared/contracts'
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
}>()

const { t } = useLocale()

function formatSize(size?: number): string {
	if (!size) return ''
	return t('fpsPatch.size', { size: Math.max(1, Math.round(size / 1024)) })
}
</script>

<template>
	<BasePanel>
		<div class="panel-heading">
			<div>
				<h3>{{ t('fpsPatch.title') }}</h3>
				<p>{{ t('fpsPatch.description') }}</p>
			</div>
			<BaseButton :disabled="installing" @click="$emit('install')">
				{{
					installing
						? t('fpsPatch.installing')
						: props.status?.installed
							? t('fpsPatch.reinstall')
							: t('fpsPatch.install')
				}}
			</BaseButton>
		</div>

		<div class="result">
			<StatusBadge :ok="Boolean(status?.installed)">
				{{ status?.installed ? t('fpsPatch.installed') : t('fpsPatch.missing') }}
			</StatusBadge>
			<p v-if="status?.patchPath" class="path-text">{{ status.patchPath }}</p>
			<p v-if="status?.size">{{ formatSize(status.size) }}</p>
		</div>
	</BasePanel>
</template>
