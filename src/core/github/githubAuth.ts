import type { GitHubRateLimit } from '@shared/contracts'

export function createGitHubAuthHeaders(token?: string): Record<string, string> {
	const normalized = token?.trim()
	if (!normalized) return {}

	return {
		Authorization: `Bearer ${normalized}`
	}
}

export function redactGitHubToken(value: string, token?: string): string {
	const normalized = token?.trim()
	if (!normalized) return value
	return value.split(normalized).join('[redacted-github-token]')
}

export function parseGitHubRateLimit(
	headers: Headers | Record<string, string | undefined>
): GitHubRateLimit {
	const get = (key: string): string | undefined => {
		if (headers instanceof Headers) return headers.get(key) ?? undefined
		return headers[key] ?? headers[key.toLowerCase()]
	}
	const limit = parseOptionalInt(get('X-RateLimit-Limit'))
	const remaining = parseOptionalInt(get('X-RateLimit-Remaining'))
	const reset = parseOptionalInt(get('X-RateLimit-Reset'))

	return {
		limit,
		remaining,
		resetAt: reset ? new Date(reset * 1000).toISOString() : undefined
	}
}

export function classifyGitHubAuthError(status: number): string {
	if (status === 401) return 'GitHub token неверный или истек'
	if (status === 403) return 'GitHub token не имеет прав или превышен лимит запросов'
	return 'GitHub вернул ошибку авторизации'
}

function parseOptionalInt(value?: string): number | undefined {
	if (!value) return undefined
	const parsed = Number.parseInt(value, 10)
	return Number.isFinite(parsed) ? parsed : undefined
}
