<script setup lang="ts">
import { X } from '@lucide/vue'
import BaseButton from '@renderer/components/BaseButton.vue'
import TextField from '@renderer/components/TextField.vue'
import { useLocale } from '@renderer/composables/useLocale'

defineProps<{
	token: string
	error: string
}>()

defineEmits<{
	'update:token': [value: string]
	save: []
	clear: []
	close: []
}>()

const { t } = useLocale()
</script>

<template>
	<div class="modal-overlay">
		<div class="modal-shell token-modal">
			<div class="modal-heading">
				<div>
					<p class="eyebrow">{{ t('token.quickEyebrow') }}</p>
					<h3>{{ t('token.quickTitle') }}</h3>
					<p>{{ t('token.description') }}</p>
				</div>
				<button
					class="icon-button"
					type="button"
					:aria-label="t('token.close')"
					@click="$emit('close')"
				>
					<X :size="24" />
				</button>
			</div>

			<TextField
				:model-value="token"
				type="password"
				:placeholder="t('token.placeholder')"
				@update:model-value="$emit('update:token', $event)"
			/>

			<section class="token-guide">
				<div>
					<p class="token-guide__title">{{ t('token.guideTitle') }}</p>
					<ol>
						<li>{{ t('token.guideStepOpen') }}</li>
						<li>{{ t('token.guideStepOwner') }}</li>
						<li>{{ t('token.guideStepRepos') }}</li>
						<li>{{ t('token.guideStepPermissions') }}</li>
						<li>{{ t('token.guideStepGenerate') }}</li>
					</ol>
					<p class="token-guide__note">{{ t('token.guideWarning') }}</p>
				</div>
				<a
					class="token-guide__link"
					href="https://github.com/settings/personal-access-tokens/new?name=Awesome%20Sirus%20Launcher&description=Higher%20rate%20limit%20for%20public%20addon%20downloads&expires_in=90"
					target="_blank"
					rel="noreferrer"
				>
					{{ t('token.guideOpenGitHub') }}
				</a>
			</section>

			<p v-if="error" class="error">{{ error }}</p>

			<div class="modal-actions">
				<BaseButton @click="$emit('save')">{{ t('token.save') }}</BaseButton>
				<BaseButton variant="secondary" @click="$emit('clear')">{{
					t('token.clear')
				}}</BaseButton>
			</div>
		</div>
	</div>
</template>
