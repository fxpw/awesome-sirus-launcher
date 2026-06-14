<script setup lang="ts">
import type { WowPathValidation } from '@shared/contracts'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import TextField from '@renderer/components/TextField.vue'
import { useLocale } from '@renderer/composables/useLocale'

defineProps<{
	wowPath: string
	validation: WowPathValidation | null
	error: string
	notice: string
}>()

defineEmits<{
	'update:wowPath': [value: string]
	select: []
	save: []
}>()

const { t } = useLocale()
</script>

<template>
	<BasePanel>
		<div>
			<h3>{{ t('wow.title') }}</h3>
			<p>{{ t('wow.description') }}</p>
		</div>

		<div class="path-row">
			<TextField
				:model-value="wowPath"
				:placeholder="t('wow.placeholder')"
				@update:model-value="$emit('update:wowPath', $event)"
			/>
			<BaseButton @click="$emit('select')">{{ t('wow.select') }}</BaseButton>
			<BaseButton @click="$emit('save')">{{ t('wow.save') }}</BaseButton>
		</div>

		<p v-if="error" class="error">{{ error }}</p>
		<p v-if="notice" class="notice">{{ notice }}</p>

		<div v-if="validation" class="result">
			<strong>{{ validation.valid ? t('wow.valid') : t('wow.invalid') }}</strong>
			<ul v-if="validation.missing.length">
				<li v-for="item in validation.missing" :key="item">{{ item }}</li>
			</ul>
			<p v-else>{{ t('wow.allFound') }}</p>
		</div>
	</BasePanel>
</template>
