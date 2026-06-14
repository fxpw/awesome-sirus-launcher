<script setup lang="ts">
import type { LauncherSettings } from '@shared/contracts'
import BasePanel from '@renderer/components/BasePanel.vue'
import ToggleField from '@renderer/components/ToggleField.vue'
import { useLocale } from '@renderer/composables/useLocale'

defineProps<{
	settings: LauncherSettings
}>()

defineEmits<{
	toggle: [key: 'closeOnLaunch' | 'checkClientBeforeLaunch' | 'allowPrereleaseUpdates']
}>()

const { t } = useLocale()
</script>

<template>
	<BasePanel>
		<div>
			<h3>{{ t('launch.title') }}</h3>
			<p>{{ t('launch.description') }}</p>
		</div>

		<ToggleField
			:checked="settings.checkClientBeforeLaunch"
			:label="t('launch.checkClient')"
			@toggle="$emit('toggle', 'checkClientBeforeLaunch')"
		/>
		<ToggleField
			:checked="settings.closeOnLaunch"
			:label="t('launch.closeOnLaunch')"
			@toggle="$emit('toggle', 'closeOnLaunch')"
		/>
		<ToggleField
			:checked="settings.allowPrereleaseUpdates"
			:label="t('launch.prereleaseUpdates')"
			@toggle="$emit('toggle', 'allowPrereleaseUpdates')"
		/>
	</BasePanel>
</template>
