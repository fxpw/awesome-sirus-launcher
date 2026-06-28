<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, ArrowUpDown, Trash2 } from '@lucide/vue'
import type { AddonsListResult, AddonSummary } from '@shared/contracts'
import { launcherApi } from '@renderer/api/launcherApi'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import StatusBadge from '@renderer/components/StatusBadge.vue'
import TextField from '@renderer/components/TextField.vue'
import { useLocale } from '@renderer/composables/useLocale'

const props = defineProps<{
	addonResult?: AddonsListResult | null
	checkingExternal?: boolean
}>()
const emit = defineEmits<{
	checked: [result: AddonsListResult]
}>()

const { t } = useLocale()

const catalogAddons = ref<AddonSummary[]>([])
const checkedAddons = ref<AddonSummary[]>([])
const loading = ref(false)
const checking = ref(false)
const updatingAddonId = ref('')
const deletingAddonId = ref('')
const addonPendingDelete = ref<AddonSummary | null>(null)
const customName = ref('')
const customUrl = ref('')
const notice = ref('')
const error = ref('')
const sortKey = ref<'name' | 'status'>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')
const activeTooltip = ref<{
	addonId: string
	name: string
	description: string
	left: number
	top: number
	maxWidth: number
	placement: 'above' | 'below'
	anchorX?: number
	anchorY?: number
} | null>(null)
const tooltipElement = ref<HTMLElement | null>(null)
let activeTooltipRow: HTMLElement | null = null
const tableSearch = ref<Record<string, string>>({
	sirus: '',
	community: '',
	custom: ''
})

const addons = computed(() => mergeAddonLists(catalogAddons.value, checkedAddons.value))
const communityCount = computed(
	() => addons.value.filter((addon) => addon.source === 'community').length
)
const sirusCount = computed(() => addons.value.filter((addon) => addon.source === 'sirus').length)
const customCount = computed(() => addons.value.filter((addon) => addon.source === 'custom').length)
const problemCount = computed(
	() => addons.value.filter((addon) => addon.status === 'outdated').length
)
const addonTables = computed(() => [
	{
		key: 'sirus',
		title: t('addons.table.sirus'),
		total: sirusCount.value,
		addons: sortAddons(filterAddonsBySearch(addons.value, 'sirus'))
	},
	{
		key: 'community',
		title: t('addons.table.community'),
		total: communityCount.value,
		addons: sortAddons(filterAddonsBySearch(addons.value, 'community'))
	},
	{
		key: 'custom',
		title: t('addons.table.custom'),
		total: customCount.value,
		addons: sortAddons(filterAddonsBySearch(addons.value, 'custom'))
	}
])
const isChecking = computed(() => checking.value || props.checkingExternal === true)

watch(
	() => props.addonResult,
	(result) => {
		if (!result) return
		mergeCheckedAddons(result.addons)
	},
	{ immediate: true }
)

onMounted(() => {
	window.addEventListener('resize', handleViewportChange)
	document.addEventListener('scroll', handleViewportChange, true)
	void loadAddons()
})

onUnmounted(() => {
	window.removeEventListener('resize', handleViewportChange)
	document.removeEventListener('scroll', handleViewportChange, true)
})

async function loadAddons(): Promise<void> {
	await run(async () => {
		loading.value = true
		const result = await launcherApi.addons.list()
		catalogAddons.value = result.addons
		if (props.addonResult) mergeCheckedAddons(props.addonResult.addons)
		notice.value = t('addons.loaded')
	})
	loading.value = false
}

async function checkAddons(): Promise<void> {
	await run(async () => {
		checking.value = true
		await ensureCatalogLoaded()
		const result = await launcherApi.addons.check()
		replaceCheckedAddons(result.addons)
		emit('checked', result)
		notice.value = t('addons.checked')
	})
	checking.value = false
}

async function installAddon(addon: AddonSummary): Promise<void> {
	await run(async () => {
		updatingAddonId.value = addon.id
		const result = await launcherApi.addons.install({ addonId: addon.id })
		upsertCheckedAddon(result.addon)
		const checked = await launcherApi.addons.check()
		replaceCheckedAddons(checked.addons)
		emit('checked', checked)
		notice.value = t('addons.installed')
	})
	updatingAddonId.value = ''
}

function requestDeleteAddon(addon: AddonSummary): void {
	addonPendingDelete.value = addon
}

function cancelDeleteAddon(): void {
	addonPendingDelete.value = null
}

