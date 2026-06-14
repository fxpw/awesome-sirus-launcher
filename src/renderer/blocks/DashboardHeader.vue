<script setup lang="ts">
import type { GitHubTokenStatus } from '@shared/contracts'
import StatusBadge from '@renderer/components/StatusBadge.vue'
import BaseButton from '@renderer/components/BaseButton.vue'
import { localeLabels, type Locale } from '@renderer/shared/i18n'
import { useLocale } from '@renderer/composables/useLocale'
import { useTheme, type ThemeMode } from '@renderer/composables/useTheme'

defineProps<{
	githubTokenStatus: GitHubTokenStatus
}>()

const { currentLocale, localeOptions, setLocale, t } = useLocale()
const { currentTheme, setTheme } = useTheme()

function nextTheme(): ThemeMode {
	return currentTheme.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
	<header class="topbar">
		<div>
			<p class="eyebrow">{{ t('header.eyebrow') }}</p>
			<h2>{{ t('header.title') }}</h2>
		</div>
		<div class="topbar__actions">
			<label class="locale-select">
				{{ t('locale.label') }}
				<select
					:value="currentLocale"
					@change="setLocale(($event.target as HTMLSelectElement).value as Locale)"
				>
					<option v-for="locale in localeOptions" :key="locale" :value="locale">
						{{ localeLabels[locale] }}
					</option>
				</select>
			</label>
			<BaseButton variant="secondary" @click="setTheme(nextTheme())">
				{{ currentTheme === 'dark' ? t('theme.light') : t('theme.dark') }}
			</BaseButton>
			<StatusBadge :tone="githubTokenStatus.configured ? 'ok' : 'neutral'">
				{{
					t('github.status', {
						status: githubTokenStatus.configured
							? t('github.configured')
							: t('github.missing')
					})
				}}
			</StatusBadge>
		</div>
	</header>
</template>
