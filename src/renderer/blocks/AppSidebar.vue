<script setup lang="ts">
import type { AppInfo } from '@shared/contracts'
import { useLocale } from '@renderer/composables/useLocale'

defineProps<{
	appInfo: AppInfo | null
}>()

const { t } = useLocale()
</script>

<template>
	<aside class="sidebar">
		<div>
			<p class="eyebrow">{{ t('app.eyebrow') }}</p>
			<h1>{{ t('app.title') }}</h1>
		</div>
		<nav>
			<a class="active">{{ t('nav.dashboard') }}</a>
			<a>{{ t('nav.addons') }}</a>
			<a>{{ t('nav.backups') }}</a>
			<a>{{ t('nav.accounts') }}</a>
			<a>{{ t('nav.settings') }}</a>
		</nav>
		<p class="version" v-if="appInfo">
			{{ t('app.versionToken', { name: appInfo.name, version: appInfo.version }) }}
		</p>
	</aside>
</template>
