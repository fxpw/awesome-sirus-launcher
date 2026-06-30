<script setup lang="ts">
import type { WtfBackupSummary } from '@shared/contracts'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import { useLocale } from '@renderer/composables/useLocale'

defineProps<{
	backups: WtfBackupSummary[]
	creating: boolean
	backupPath: string
}>()

defineEmits<{
	create: []
	restore: [backup: WtfBackupSummary]
	delete: [backup: WtfBackupSummary]
	openFolder: []
}>()

const { t } = useLocale()

function formatSize(size: number): string {
	return t('backup.size', { size: Math.max(1, Math.round(size / 1024)) })
}
</script>

<template>
	<BasePanel>
		<div class="panel-heading">
			<div>
				<h3>{{ t('backup.title') }}</h3>
				<p>{{ t('backup.description') }}</p>
			</div>
			<div class="panel-heading__actions">
				<BaseButton variant="secondary" @click="$emit('openFolder')">
					{{ t('backup.openFolder') }}
				</BaseButton>
				<BaseButton :disabled="creating" @click="$emit('create')">
					{{ creating ? t('backup.creating') : t('backup.create') }}
				</BaseButton>
			</div>
		</div>

		<p v-if="backupPath" class="path-text">{{ backupPath }}</p>

		<p v-if="backups.length === 0">{{ t('backup.empty') }}</p>
		<ul v-else class="backup-list">
			<li v-for="backup in backups" :key="backup.id" class="backup-row">
				<div class="backup-row__meta">
					<span>{{ backup.fileName }}</span>
					<span>{{ formatSize(backup.size) }}</span>
				</div>
				<div class="backup-row__actions">
					<BaseButton variant="secondary" @click="$emit('restore', backup)">
						{{ t('backup.restore') }}
					</BaseButton>
					<BaseButton variant="secondary" @click="$emit('delete', backup)">
						{{ t('backup.delete') }}
					</BaseButton>
				</div>
			</li>
		</ul>
	</BasePanel>
</template>
