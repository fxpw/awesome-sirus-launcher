import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type { MiningConfig, MiningConfigInput, MiningState, MiningStatus } from '@shared/contracts'
import {
	applyMiningConfigPatch,
	createMiningState,
	defaultMiningConfig,
	normalizeMiningConfig,
	splitMiningArguments,
	validateMiningStart
} from '@core/mining/mining'
import { isRecord } from '@core/isRecord'
import { readJsonFile, writeJsonFile } from '@main/files/jsonFile'

interface MiningStorage {
	config: MiningConfig
	acceptedSharesTotal: number
}

export interface MiningProcessRunner {
	start(
		executablePath: string,
		args: string[],
		onOutput: (text: string) => void
	): {
		stop(): void
		onExit(callback: (code: number | null, signal: NodeJS.Signals | null) => void): void
	}
}

export interface MiningService {
	getState(): Promise<MiningState>
	saveConfig(patch: MiningConfigInput): Promise<MiningState>
	start(): Promise<MiningState>
	stop(): Promise<MiningState>
	resetStats(): Promise<MiningState>
	selectMinerPath(minerPath: string): Promise<MiningState>
}

export function createChildProcessMiningRunner(
	spawnProcess: (executablePath: string, args: string[]) => ChildProcessWithoutNullStreams
): MiningProcessRunner {
	return {
		start(executablePath, args, onOutput) {
			const child = spawnProcess(executablePath, args)
			child.stdout.on('data', (data) => onOutput(String(data)))
			child.stderr.on('data', (data) => onOutput(String(data)))

			return {
				stop() {
					if (!child.killed) child.kill()
				},
				onExit(callback) {
					child.once('exit', callback)
				}
			}
		}
	}
}

export function createMiningService(
	getUserDataPath: () => string,
	runner: MiningProcessRunner
): MiningService {
	const getFilePath = () => join(getUserDataPath(), 'mining.json')
	let processHandle: ReturnType<MiningProcessRunner['start']> | null = null
	let status: MiningStatus = 'stopped'
	let startedAt: string | undefined
	let stoppedAt: string | undefined
	let hashrate = '0 H/s'
	let acceptedSharesSession = 0
	let lastOutput = ''
	let error: string | undefined
	let storageQueue: Promise<unknown> = Promise.resolve()

	function updateStorage(change: (storage: MiningStorage) => void): Promise<void> {
		const update = storageQueue.then(async () => {
			const storage = await readStorage(getFilePath())
			change(storage)
			await writeJsonFile(getFilePath(), storage)
		})
		storageQueue = update.catch(() => undefined)
		return update
	}

	async function createState(): Promise<MiningState> {
		const storage = await readStorage(getFilePath())
		const normalizedStatus = !storage.config.minerPath
			? 'not-configured'
			: processHandle
				? status
				: status === 'failed'
					? 'failed'
					: 'stopped'

		return createMiningState({
			status: normalizedStatus,
			config: storage.config,
			startedAt,
			stoppedAt,
			hashrate,
			acceptedSharesTotal: storage.acceptedSharesTotal,
			acceptedSharesSession,
			lastOutput,
			error
		})
	}

	return {
		async getState() {
			return createState()
		},

		async saveConfig(patch) {
			await updateStorage((storage) => {
				storage.config = applyMiningConfigPatch(storage.config, patch)
			})
			return createState()
		},

		async selectMinerPath(minerPath) {
			await updateStorage((storage) => {
				storage.config = applyMiningConfigPatch(storage.config, { minerPath })
			})
			return createState()
		},

		async start() {
			if (processHandle) return createState()

			const storage = await readStorage(getFilePath())
			validateMiningStart(storage.config)
			if (!existsSync(storage.config.minerPath)) {
				throw new Error('Файл майнера не найден')
			}

			error = undefined
			status = 'running'
			startedAt = new Date().toISOString()
			stoppedAt = undefined
			hashrate = '0 H/s'
			acceptedSharesSession = 0
			lastOutput = ''

			processHandle = runner.start(
				storage.config.minerPath,
				splitMiningArguments(storage.config.arguments),
				(text) => {
					lastOutput = compactOutput(text)
					hashrate = extractHashrate(text) ?? hashrate
					const accepted = countAcceptedShares(text)
					if (accepted === 0) return

					acceptedSharesSession += accepted
					updateStorage((nextStorage) => {
						nextStorage.acceptedSharesTotal += accepted
					}).catch((saveError) => {
						console.warn(
							'[mining] не удалось сохранить счётчик шар:',
							saveError instanceof Error ? saveError.message : String(saveError)
						)
					})
				}
			)

			processHandle.onExit((_code, signal) => {
				processHandle = null
				stoppedAt = new Date().toISOString()
				hashrate = '0 H/s'
				if (status === 'running') {
					status = signal ? 'stopped' : 'failed'
					if (!signal) error = 'Процесс майнера завершился'
				}
			})

			return createState()
		},

		async stop() {
			if (processHandle) processHandle.stop()
			processHandle = null
			status = 'stopped'
			stoppedAt = new Date().toISOString()
			hashrate = '0 H/s'
			return createState()
		},

		async resetStats() {
			acceptedSharesSession = 0
			await updateStorage((storage) => {
				storage.acceptedSharesTotal = 0
			})
			return createState()
		}
	}
}

async function readStorage(filePath: string): Promise<MiningStorage> {
	const parsed = await readJsonFile(filePath)
	if (!isRecord(parsed)) {
		return { config: { ...defaultMiningConfig }, acceptedSharesTotal: 0 }
	}

	return {
		config: normalizeMiningConfig(parsed.config),
		acceptedSharesTotal: normalizeNumber(parsed.acceptedSharesTotal)
	}
}

function normalizeNumber(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function compactOutput(text: string): string {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(-3)
		.join('\n')
}

function extractHashrate(text: string): string | undefined {
	const match = text.match(/(\d+(?:[.,]\d+)?)\s*([KMGT]?H\/s)/i)
	if (!match) return undefined

	return `${match[1].replace(',', '.')} ${match[2]}`
}

function countAcceptedShares(text: string): number {
	const matches = text.match(/accepted/gi)
	return matches?.length ?? 0
}
