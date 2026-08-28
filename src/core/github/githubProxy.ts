import { LauncherError } from '@shared/errors'

const supportedProxyProtocols = new Set(['http:', 'https:', 'socks4:', 'socks5:'])

export interface GitHubProxySettings {
	enabled: boolean
	url: string
}

export function validateGitHubProxySettings(input: GitHubProxySettings): GitHubProxySettings {
	const url = input.url.trim()
	if (!input.enabled) {
		return { enabled: false, url: normalizeGitHubProxyUrl(url) }
	}
	if (!url) {
		throw new LauncherError(
			'Укажи адрес прокси, например http://127.0.0.1:7890',
			'GITHUB_PROXY_URL_REQUIRED'
		)
	}

	return {
		enabled: input.enabled,
		url: parseGitHubProxyUrl(url)
	}
}

export function normalizeGitHubProxyUrl(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return ''
	try {
		return parseGitHubProxyUrl(value.trim())
	} catch {
		return ''
	}
}

export function parseGitHubProxyUrl(value: string): string {
	let parsed: URL
	try {
		parsed = new URL(value)
	} catch (error) {
		throw new LauncherError(
			'Некорректный адрес прокси. Укажи схему, хост и порт',
			'GITHUB_PROXY_URL_INVALID',
			error
		)
	}

	if (!supportedProxyProtocols.has(parsed.protocol)) {
		throw new LauncherError(
			'Поддерживаются HTTP, HTTPS, SOCKS4 и SOCKS5 прокси',
			'GITHUB_PROXY_PROTOCOL_UNSUPPORTED'
		)
	}
	if (!parsed.hostname) {
		throw new LauncherError('В адресе прокси не указан хост', 'GITHUB_PROXY_HOST_REQUIRED')
	}
	if (parsed.port && Number(parsed.port) < 1) {
		throw new LauncherError(
			'Порт прокси должен быть от 1 до 65535',
			'GITHUB_PROXY_PORT_INVALID'
		)
	}
	if (parsed.username || parsed.password) {
		throw new LauncherError(
			'Прокси с логином и паролем в адресе не поддерживается. Используй прокси без авторизации или системный VPN/прокси',
			'GITHUB_PROXY_CREDENTIALS_UNSUPPORTED'
		)
	}
	if ((parsed.pathname && parsed.pathname !== '/') || parsed.search || parsed.hash) {
		throw new LauncherError(
			'Адрес прокси не должен содержать путь, параметры или якорь',
			'GITHUB_PROXY_URL_INVALID'
		)
	}

	return parsed.toString().replace(/\/$/, '')
}
