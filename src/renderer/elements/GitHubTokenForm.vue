<script setup lang="ts">
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import TextField from '@renderer/components/TextField.vue'
import { useLocale } from '@renderer/composables/useLocale'

defineProps<{
	token: string
}>()

defineEmits<{
	'update:token': [value: string]
	save: []
	clear: []
}>()

const { t } = useLocale()
</script>

<template>
	<BasePanel>
		<div>
			<h3>{{ t('token.title') }}</h3>
			<p>{{ t('token.description') }}</p>
		</div>

		<div class="token-row">
			<TextField
				:model-value="token"
				type="password"
				:placeholder="t('token.placeholder')"
				@update:model-value="$emit('update:token', $event)"
			/>
			<BaseButton @click="$emit('save')">{{ t('token.save') }}</BaseButton>
			<BaseButton variant="secondary" @click="$emit('clear')">{{ t('token.clear') }}</BaseButton>
		</div>
	</BasePanel>
</template>
