import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
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

interface MiningStorage {
	config: MiningConfig
	acceptedSharesTotal: number
	receivedTotal: number
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
	let receivedSession = 0
	let lastOutput = ''
	let error: string | undefined

	async function getStorage(): Promise<MiningStorage> {
		return readStorage(getFilePath())
	}

	async function saveStorage(storage: MiningStorage): Promise<void> {
		await writeStorage(getFilePath(), storage)
	}

	async function createState(): Promise<MiningState> {
		const storage = await getStorage()
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
			receivedTotal: storage.receivedTotal,
			receivedSession,
			lastOutput,
			error
		})
	}

	return {
		async getState() {
			return createState()
		},

		async saveConfig(patch) {
			const storage = await getStorage()
			storage.config = applyMiningConfigPatch(storage.config, patch)
			await saveStorage(storage)
			return createState()
		},

		async selectMinerPath(minerPath) {
			const storage = await getStorage()
			storage.config = applyMiningConfigPatch(storage.config, { minerPath })
			await saveStorage(storage)
			return createState()
		},

		async start() {
			if (processHandle) return createState()

			const storage = await getStorage()
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
			receivedSession = 0
			lastOutput = ''

			processHandle = runner.start(
				storage.config.minerPath,
				splitMiningArguments(storage.config.arguments),
				async (text) => {
					lastOutput = compactOutput(text)
					hashrate = extractHashrate(text) ?? hashrate
					const accepted = countAcceptedShares(text)
					if (accepted > 0) {
						acceptedSharesSession += accepted
						const nextStorage = await getStorage()
						nextStorage.acceptedSharesTotal += accepted
						await saveStorage(nextStorage)
					}
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
			const storage = await getStorage()
			storage.acceptedSharesTotal = 0
			storage.receivedTotal = 0
			acceptedSharesSession = 0
			receivedSession = 0
			await saveStorage(storage)
			return createState()
		}
	}
}

async function readStorage(filePath: string): Promise<MiningStorage> {
	if (!existsSync(filePath)) {
		return {
			config: { ...defaultMiningConfig },
			acceptedSharesTotal: 0,
			receivedTotal: 0
		}
	}

	const raw = await readFile(filePath, 'utf8')
	const parsed = JSON.parse(raw) as Partial<MiningStorage>

	return {
		config: normalizeMiningConfig(parsed.config),
		acceptedSharesTotal: normalizeNumber(parsed.acceptedSharesTotal),
		receivedTotal: normalizeNumber(parsed.receivedTotal)
	}
}

async function writeStorage(filePath: string, storage: MiningStorage): Promise<void> {
	const tempPath = `${filePath}.tmp`
	await mkdir(dirname(filePath), { recursive: true })
	await writeFile(tempPath, JSON.stringify(storage, null, 2), 'utf8')
	await rename(tempPath, filePath)
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
