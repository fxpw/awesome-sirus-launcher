import { createRequire } from 'node:module'
import { cpus, platform, release, totalmem, arch } from 'node:os'
import {
	CLIENT_HANDSHAKE_INTERVAL_MS,
	CLIENT_HANDSHAKE_PATH,
	CLIENT_REGISTER_PATH,
	createSirusLauncherUserAgent,
	SIRUS_API_BASE_URL,
	type ClientRegisterResponse,
	type ClientRegistrationInfo
} from '@core/device/clientRegistration'
import type { ClientRegistrationStore } from '@main/device/clientRegistrationStore'
import type { SirusLauncherVersionService } from '@main/sirus/sirusLauncherVersionService'

const require = createRequire(import.meta.url)
const { machineId } = require('node-machine-id') as {
	machineId: (original?: boolean) => Promise<string>
}

export interface ClientRegistrationService {
	ensureRegistered(): Promise<string>
	startHandshakePolling(): void
	stopHandshakePolling(): void
}

export function createClientRegistrationService(
	store: ClientRegistrationStore,
	sirusLauncherVersionService: SirusLauncherVersionService
): ClientRegistrationService {
	let handshakeTimer: NodeJS.Timeout | undefined
	let handshakeStarted = false

	return {
		async ensureRegistered() {
			const existing = await store.get()
			if (existing?.registered) {
				startHandshakePollingInternal()
				return existing.registered
			}

			const uuid = await machineId()
			const response = await postJson<ClientRegisterResponse>(
				CLIENT_REGISTER_PATH,
				buildRegistrationInfo(uuid)
			)
			if (!response.success) {
				throw new Error('Регистрация клиента отклонена сервером Sirus')
			}

			await store.save({ registered: uuid })
			startHandshakePollingInternal()
			return uuid
		},
		startHandshakePolling() {
			startHandshakePollingInternal()
		},
		stopHandshakePolling() {
			if (!handshakeTimer) return
			clearTimeout(handshakeTimer)
			handshakeTimer = undefined
			handshakeStarted = false
		}
	}

	function startHandshakePollingInternal() {
		if (handshakeStarted) return
		handshakeStarted = true
		void runHandshake()
	}

	async function runHandshake() {
		const record = await store.get()
		if (!record?.registered) return

		try {
			await getJson(`${CLIENT_HANDSHAKE_PATH}${record.registered}`)
		} catch (error) {
			console.warn(
				'[client] handshake ошибка:',
				error instanceof Error ? error.message : String(error)
			)
		}

		handshakeTimer = setTimeout(() => {
			void runHandshake()
		}, CLIENT_HANDSHAKE_INTERVAL_MS)
	}

	async function userAgentHeader(): Promise<Record<string, string>> {
		const version = await sirusLauncherVersionService.getVersion()
		return { 'user-agent': createSirusLauncherUserAgent(version) }
	}

	async function postJson<T>(path: string, body: unknown): Promise<T> {
		const response = await fetch(new URL(path, SIRUS_API_BASE_URL), {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				...(await userAgentHeader())
			},
			body: JSON.stringify(body)
		})
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} for ${path}`)
		}
		return (await response.json()) as T
	}

	async function getJson(path: string): Promise<unknown> {
		const response = await fetch(new URL(path, SIRUS_API_BASE_URL), {
			headers: await userAgentHeader()
		})
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} for ${path}`)
		}
		return response.json()
	}
}

function buildRegistrationInfo(uuid: string): ClientRegistrationInfo {
	const cpuList = cpus()
	return {
		uuid,
		platform: platform(),
		os_version: release(),
		arch: arch(),
		cpu_count: cpuList.length,
		cpu_model: cpuList[0]?.model ?? '',
		total_memory: totalmem()
	}
}
