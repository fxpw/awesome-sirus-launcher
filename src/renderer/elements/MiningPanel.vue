<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, Pickaxe, Play, RotateCcw, Square, Terminal } from '@lucide/vue'
import type { MiningState } from '@shared/contracts'
import BaseButton from '@renderer/components/BaseButton.vue'
import BasePanel from '@renderer/components/BasePanel.vue'
import StatusBadge from '@renderer/components/StatusBadge.vue'
import { useLocale } from '@renderer/composables/useLocale'

const props = defineProps<{
	state: MiningState | null
	working: boolean
	error: string
	notice: string
}>()

const emit = defineEmits<{
	save: [
		patch: {
			consentAccepted: boolean
			arguments: string
			poolUrl: string
			walletAddress: string
			workerName: string
			coinSymbol: string
		}
	]
	selectMiner: []
	start: []
	stop: []
	resetStats: []
}>()

const { t } = useLocale()

const consentAccepted = ref(false)
const minerArguments = ref('')
const poolUrl = ref('')
const walletAddress = ref('')
const workerName = ref('')
const coinSymbol = ref('')

const walletExamples = [
	{
		key: 'eth',
		label: 'ETH',
		noteKey: 'mining.example.ethNote',
		address: '0xCfbFB60D1e26A911FEC57933D307c4E238A596c8',
		poolUrl: 'POOL_HOST:PORT'
	},
	{
		key: 'btc',
		label: 'BTC',
		noteKey: 'mining.example.btcNote',
		address: 'bc1qdk0r3gsfp04mnm07jfxfpzlzly0yyucfvquj30',
		poolUrl: 'POOL_HOST:PORT'
	},
	{
		key: 'ltc',
		label: 'LTC',
		noteKey: 'mining.example.ltcNote',
		address: 'ltc1q3332dyuyw7w7z822cx305j9k3l4ujcv0djr2ag',
		poolUrl: 'POOL_HOST:PORT'
	},
	{
		key: 'etc',
		label: 'ETC',
		noteKey: 'mining.example.etcNote',
		address: '0x32bB0ECE5ffc8c9e8Af55888E2cF353E79be6911',
		poolUrl: 'POOL_HOST:PORT'
	}
] as const

const minerSources = [
	{
		key: 'xmrig',
		label: 'XMRig',
		url: 'https://xmrig.com/download',
		noteKey: 'mining.source.xmrig'
	},
	{
		key: 'xmrigGithub',
		label: 'XMRig GitHub Releases',
		url: 'https://github.com/xmrig/xmrig/releases',
		noteKey: 'mining.source.xmrigGithub'
	},
	{
		key: 'lolminer',
		label: 'lolMiner Releases',
		url: 'https://github.com/Lolliedieb/lolMiner-releases/releases',
		noteKey: 'mining.source.lolminer'
	},
	{
		key: 'teamredminer',
		label: 'TeamRedMiner Releases',
		url: 'https://github.com/todxx/teamredminer/releases',
		noteKey: 'mining.source.teamredminer'
	},
	{
		key: 'gminer',
		label: 'GMiner Releases',
		url: 'https://github.com/develsoftware/GMinerRelease/releases',
		noteKey: 'mining.source.gminer'
	}
] as const

watch(
	() => props.state?.config,
	(config) => {
		if (!config) return
		consentAccepted.value = config.consentAccepted
		minerArguments.value = config.arguments
		poolUrl.value = config.poolUrl
		walletAddress.value = config.walletAddress
		workerName.value = config.workerName
		coinSymbol.value = config.coinSymbol
	},
	{ immediate: true }
)

const canStart = computed(
	() =>
		Boolean(props.state?.config.minerPath) &&
		consentAccepted.value &&
		minerArguments.value.trim().length > 0 &&
		props.state?.status !== 'running' &&
		!props.working
)

const statusTone = computed(() => {
	if (props.state?.status === 'running') return 'ok'
	if (props.state?.status === 'failed') return 'warning'
	return 'neutral'
})

const statusLabel = computed(() => {
	switch (props.state?.status) {
		case 'running':
			return t('mining.status.running')
		case 'stopped':
			return t('mining.status.stopped')
		case 'failed':
			return t('mining.status.failed')
		default:
			return t('mining.status.notConfigured')
	}
})

function save(): void {
	emit('save', {
		consentAccepted: consentAccepted.value,
		arguments: minerArguments.value,
		poolUrl: poolUrl.value,
		walletAddress: walletAddress.value,
		workerName: workerName.value,
		coinSymbol: coinSymbol.value
	})
}

function applyWalletExample(example: (typeof walletExamples)[number]): void {
	walletAddress.value = example.address
	coinSymbol.value = example.label
	workerName.value = workerName.value || 'awesome-sirus-support'
	poolUrl.value = example.poolUrl
	minerArguments.value = `--pool ${example.poolUrl} --user ${example.address}.${workerName.value} --pass x`
}
</script>

