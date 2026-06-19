export const SECURED_CONNECTION_API_BASE = 'https://api.sirus.su'
export const SECURED_CONNECTION_PATH = '/api/secured-connection.json'
export const DEFAULT_VERIFY_TIMEOUT_MS = 5000
export const DEFAULT_FETCH_TIMEOUT_MS = 5000

export interface SecuredConnectionHostConfig {
	address: string
	port: number
	phrase: string
	delay?: number
}

export interface SecuredConnectionConfig {
	enabled: boolean
	hosts: SecuredConnectionHostConfig[]
}

export interface SecureConnectionHost {
	host: string
	port: number
	key: string
	delay: number
}

export interface SecureConnectionLogger {
	info(message: string): void
	warn(message: string): void
}

export interface VerifySecureConnectionResult {
	verified: boolean
	error?: string
}

export interface VerifySecureConnectionDeps {
	fetchConfig: (appVersion: string) => Promise<SecuredConnectionConfig | null>
	establishConnection: (host: SecureConnectionHost) => Promise<void>
	logger?: SecureConnectionLogger
	verifyTimeoutMs?: number
}

export function mapSecuredConnectionHosts(
	config: SecuredConnectionConfig
): SecureConnectionHost[] {
	return config.hosts.map((host) => ({
		host: host.address,
		port: host.port,
		key: host.phrase,
		delay: host.delay ?? 0
	}))
}

export async function verifySecureConnection(
	appVersion: string,
	deps: VerifySecureConnectionDeps
): Promise<VerifySecureConnectionResult> {
	const log = deps.logger ?? { info() {}, warn() {} }
	const verifyTimeoutMs = deps.verifyTimeoutMs ?? DEFAULT_VERIFY_TIMEOUT_MS

	try {
		const result = await Promise.race([
			runVerification(appVersion, deps),
			new Promise<VerifySecureConnectionResult>((resolve) => {
				setTimeout(
					() => resolve({ verified: false, error: 'Connection timeout' }),
					verifyTimeoutMs
				)
			})
		])

		if (result.verified) log.info('[mcr] secure-connection ок')
		else log.warn(`[mcr] secure-connection не подтверждён: ${result.error ?? 'unknown'}`)

		return result
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		log.warn(`[mcr] secure-connection ошибка: ${message}`)
		return { verified: false, error: message }
	}
}

async function runVerification(
	appVersion: string,
	deps: VerifySecureConnectionDeps
): Promise<VerifySecureConnectionResult> {
	const config = await deps.fetchConfig(appVersion)
	if (!config || !config.enabled || !Array.isArray(config.hosts) || config.hosts.length === 0) {
		return { verified: true }
	}

	await Promise.all(mapSecuredConnectionHosts(config).map((host) => deps.establishConnection(host)))
	return { verified: true }
}