async function confirmDeleteAddon(): Promise<void> {
	const addon = addonPendingDelete.value
	if (!addon) return

	await run(async () => {
		deletingAddonId.value = addon.id
		const result = await launcherApi.addons.delete({ addonId: addon.id })
		const checked = await launcherApi.addons.check()
		replaceCheckedAddons([...checked.addons, result.addon])
		emit('checked', checked)
		notice.value = t('addons.deleted')
		addonPendingDelete.value = null
	})
	deletingAddonId.value = ''
}

async function updateAll(): Promise<void> {
	await run(async () => {
		checking.value = true
		await ensureCatalogLoaded()
		const result = await launcherApi.addons.updateAll()
		for (const installed of result.installed) {
			upsertCheckedAddon(installed.addon)
		}
		mergeCheckedAddons(result.skipped)
		const checked = await launcherApi.addons.check()
		replaceCheckedAddons(checked.addons)
		emit('checked', checked)
		notice.value = t('addons.updatedAll', { total: result.total })
	})
	checking.value = false
}

async function addCustomAddon(): Promise<void> {
	await run(async () => {
		const result = await launcherApi.addons.addCustom({
			name: customName.value,
			githubUrl: customUrl.value
		})
		catalogAddons.value = result.addons
		customName.value = ''
		customUrl.value = ''
		notice.value = t('addons.customAdded')
	})
}

async function exportCustomAddons(): Promise<void> {
	await run(async () => {
		const result = await launcherApi.addons.exportCustom()
		if (!result) return
		notice.value = t('addons.exported', { total: result.total })
	})
}

async function importCustomAddons(): Promise<void> {
	await run(async () => {
		const result = await launcherApi.addons.importCustom()
		if (!result) return
		const listResult = await launcherApi.addons.list()
		catalogAddons.value = listResult.addons
		notice.value = t('addons.imported', { total: result.total })
	})
}

async function run(action: () => Promise<void>): Promise<void> {
	error.value = ''
	notice.value = ''
	try {
		await action()
	} catch (err) {
		error.value = err instanceof Error ? err.message : t('addons.error')
	} finally {
		loading.value = false
		checking.value = false
		updatingAddonId.value = ''
		deletingAddonId.value = ''
	}
}

function upsertCheckedAddon(addon: AddonSummary): void {
	const index = checkedAddons.value.findIndex((item) => item.id === addon.id)
	if (index >= 0) checkedAddons.value[index] = addon
	else checkedAddons.value.push(addon)
}

function mergeCheckedAddons(nextAddons: AddonSummary[]): void {
	for (const addon of nextAddons) {
		upsertCheckedAddon(addon)
	}
}

function replaceCheckedAddons(nextAddons: AddonSummary[]): void {
	checkedAddons.value = nextAddons
}

function mergeAddonLists(
	baseAddons: AddonSummary[],
	overrideAddons: AddonSummary[]
): AddonSummary[] {
	const merged = new Map(baseAddons.map((addon) => [addon.id, addon]))
	for (const addon of overrideAddons) {
		merged.set(addon.id, addon)
	}

	return [...merged.values()]
}

function filterAddonsBySearch(
	allAddons: AddonSummary[],
	source: 'sirus' | 'community' | 'custom'
): AddonSummary[] {
	const query = tableSearch.value[source]?.trim().toLocaleLowerCase('ru') ?? ''
	const sourceAddons = allAddons.filter((addon) => addon.source === source)

	if (!query) return sourceAddons

	return sourceAddons.filter((addon) => addon.name.toLocaleLowerCase('ru').includes(query))
}

function sortAddons(addons: AddonSummary[]): AddonSummary[] {
	const direction = sortDirection.value === 'asc' ? 1 : -1

	return [...addons].sort((left, right) => {
		if (sortKey.value === 'status') {
			const statusCompare =
				compareStatusBuckets(left, right) * direction ||
				left.name.localeCompare(right.name, 'ru') * direction
			return statusCompare
		}

		return left.name.localeCompare(right.name, 'ru') * direction
	})
}

async function ensureCatalogLoaded(): Promise<void> {
	if (catalogAddons.value.length > 0) return

	const result = await launcherApi.addons.list()
	catalogAddons.value = result.addons
}

function getStatusLabel(addon: AddonSummary): string {
	if (addon.status === 'installed') return t('addons.status.installed')
	if (addon.status === 'outdated') return t('addons.status.outdated')
	if (addon.status === 'not-installed') return t('addons.status.notInstalled')
	if (addon.status === 'manual-git') return t('addons.status.manualGit')
	return t('addons.status.unknown')
}

