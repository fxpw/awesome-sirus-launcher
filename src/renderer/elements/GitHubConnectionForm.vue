<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LauncherSettingsPatch } from '@shared/contracts'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import StatusBadge from '@renderer/components/StatusBadge.vue'
import TextField from '@renderer/components/TextField.vue'
import ToggleField from '@renderer/components/ToggleField.vue'
import { useLocale } from '@renderer/composables/useLocale'

const props = defineProps<{
	enabled: boolean
	proxyUrl: string
	saving: boolean
	testing: boolean
	error: string
	notice: string
	lastCheckUsedProxy?: boolean
}>()

const emit = defineEmits<{
	save: [patch: LauncherSettingsPatch]
	test: [patch: LauncherSettingsPatch]
}>()

const { t } = useLocale()
const draftEnabled = ref(props.enabled)
const draftProxyUrl = ref(props.proxyUrl)

watch(
	() => [props.enabled, props.proxyUrl] as const,
	([enabled, proxyUrl]) => {
		draftEnabled.value = enabled
		draftProxyUrl.value = proxyUrl
	}
)

const busy = computed(() => props.saving || props.testing)
const canSubmit = computed(
	() => !busy.value && (!draftEnabled.value || draftProxyUrl.value.trim().length > 0)
)
const statusLabel = computed(() =>
	draftEnabled.value ? t('githubConnection.status.proxy') : t('githubConnection.status.direct')
)
const statusTone = computed(() => {
	if (props.error) return 'error'
	if (props.lastCheckUsedProxy !== undefined) return 'ok'
	return 'neutral'
})

function createPatch(): LauncherSettingsPatch {
	return {
		githubProxyEnabled: draftEnabled.value,
		githubProxyUrl: draftProxyUrl.value.trim()
	}
}
</script>

<template>
	<BasePanel class="github-connection-panel">
		<div class="panel-heading">
			<div>
				<h3>{{ t('githubConnection.title') }}</h3>
				<p>{{ t('githubConnection.description') }}</p>
			</div>
			<StatusBadge :tone="statusTone">{{ statusLabel }}</StatusBadge>
		</div>

		<ToggleField
			:checked="draftEnabled"
			:label="t('githubConnection.enableProxy')"
			@toggle="draftEnabled = !draftEnabled"
		/>

		<label class="field-label github-connection-field">
			<span>{{ t('githubConnection.proxyUrl') }}</span>
			<TextField
				v-model="draftProxyUrl"
				:disabled="!draftEnabled || busy"
				:placeholder="t('githubConnection.proxyUrlPlaceholder')"
			/>
		</label>

		<p class="path-hint">{{ t('githubConnection.proxyUrlHint') }}</p>
		<p class="path-hint">{{ t('githubConnection.vpnHint') }}</p>

		<div class="github-connection-actions">
			<BaseButton :disabled="!canSubmit" @click="emit('save', createPatch())">
				{{ saving ? t('githubConnection.saving') : t('githubConnection.save') }}
			</BaseButton>
			<BaseButton
				variant="secondary"
				:disabled="!canSubmit"
				@click="emit('test', createPatch())"
			>
				{{ testing ? t('githubConnection.testing') : t('githubConnection.test') }}
			</BaseButton>
		</div>

		<p v-if="error" class="error" role="alert">{{ error }}</p>
		<p v-if="notice" class="notice">
			{{ notice }}
			<span v-if="lastCheckUsedProxy !== undefined">
				{{
					lastCheckUsedProxy
						? t('githubConnection.testViaProxy')
						: t('githubConnection.testDirect')
				}}
			</span>
		</p>
	</BasePanel>
</template>
