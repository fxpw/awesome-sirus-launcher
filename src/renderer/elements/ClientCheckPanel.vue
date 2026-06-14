<script setup lang="ts">
import type { ClientCheckResult } from '@shared/contracts'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import StatusBadge from '@renderer/components/StatusBadge.vue'
import { useLocale } from '@renderer/composables/useLocale'

const props = defineProps<{
	result: ClientCheckResult | null
	checking: boolean
}>()

defineEmits<{
	check: []
}>()

const { t } = useLocale()

function problemFiles(): ClientCheckResult['files'] {
	return props.result?.files.filter((file) => file.status !== 'ok').slice(0, 8) ?? []
}

function statusLabelKey(status: ClientCheckResult['files'][number]['status']) {
	if (status === 'missing') return 'clientCheck.status.missing'
	if (status === 'outdated') return 'clientCheck.status.outdated'
	return 'clientCheck.status.ok'
}
</script>

<template>
	<BasePanel>
		<div class="panel-heading">
			<div>
				<h3>{{ t('clientCheck.title') }}</h3>
				<p>{{ t('clientCheck.description') }}</p>
			</div>
			<BaseButton :disabled="checking" @click="$emit('check')">
				{{ checking ? t('clientCheck.checking') : t('clientCheck.check') }}
			</BaseButton>
		</div>

		<div v-if="result" class="result">
			<StatusBadge :ok="result.missing === 0 && result.outdated === 0">
				{{
					result.missing === 0 && result.outdated === 0
						? t('clientCheck.clean')
						: t('clientCheck.problem')
				}}
			</StatusBadge>
			<p>
				{{
					t('clientCheck.summary', {
						total: result.total,
						ok: result.ok,
						missing: result.missing,
						outdated: result.outdated
					})
				}}
			</p>
			<p class="path-text">{{ result.sourceUrl }}</p>

			<ul v-if="problemFiles().length > 0" class="compact-list">
				<li v-for="file in problemFiles()" :key="file.targetPath">
					<span>{{ file.relativePath }}{{ file.fileName }}</span>
					<span>{{ t(statusLabelKey(file.status)) }}</span>
				</li>
			</ul>
		</div>
	</BasePanel>
</template>