<template>
	<BasePanel>
		<div class="panel-heading">
			<div>
				<h3>{{ t('mining.title') }}</h3>
				<p>{{ t('mining.description') }}</p>
			</div>
			<Pickaxe :size="28" class="thanks-heading-icon" aria-hidden="true" />
		</div>

		<div class="mining-dashboard">
			<div class="mining-stat">
				<span>{{ t('mining.status') }}</span>
				<StatusBadge :tone="statusTone">
					{{ statusLabel }}
				</StatusBadge>
			</div>
			<div class="mining-stat">
				<span>{{ t('mining.hashrate') }}</span>
				<strong>{{ state?.hashrate ?? '0 H/s' }}</strong>
			</div>
			<div class="mining-stat">
				<span>{{ t('mining.acceptedShares') }}</span>
				<strong>{{ state?.acceptedSharesTotal ?? 0 }}</strong>
			</div>
			<div class="mining-stat">
				<span>{{ t('mining.receivedTotal') }}</span>
				<strong
					>{{ state?.receivedTotal ?? 0 }}
					{{ state?.config.coinSymbol ?? 'COIN' }}</strong
				>
			</div>
		</div>

		<div class="mining-form">
			<label class="field-label">
				<span>{{ t('mining.minerPath') }}</span>
				<div class="path-row mining-path-row">
					<input
						class="field"
						:value="state?.config.minerPath ?? ''"
						readonly
						:placeholder="t('mining.minerPathPlaceholder')"
					/>
					<BaseButton
						variant="secondary"
						:disabled="working"
						@click="$emit('selectMiner')"
					>
						{{ t('mining.selectMiner') }}
					</BaseButton>
				</div>
			</label>

			<div class="mining-form-grid">
				<label class="field-label">
					<span>{{ t('mining.poolUrl') }}</span>
					<input v-model="poolUrl" class="field" placeholder="stratum+tcp://pool:port" />
				</label>
				<label class="field-label">
					<span>{{ t('mining.walletAddress') }}</span>
					<input v-model="walletAddress" class="field" placeholder="wallet.worker" />
				</label>
				<label class="field-label">
					<span>{{ t('mining.workerName') }}</span>
					<input v-model="workerName" class="field" />
				</label>
				<label class="field-label">
					<span>{{ t('mining.coinSymbol') }}</span>
					<input v-model="coinSymbol" class="field" />
				</label>
			</div>

			<section class="mining-examples">
				<div class="mining-examples__heading">
					<strong>{{ t('mining.examplesTitle') }}</strong>
					<span>{{ t('mining.examplesHint') }}</span>
				</div>
				<div class="mining-example-grid">
					<button
						v-for="example in walletExamples"
						:key="example.key"
						type="button"
						class="mining-example-card"
						@click="applyWalletExample(example)"
					>
						<strong>{{ example.label }}</strong>
						<span>{{ t(example.noteKey) }}</span>
						<small>{{ example.address }}</small>
						<em>{{ t('mining.useExample') }}</em>
					</button>
				</div>
			</section>

			<label class="field-label">
				<span>{{ t('mining.arguments') }}</span>
				<textarea
					v-model="minerArguments"
					class="field mining-arguments"
					:placeholder="t('mining.argumentsPlaceholder')"
				/>
			</label>

			<label class="toggle mining-consent">
				<input v-model="consentAccepted" type="checkbox" />
				{{ t('mining.consent') }}
			</label>

			<div class="result mining-command">
				<Terminal :size="18" />
				<code>{{ state?.commandPreview ?? 'miner.exe' }}</code>
			</div>

			<div class="panel-heading__actions">
				<BaseButton variant="secondary" :disabled="working" @click="save">
					{{ t('mining.save') }}
				</BaseButton>
				<BaseButton
					v-if="state?.status !== 'running'"
					:disabled="!canStart"
					@click="$emit('start')"
				>
					<Play :size="16" />
					{{ t('mining.start') }}
				</BaseButton>
				<BaseButton v-else variant="danger" :disabled="working" @click="$emit('stop')">
					<Square :size="16" />
					{{ t('mining.stop') }}
				</BaseButton>
				<BaseButton variant="ghost" :disabled="working" @click="$emit('resetStats')">
					<RotateCcw :size="16" />
					{{ t('mining.resetStats') }}
				</BaseButton>
			</div>
		</div>

		<div v-if="state?.lastOutput" class="result mining-output">
			<strong>{{ t('mining.lastOutput') }}</strong>
			<pre>{{ state.lastOutput }}</pre>
		</div>

		<p v-if="error || state?.error" class="error">{{ error || state?.error }}</p>
		<p v-else-if="notice" class="notice">{{ notice }}</p>

		<details class="mining-guide">
			<summary>
				<span>{{ t('mining.guideTitle') }}</span>
				<ChevronDown :size="18" aria-hidden="true" />
			</summary>
			<ol>
				<li>{{ t('mining.guideStep1') }}</li>
				<li>{{ t('mining.guideStep2') }}</li>
				<li>{{ t('mining.guideStep3') }}</li>
				<li>{{ t('mining.guideStep4') }}</li>
				<li>{{ t('mining.guideStep5') }}</li>
			</ol>
			<div class="mining-source-list">
				<strong>{{ t('mining.sourcesTitle') }}</strong>
				<a
					v-for="source in minerSources"
					:key="source.key"
					:href="source.url"
					target="_blank"
					rel="noreferrer"
				>
					<span>{{ source.label }}</span>
					<small>{{ t(source.noteKey) }}</small>
				</a>
			</div>
			<p>{{ t('mining.guideWarning') }}</p>
		</details>
	</BasePanel>
</template>
