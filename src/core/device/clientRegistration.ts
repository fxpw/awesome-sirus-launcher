export const SIRUS_API_BASE_URL = 'https://api.sirus.su'
export const CLIENT_REGISTER_PATH = '/api/client/register'
export const CLIENT_HANDSHAKE_PATH = '/api/client/handshake/'
export const CLIENT_HANDSHAKE_INTERVAL_MS = 3 * 60 * 60 * 1000

export function createSirusLauncherUserAgent(appVersion: string): string {
	return `sirus-launcher ${appVersion}`
}

export interface ClientRegistrationInfo {
	uuid: string
	platform: string
	os_version: string
	arch: string
	cpu_count: number
	cpu_model: string
	total_memory: number
}

export interface ClientRegistrationRecord {
	registered: string
}

export interface ClientRegisterResponse {
	success?: boolean
}
