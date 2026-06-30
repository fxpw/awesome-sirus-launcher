<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import TextField from '@renderer/components/TextField.vue'
import { useLocale } from '@renderer/composables/useLocale'

const props = defineProps<{
	wtfBackupPath: string
	wowPath: string
	error: string
	notice: string
}>()

defineEmits<{
	'update:wtfBackupPath': [value: string]
	select: []
	save: []
	reset: []
}>()

const { t } = useLocale()

const defaultPathHint = computed(() => {
	if (!props.wowPath.trim()) return t('backup.path.defaultMissingWow')
	return t('backup.path.defaultHint', { path: `${props.wowPath}\\wtf_backup` })
})
</script>

<template>
	<BasePanel>
		<div>
			<h3>{{ t('backup.path.title') }}</h3>
			<p>{{ t('backup.path.description') }}</p>
		</div>

		<div class="path-row backup-path-row">
			<TextField
				:model-value="wtfBackupPath"
				:placeholder="t('backup.path.placeholder')"
				@update:model-value="$emit('update:wtfBackupPath', $event)"
			/>
			<BaseButton @click="$emit('select')">{{ t('backup.path.select') }}</BaseButton>
			<BaseButton @click="$emit('save')">{{ t('backup.path.save') }}</BaseButton>
			<BaseButton variant="secondary" :disabled="!wtfBackupPath" @click="$emit('reset')">
				{{ t('backup.path.reset') }}
			</BaseButton>
		</div>

		<p class="path-hint">{{ defaultPathHint }}</p>

		<p v-if="error" class="error">{{ error }}</p>
		<p v-if="notice" class="notice">{{ notice }}</p>
	</BasePanel>
</template>
