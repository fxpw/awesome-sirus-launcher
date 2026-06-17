<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
import { launcherReleasesUrl, type AppInfo } from '@shared/contracts'
import { useLocale } from '@renderer/composables/useLocale'

defineProps<{
	appInfo: AppInfo | null
	activeSection: string
}>()

defineEmits<{
	navigate: [section: string]
}>()

const { t } = useLocale()

const navItems = [
	{ id: 'dashboard', label: 'nav.dashboard' },
	{ id: 'addons', label: 'nav.addons' },
	{ id: 'client', label: 'nav.client' },
	{ id: 'patch', label: 'nav.patch' },
	{ id: 'wtf', label: 'nav.wtf' },
	{ id: 'mining', label: 'nav.mining' },
	{ id: 'settings', label: 'nav.settings' },
	{ id: 'thanks', label: 'nav.thanks' }
] as const
</script>

<template>
	<aside class="sidebar">
		<div>
			<p class="eyebrow">{{ t('app.eyebrow') }}</p>
			<h1>{{ t('app.title') }}</h1>
		</div>
		<nav>
			<button
				v-for="item in navItems"
				:key="item.id"
				class="nav-item"
				:class="{ active: activeSection === item.id }"
				type="button"
				@click="$emit('navigate', item.id)"
			>
				{{ t(item.label) }}
			</button>
		</nav>
		<a
			v-if="appInfo"
			class="app-release-link"
			:href="launcherReleasesUrl"
			target="_blank"
			rel="noreferrer"
			:aria-label="t('app.openReleases')"
		>
			<span class="version">
				{{ t('app.versionToken', { name: appInfo.name, version: appInfo.version }) }}
			</span>
			<ExternalLink :size="14" aria-hidden="true" />
		</a>
	</aside>
</template>