function getStatusReason(addon: AddonSummary): string {
	if (addon.error) return addon.error
	if (addon.status === 'manual-git') return t('addons.reason.manualGit')
	if (addon.status === 'not-installed') return t('addons.reason.notInstalled')
	if (addon.missingFolders.length > 0) {
		return t('addons.reason.missingFolders', { folders: addon.missingFolders.join(', ') })
	}
	if (addon.status === 'outdated' && addon.installedVersion && addon.remoteVersion) {
		return t('addons.reason.versionMismatch', {
			installed: addon.installedVersion,
			remote: addon.remoteVersion
		})
	}
	if (addon.status === 'installed') return t('addons.reason.installed')
	return t('addons.reason.unknown')
}

function getStatusTone(addon: AddonSummary): 'neutral' | 'ok' | 'warning' {
	if (addon.status === 'installed') return 'ok'
	if (addon.status === 'manual-git' || addon.status === 'outdated') return 'warning'
	return 'neutral'
}

function isInstalledStatus(addon: AddonSummary): boolean {
	return addon.status !== 'not-installed'
}

function compareStatusBuckets(left: AddonSummary, right: AddonSummary): number {
	return Number(isInstalledStatus(right)) - Number(isInstalledStatus(left))
}

function canDeleteAddon(addon: AddonSummary): boolean {
	return (
		(addon.status === 'installed' || addon.status === 'outdated') &&
		deletingAddonId.value !== addon.id
	)
}

function getInstallActionLabel(addon: AddonSummary): string {
	if (updatingAddonId.value === addon.id) return t('addons.installing')
	if (addon.status === 'installed') return t('addons.reinstall')
	return t('addons.install')
}

function toggleSort(nextKey: 'name' | 'status'): void {
	if (sortKey.value === nextKey) {
		sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
		return
	}

	sortKey.value = nextKey
	sortDirection.value = 'asc'
}

function getSortButtonTitle(key: 'name' | 'status'): string {
	if (key === 'name') {
		return sortKey.value === key && sortDirection.value === 'desc'
			? t('addons.sort.nameDesc')
			: t('addons.sort.nameAsc')
	}

	return sortKey.value === key && sortDirection.value === 'desc'
		? t('addons.sort.statusDesc')
		: t('addons.sort.statusAsc')
}

