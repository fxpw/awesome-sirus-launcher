<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, Plus, Trash2 } from '@lucide/vue'
import type { AccountListResult, AccountSummary, GitHubTokenStatus } from '@shared/contracts'
import { localeLabels, type Locale } from '@renderer/shared/i18n'
import { isFocusLeaving } from '@renderer/shared/focus'
import { useLocale } from '@renderer/composables/useLocale'

const props = defineProps<{
	githubTokenStatus: GitHubTokenStatus
	accounts: AccountListResult
	title: string
	eyebrow: string
}>()

const emit = defineEmits<{
	openToken: []
	openAccount: []
	selectAccount: [accountId: string]
	deleteAccount: [account: AccountSummary]
}>()

const { currentLocale, localeOptions, setLocale, t } = useLocale()
const localeMenuOpen = ref(false)
const accountMenuOpen = ref(false)

const selectedAccount = computed(
	() =>
		props.accounts.accounts.find(
			(account) => account.id === props.accounts.selectedAccountId
		) ?? null
)

function closeAccountMenu(event: FocusEvent): void {
	if (isFocusLeaving(event)) accountMenuOpen.value = false
}

function closeLocaleMenu(event: FocusEvent): void {
	if (isFocusLeaving(event)) localeMenuOpen.value = false
}

function selectLocale(locale: Locale): void {
	setLocale(locale)
	localeMenuOpen.value = false
}

function selectAccount(accountId: string): void {
	emit('selectAccount', accountId)
	accountMenuOpen.value = false
}

function deleteAccount(account: AccountSummary): void {
	emit('deleteAccount', account)
	accountMenuOpen.value = false
}

function openAccountModal(): void {
	emit('openAccount')
	accountMenuOpen.value = false
}
</script>

<template>
	<header class="topbar">
		<div>
			<p class="eyebrow">{{ eyebrow }}</p>
			<h2>{{ title }}</h2>
		</div>
		<div class="topbar__actions">
			<div class="locale-select" @focusout="closeLocaleMenu">
				<span>{{ t('locale.label') }}</span>
				<button
					class="locale-select__button"
					type="button"
					:aria-expanded="localeMenuOpen"
					@click="localeMenuOpen = !localeMenuOpen"
				>
					<span>{{ localeLabels[currentLocale] }}</span>
					<ChevronDown :size="16" />
				</button>
				<div v-if="localeMenuOpen" class="locale-select__menu">
					<button
						v-for="locale in localeOptions"
						:key="locale"
						class="locale-select__option"
						:class="{ 'locale-select__option--active': locale === currentLocale }"
						type="button"
						@click="selectLocale(locale)"
					>
						<span>{{ localeLabels[locale] }}</span>
						<Check v-if="locale === currentLocale" :size="16" />
					</button>
				</div>
			</div>
			<button
				class="token-status-button"
				type="button"
				:class="{ 'token-status-button--ready': githubTokenStatus.configured }"
				@click="$emit('openToken')"
			>
				{{
					t('github.status', {
						status: githubTokenStatus.configured
							? t('github.configured')
							: t('github.missing')
					})
				}}
			</button>
			<div class="account-select" @focusout="closeAccountMenu">
				<button
					class="account-select__button"
					type="button"
					:aria-expanded="accountMenuOpen"
					@click="accountMenuOpen = !accountMenuOpen"
				>
					<span>
						{{ selectedAccount ? selectedAccount.login : t('account.select.empty') }}
					</span>
					<ChevronDown :size="16" />
				</button>
				<div v-if="accountMenuOpen" class="account-select__menu">
					<div
						v-for="account in accounts.accounts"
						:key="account.id"
						class="account-select__row"
					>
						<button
							class="account-select__option"
							:class="{
								'account-select__option--active':
									account.id === accounts.selectedAccountId
							}"
							type="button"
							@click="selectAccount(account.id)"
						>
							<span>{{ account.login }}</span>
							<Check v-if="account.id === accounts.selectedAccountId" :size="16" />
						</button>
						<button
							class="account-select__delete"
							type="button"
							:title="t('account.delete')"
							:aria-label="t('account.deleteLabel', { login: account.login })"
							@click="deleteAccount(account)"
						>
							<Trash2 :size="15" />
						</button>
					</div>
					<button
						class="account-select__option account-select__option--add"
						type="button"
						@click="openAccountModal"
					>
						<span>{{ t('account.add') }}</span>
						<Plus :size="16" />
					</button>
				</div>
			</div>
		</div>
	</header>
</template>
