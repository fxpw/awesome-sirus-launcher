import { LauncherError } from '@shared/errors'
import { parseGitHubRateLimit } from './githubAuth'

export interface GitHubNetworkErrorContext {
	usingProxy: boolean
}

export function createGitHubHttpError(response: Response): LauncherError {
	const status = response.status
	const statusText = response.statusText.trim()
	const suffix = statusText ? ` (${statusText})` : ''

	if (status === 401) {
		return new LauncherError(
			'GitHub отклонил token. Проверь token в настройках или удали его',
			'GITHUB_AUTH_INVALID'
		)
	}
	if (status === 403) {
		const rateLimit = parseGitHubRateLimit(response.headers)
		const retryAfter = response.headers.get('retry-after')
		if (rateLimit.remaining === 0 || retryAfter) {
			const reset = rateLimit.resetAt ? ` Лимит обновится: ${rateLimit.resetAt}.` : ''
			const retry = retryAfter ? ` Повтори через ${retryAfter} сек.` : ''
			return new LauncherError(
				`GitHub временно ограничил количество запросов.${reset}${retry} Добавь token или повтори позже`,
				'GITHUB_RATE_LIMITED'
			)
		}
		return new LauncherError(
			'GitHub запретил доступ. Репозиторий может быть приватным, либо доступ ограничен сетью или регионом',
			'GITHUB_FORBIDDEN'
		)
	}
	if (status === 404) {
		return new LauncherError(
			'GitHub не нашёл репозиторий, ветку или файл. Возможно, ссылка устарела',
			'GITHUB_NOT_FOUND'
		)
	}
	if (status === 407) {
		return new LauncherError(
			'Прокси требует авторизацию, а ручная настройка поддерживает только прокси без логина и пароля. Используй другой прокси или системный VPN/прокси',
			'GITHUB_PROXY_AUTH_REQUIRED'
		)
	}
	if (status === 408) {
		return new LauncherError(
			'GitHub не ответил вовремя. Повтори попытку или включи VPN/прокси',
			'GITHUB_TIMEOUT'
		)
	}
	if (status === 429) {
		return new LauncherError(
			'GitHub временно ограничил количество запросов. Добавь token или повтори позже',
			'GITHUB_RATE_LIMITED'
		)
	}
	if (status === 451) {
		return new LauncherError(
			'GitHub сообщил, что контент недоступен в этом регионе. Включи VPN или укажи прокси в настройках',
			'GITHUB_REGION_BLOCKED'
		)
	}
	if (status >= 500) {
		return new LauncherError(
			`Серверы GitHub временно недоступны: HTTP ${status}${suffix}. Повтори позже`,
			'GITHUB_UNAVAILABLE'
		)
	}

	return new LauncherError(`GitHub вернул ошибку HTTP ${status}${suffix}`, 'GITHUB_HTTP_ERROR')
}

export function createGitHubNetworkError(
	error: unknown,
	context: GitHubNetworkErrorContext
): LauncherError {
	if (error instanceof LauncherError) return error

	const details = collectErrorDetails(error).toLowerCase()
	if (matches(details, ['err_proxy_auth', 'proxy authentication', 'proxy auth'])) {
		return new LauncherError(
			'Прокси требует авторизацию, а ручная настройка поддерживает только прокси без логина и пароля. Используй другой прокси или системный VPN/прокси',
			'GITHUB_PROXY_AUTH_REQUIRED',
			error
		)
	}
	if (
		matches(details, [
			'err_proxy_connection_failed',
			'err_tunnel_connection_failed',
			'err_no_supported_proxies',
			'proxy connection'
		])
	) {
		return new LauncherError(
			'Не удалось подключиться к прокси. Проверь адрес, порт и запущен ли прокси',
			'GITHUB_PROXY_UNAVAILABLE',
			error
		)
	}
	if (matches(details, ['aborterror', 'timeouterror', 'timedout', 'timed_out', 'etimedout'])) {
		return new LauncherError(
			'GitHub не ответил вовремя. Сервис может быть недоступен или заблокирован; проверь VPN/прокси',
			'GITHUB_TIMEOUT',
			error
		)
	}
	if (matches(details, ['err_name_not_resolved', 'enotfound', 'eai_again'])) {
		return new LauncherError(
			context.usingProxy
				? 'Ошибка DNS: не удалось найти GitHub или адрес прокси. Проверь адрес прокси и DNS'
				: 'Не удалось найти GitHub через DNS. Проверь интернет; если доступ ограничен, включи VPN или прокси',
			'GITHUB_DNS_FAILED',
			error
		)
	}
	if (matches(details, ['err_internet_disconnected', 'enetunreach', 'ehostunreach'])) {
		return new LauncherError(
			'Нет подключения к интернету. Проверь сеть и повтори попытку',
			'NETWORK_UNAVAILABLE',
			error
		)
	}
	if (matches(details, ['err_connection_refused', 'econnrefused'])) {
		return new LauncherError(
			context.usingProxy
				? 'Прокси отклонил подключение. Проверь адрес, порт и запущен ли прокси'
				: 'Соединение с GitHub отклонено. Сервис может быть недоступен или заблокирован',
			context.usingProxy ? 'GITHUB_PROXY_UNAVAILABLE' : 'GITHUB_UNAVAILABLE',
			error
		)
	}
	if (matches(details, ['err_cert_', 'err_ssl_', 'certificate', 'self_signed_cert'])) {
		return new LauncherError(
			'Не удалось проверить сертификат GitHub. Проверь дату Windows, антивирус и настройки прокси',
			'GITHUB_TLS_FAILED',
			error
		)
	}
	if (
		matches(details, [
			'err_connection_reset',
			'err_connection_closed',
			'econnreset',
			'socket hang up'
		])
	) {
		return new LauncherError(
			'Соединение с GitHub было прервано. Возможна блокировка провайдером; попробуй VPN или прокси',
			'GITHUB_CONNECTION_RESET',
			error
		)
	}

	return new LauncherError(
		context.usingProxy
			? 'Не удалось подключиться к GitHub через прокси. Проверь прокси или переключись на системное подключение/VPN'
			: 'GitHub недоступен. Проверь интернет; если доступ ограничен в регионе, включи VPN или укажи прокси',
		'GITHUB_NETWORK_ERROR',
		error
	)
}

function collectErrorDetails(error: unknown): string {
	const parts: string[] = []
	let current: unknown = error
	const visited = new Set<unknown>()

	while (current && !visited.has(current) && parts.length < 12) {
		visited.add(current)
		if (current instanceof Error) {
			parts.push(current.name, current.message)
		}
		if (typeof current === 'object') {
			const record = current as Record<string, unknown>
			if (typeof record.code === 'string') parts.push(record.code)
			current = record.cause
			continue
		}
		parts.push(String(current))
		break
	}

	return parts.join(' ')
}

function matches(value: string, needles: string[]): boolean {
	return needles.some((needle) => value.includes(needle))
}