function getSortAria(key: 'name' | 'status'): 'ascending' | 'descending' | 'none' {
	if (sortKey.value !== key) return 'none'
	return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function getTableSearchValue(key: string): string {
	return tableSearch.value[key] ?? ''
}

function setTableSearchValue(key: string, value: string): void {
	tableSearch.value = {
		...tableSearch.value,
		[key]: value
	}
}

function getTableSearchPlaceholder(title: string): string {
	return `${title} (${t('addons.search.short')})`
}

async function showTooltip(addon: AddonSummary, event: MouseEvent | FocusEvent): Promise<void> {
	const row = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
	if (!row) return

	const pointerEvent = event instanceof MouseEvent ? event : null
	activeTooltipRow = row
	activeTooltip.value = {
		addonId: addon.id,
		name: addon.name,
		description: addon.description ?? '',
		left: 0,
		top: 0,
		maxWidth: Math.max(280, window.innerWidth - 32),
		placement: 'below',
		anchorX: pointerEvent?.clientX,
		anchorY: pointerEvent?.clientY
	}
	await positionTooltip()
}

async function positionTooltip(): Promise<void> {
	const tooltip = activeTooltip.value
	const row = activeTooltipRow
	if (!tooltip || !row) return

	await nextTick()

	const tooltipNode = tooltipElement.value
	if (!tooltipNode) return

	const rowRect = row.getBoundingClientRect()
	const tooltipRect = tooltipNode.getBoundingClientRect()
	const gap = 10
	const viewportPadding = 12
	const anchorX = tooltip.anchorX ?? rowRect.left + 12
	const anchorY = tooltip.anchorY ?? rowRect.top + rowRect.height / 2
	const spaceBelow = window.innerHeight - anchorY - viewportPadding
	const spaceAbove = anchorY - viewportPadding
	const placeAbove = spaceBelow < tooltipRect.height + gap && spaceAbove > spaceBelow
	const maxWidth = Math.min(520, Math.max(280, window.innerWidth - viewportPadding * 2))
	const unclampedLeft = anchorX + 14
	const left = Math.min(
		Math.max(viewportPadding, unclampedLeft),
		window.innerWidth - tooltipRect.width - viewportPadding
	)
	const top = placeAbove
		? Math.max(viewportPadding, anchorY - tooltipRect.height - gap)
		: Math.min(window.innerHeight - tooltipRect.height - viewportPadding, anchorY + gap)

	activeTooltip.value = {
		...tooltip,
		left,
		top,
		maxWidth,
		placement: placeAbove ? 'above' : 'below'
	}
}

function handleTooltipMouseMove(addon: AddonSummary, event: MouseEvent): void {
	if (activeTooltip.value?.addonId !== addon.id) {
		void showTooltip(addon, event)
		return
	}

	activeTooltip.value = {
		...activeTooltip.value,
		anchorX: event.clientX,
		anchorY: event.clientY
	}
	void positionTooltip()
}

function hideTooltip(addonId?: string): void {
	if (addonId && activeTooltip.value?.addonId !== addonId) return
	activeTooltipRow = null
	activeTooltip.value = null
}

function handleViewportChange(): void {
	if (!activeTooltip.value || !activeTooltipRow) return
	void positionTooltip()
}

function handleRowContextMenu(addonId: string, event: MouseEvent): void {
	hideTooltip(addonId)
	const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
	target?.blur()
}
</script>

<template>
	<BasePanel class="addons-panel">
		<div class="panel-heading">
			<div>
				<h3>{{ t('addons.title') }}</h3>
				<p>{{ t('addons.description') }}</p>
			</div>
			<div class="panel-heading__actions">
				<BaseButton
					variant="secondary"
					:disabled="loading || isChecking"
					@click="loadAddons"
				>
					{{ loading ? t('addons.loading') : t('addons.load') }}
				</BaseButton>
				<BaseButton :disabled="loading || isChecking" @click="checkAddons">
					{{ isChecking ? t('addons.checking') : t('addons.check') }}
				</BaseButton>
				<BaseButton
					variant="secondary"
					:disabled="loading || isChecking"
					@click="updateAll"
				>
					{{ t('addons.updateAll') }}
				</BaseButton>
			</div>
		</div>

		<div class="addon-summary">
			<StatusBadge tone="neutral">{{
				t('addons.sourceCommunity', { total: communityCount })
			}}</StatusBadge>
			<StatusBadge tone="neutral">{{
				t('addons.sourceSirus', { total: sirusCount })
			}}</StatusBadge>
			<StatusBadge tone="neutral">{{
				t('addons.sourceCustom', { total: customCount })
			}}</StatusBadge>
			<StatusBadge :tone="problemCount > 0 ? 'warning' : 'ok'">
				{{ t('addons.problemCount', { total: problemCount }) }}
			</StatusBadge>
		</div>

		<div class="addon-custom-form">
			<TextField v-model="customName" :placeholder="t('addons.customName')" />
			<TextField v-model="customUrl" :placeholder="t('addons.customUrl')" />
			<BaseButton :disabled="!customName || !customUrl" @click="addCustomAddon">
				{{ t('addons.customAdd') }}
			</BaseButton>
			<BaseButton variant="secondary" @click="exportCustomAddons">
				{{ t('addons.customExport') }}
			</BaseButton>
			<BaseButton variant="secondary" @click="importCustomAddons">
				{{ t('addons.customImport') }}
			</BaseButton>
		</div>

		<p v-if="notice" class="notice">{{ notice }}</p>
		<p v-if="error" class="error">{{ error }}</p>

		<section v-for="table in addonTables" :key="table.key" class="addon-table-section">
			<div class="addon-table-section__heading">
				<div class="addon-table-section__heading-main">
					<div class="addon-table-section__search">
						<TextField
							:model-value="getTableSearchValue(table.key)"
							:placeholder="getTableSearchPlaceholder(table.title)"
							@update:model-value="setTableSearchValue(table.key, $event)"
						/>
					</div>
				</div>
				<StatusBadge tone="neutral">{{ table.total }}</StatusBadge>
			</div>
			<div class="addons-table">
				<div class="addons-table__head">
					<div class="addons-table__head-cell addons-table__head-cell--sortable">
						<span>{{ t('addons.table.name') }}</span>
						<button
							type="button"
							class="addons-table__sort-button"
							:title="getSortButtonTitle('name')"
							:aria-label="getSortButtonTitle('name')"
							:aria-sort="getSortAria('name')"
							@click="toggleSort('name')"
						>
							<ArrowUp
								v-if="sortKey === 'name' && sortDirection === 'asc'"
								:size="14"
							/>
							<ArrowDown
								v-else-if="sortKey === 'name' && sortDirection === 'desc'"
								:size="14"
							/>
							<ArrowUpDown v-else :size="14" />
						</button>
					</div>
					<span class="addons-table__head-cell">{{ t('addons.table.version') }}</span>
					<div class="addons-table__head-cell addons-table__head-cell--sortable">
						<span>{{ t('addons.table.status') }}</span>
						<button
							type="button"
							class="addons-table__sort-button"
							:title="getSortButtonTitle('status')"
							:aria-label="getSortButtonTitle('status')"
							:aria-sort="getSortAria('status')"
							@click="toggleSort('status')"
						>
							<ArrowUpDown
								v-if="sortKey !== 'status'"
								:size="14"
							/>
							<ArrowDown
								v-else-if="sortDirection === 'asc'"
								:size="14"
							/>
							<ArrowUp v-else :size="14" />
						</button>
					</div>
					<span class="addons-table__head-cell">{{ t('addons.table.action') }}</span>
				</div>
				<div v-if="table.addons.length === 0" class="addons-table__empty">
					{{ t('addons.table.empty') }}
				</div>
				<div
					v-for="addon in table.addons"
					:key="addon.id"
					class="addons-table__row"
					tabindex="0"
					@mouseenter="showTooltip(addon, $event)"
					@mousemove="handleTooltipMouseMove(addon, $event)"
					@focusin="showTooltip(addon, $event)"
					@mouseleave="hideTooltip(addon.id)"
					@focusout="hideTooltip(addon.id)"
					@contextmenu="handleRowContextMenu(addon.id, $event)"
				>
					<div class="path-text">
						<strong>{{ addon.name }}</strong>
						<span>{{ addon.category || addon.author || addon.description }}</span>
					</div>
					<span
						>{{ addon.installedVersion || '-' }} /
						{{ addon.remoteVersion || '-' }}</span
					>
					<StatusBadge :tone="getStatusTone(addon)" :title="getStatusReason(addon)">
						{{ getStatusLabel(addon) }}
					</StatusBadge>
					<div
						class="addon-actions"
						:class="{ 'addon-actions--with-delete': canDeleteAddon(addon) }"
					>
						<BaseButton
							variant="secondary"
							:disabled="
								addon.status === 'manual-git' || updatingAddonId === addon.id
							"
							@click="installAddon(addon)"
						>
							{{ getInstallActionLabel(addon) }}
						</BaseButton>
						<BaseButton
							v-if="canDeleteAddon(addon)"
							class="addon-delete-button"
							variant="danger"
							:title="t('addons.delete')"
							:aria-label="t('addons.delete')"
							@click="requestDeleteAddon(addon)"
						>
							<Trash2 :size="18" />
						</BaseButton>
					</div>
				</div>
			</div>
		</section>
	</BasePanel>

	<Teleport to="body">
		<div
			v-if="activeTooltip"
			ref="tooltipElement"
			class="addon-tooltip addon-tooltip--visible"
			:class="{ 'addon-tooltip--above': activeTooltip.placement === 'above' }"
			:style="{
				left: `${activeTooltip.left}px`,
				top: `${activeTooltip.top}px`,
				maxWidth: `${activeTooltip.maxWidth}px`
			}"
			role="tooltip"
		>
			<strong>{{ activeTooltip.name }}</strong>
			<p v-if="activeTooltip.description">{{ activeTooltip.description }}</p>
		</div>
	</Teleport>

	<div v-if="addonPendingDelete" class="modal-overlay">
		<section class="modal-shell" role="dialog" aria-modal="true">
			<div class="modal-heading">
				<div>
					<p class="eyebrow">{{ t('addons.delete') }}</p>
					<h3>{{ t('addons.deleteTitle') }}</h3>
					<p>
						{{
							t('addons.deleteDescription', {
								name: addonPendingDelete.name
							})
						}}
					</p>
				</div>
			</div>
			<p v-if="error" class="error">{{ error }}</p>
			<div class="modal-actions">
				<BaseButton variant="secondary" @click="cancelDeleteAddon">
					{{ t('addons.deleteCancel') }}
				</BaseButton>
				<BaseButton
					variant="danger"
					:disabled="deletingAddonId === addonPendingDelete.id"
					@click="confirmDeleteAddon"
				>
					{{
						deletingAddonId === addonPendingDelete.id
							? t('addons.deleting')
							: t('addons.deleteConfirm')
					}}
				</BaseButton>
			</div>
		</section>
	</div>
</template>
