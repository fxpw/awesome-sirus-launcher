<script setup lang="ts">
import { X } from '@lucide/vue'
import BaseButton from '@renderer/components/BaseButton.vue'
import TextField from '@renderer/components/TextField.vue'
import { useLocale } from '@renderer/composables/useLocale'

defineProps<{
	login: string
	password: string
	error: string
}>()

defineEmits<{
	'update:login': [value: string]
	'update:password': [value: string]
	close: []
	save: []
}>()

const { t } = useLocale()
</script>

<template>
	<div class="modal-overlay">
		<section class="modal-shell token-modal">
			<div class="modal-heading">
				<div>
					<p class="eyebrow">{{ t('account.modalEyebrow') }}</p>
					<h3>{{ t('account.modalTitle') }}</h3>
					<p>{{ t('account.modalDescription') }}</p>
				</div>
				<button
					class="icon-button"
					type="button"
					:aria-label="t('account.close')"
					@click="$emit('close')"
				>
					<X :size="24" />
				</button>
			</div>

			<TextField
				:model-value="login"
				:placeholder="t('account.login')"
				@update:model-value="$emit('update:login', $event)"
			/>
			<TextField
				:model-value="password"
				type="password"
				:placeholder="t('account.password')"
				@update:model-value="$emit('update:password', $event)"
			/>
			<p v-if="error" class="error">{{ error }}</p>

			<div class="modal-actions">
				<BaseButton variant="secondary" @click="$emit('close')">
					{{ t('account.cancel') }}
				</BaseButton>
				<BaseButton @click="$emit('save')">{{ t('account.save') }}</BaseButton>
			</div>
		</section>
	</div>
</template>
