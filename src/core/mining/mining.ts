import { basename, normalize, resolve } from 'node:path'
import type { MiningConfig, MiningConfigInput, MiningState, MiningStatus } from '@shared/contracts'

export const defaultMiningConfig: MiningConfig = {
	consentAccepted: false,
	minerPath: '',
	arguments: '',
	poolUrl: '',
	walletAddress: '',
	workerName: 'awesome-sirus-support',
	coinSymbol: 'COIN'
}

export function normalizeMiningConfig(value: unknown): MiningConfig {
	if (!isRecord(value)) return { ...defaultMiningConfig }

	return {
		consentAccepted: value.consentAccepted === true,
		minerPath: normalizePath(value.minerPath),
		arguments: normalizeText(value.arguments),
		poolUrl: normalizeText(value.poolUrl),
		walletAddress: normalizeText(value.walletAddress),
		workerName: normalizeText(value.workerName) || defaultMiningConfig.workerName,
		coinSymbol: normalizeText(value.coinSymbol) || defaultMiningConfig.coinSymbol
	}
}

export function applyMiningConfigPatch(
	current: MiningConfig,
	patch: MiningConfigInput
): MiningConfig {
	return normalizeMiningConfig({
		...current,
		...patch
	})
}

export function createMiningState(input: {
	status: MiningStatus
	config: MiningConfig
	startedAt?: string
	stoppedAt?: string
	hashrate?: string
	acceptedSharesTotal?: number
	acceptedSharesSession?: number
	receivedTotal?: number
	receivedSession?: number
	lastOutput?: string
	error?: string
}): MiningState {
	return {
		status: input.status,
		config: input.config,
		commandPreview: createCommandPreview(input.config),
		startedAt: input.startedAt,
		stoppedAt: input.stoppedAt,
		hashrate: input.hashrate ?? '0 H/s',
		acceptedSharesTotal: input.acceptedSharesTotal ?? 0,
		acceptedSharesSession: input.acceptedSharesSession ?? 0,
		receivedTotal: input.receivedTotal ?? 0,
		receivedSession: input.receivedSession ?? 0,
		lastOutput: input.lastOutput ?? '',
		error: input.error
	}
}

export function validateMiningStart(config: MiningConfig): void {
	if (!config.consentAccepted) {
		throw new Error('Нужно явно согласиться на запуск майнинга')
	}
	if (!config.minerPath) {
		throw new Error('Укажи путь к exe-файлу майнера')
	}
	if (!config.arguments) {
		throw new Error('Укажи видимые аргументы запуска майнера')
	}
}

export function splitMiningArguments(value: string): string[] {
	const args: string[] = []
	let current = ''
	let quote: '"' | "'" | null = null
	let escaping = false

	for (const char of value) {
		if (escaping) {
			current += char
			escaping = false
			continue
		}

		if (char === '\\') {
			escaping = true
			continue
		}

		if (quote) {
			if (char === quote) quote = null
			else current += char
			continue
		}

		if (char === '"' || char === "'") {
			quote = char
			continue
		}

		if (/\s/.test(char)) {
			if (current) {
				args.push(current)
				current = ''
			}
			continue
		}

		current += char
	}

	if (escaping) current += '\\'
	if (current) args.push(current)

	return args
}

export function createCommandPreview(config: MiningConfig): string {
	const executable = config.minerPath ? basename(config.minerPath) : 'miner.exe'
	return [executable, config.arguments].filter(Boolean).join(' ')
}

function normalizePath(value: unknown): string {
	if (typeof value !== 'string') return ''
	const trimmed = value.trim()
	return trimmed ? normalize(resolve(trimmed)) : ''
}

function normalizeText(value: unknown): string {
	return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}
