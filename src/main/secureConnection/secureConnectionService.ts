import { connect, type Socket } from 'node:net'
import {
	createMcrRequestFrame,
	createMcrResponseFrame,
	parseMcrChallenge
} from '@core/secureConnection/mcrProtocol'
import { createSirusLauncherUserAgent } from '@core/device/clientRegistration'
import {
	DEFAULT_FETCH_TIMEOUT_MS,
	DEFAULT_VERIFY_TIMEOUT_MS,
	SECURED_CONNECTION_API_BASE,
	SECURED_CONNECTION_PATH,
	verifySecureConnection,
	type SecuredConnectionConfig,
	type SecureConnectionHost,
	type VerifySecureConnectionResult
} from '@core/secureConnection/verifySecureConnection'
import type { SirusLauncherVersionService } from '@main/sirus/sirusLauncherVersionService'

export function createSecureConnectionService(
	sirusLauncherVersionService: SirusLauncherVersionService
) {
	return {
		verifyClient(): Promise<VerifySecureConnectionResult> {
			return verifySecureConnection('', {
				fetchConfig: async () => {
					const version = await sirusLauncherVersionService.getVersion()
					return fetchSecuredConfig(createSirusLauncherUserAgent(version))
				},
				establishConnection: establishSecureConnection,
				logger: console,
				verifyTimeoutMs: DEFAULT_VERIFY_TIMEOUT_MS
			})
		}
	}
}

async function fetchSecuredConfig(userAgent: string): Promise<SecuredConnectionConfig | null> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS)

	try {
		const response = await fetch(SECURED_CONNECTION_API_BASE + SECURED_CONNECTION_PATH, {
			headers: { 'user-agent': userAgent },
			signal: controller.signal
		})
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} for ${SECURED_CONNECTION_PATH}`)
		}

		return (await response.json()) as SecuredConnectionConfig
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error('secured-connection.json: таймаут')
		}
		throw error
	} finally {
		clearTimeout(timeout)
	}
}

function establishSecureConnection(host: SecureConnectionHost): Promise<void> {
	return new Promise((resolve, reject) => {
		const sock = connect({ host: host.host, port: host.port })
		let done = false
		let recv = Buffer.alloc(0)
		let challengeHandled = false
		let responseSent = false

		const finish = (callback: () => void) => {
			if (done) return
			done = true
			try {
				sock.destroy()
			} finally {
				callback()
			}
		}

		sock.on('error', (error) => {
			const code = 'code' in error ? String(error.code) : ''
			if (responseSent && (code === 'ECONNRESET' || code === 'EPIPE')) {
				finish(() => resolve())
				return
			}
			finish(() => reject(error))
		})
		sock.on('connect', () => writeFrame(sock, createMcrRequestFrame()))
		sock.on('data', (chunk) => {
			if (challengeHandled) return
			recv = Buffer.concat([recv, chunk])
			if (recv.length < 8) return
			challengeHandled = true

			const parsed = parseMcrChallenge(recv)
			if (parsed.kind === 'http') {
				finish(() => resolve())
				return
			}
			if (parsed.kind !== 'challenge') {
				finish(() => reject(new Error('Invalid challenge signature')))
				return
			}

			writeFrame(sock, createMcrResponseFrame(parsed.cookie, host.key))
			responseSent = true
			setTimeout(() => finish(() => resolve()), host.delay)
		})
	})
}

function writeFrame(sock: Socket, frame: Uint8Array): void {
	sock.write(Buffer.from(frame))
}
