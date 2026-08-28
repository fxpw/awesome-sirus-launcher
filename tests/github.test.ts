import { describe, expect, it } from 'vitest'
import {
	classifyGitHubAuthError,
	createGitHubAuthHeaders,
	isTrustedGitHubUrl,
	parseGitHubRateLimit,
	redactGitHubToken
} from '../src/core/github/githubAuth'
import { createGitHubHttpError, createGitHubNetworkError } from '../src/core/github/githubErrors'
import { parseGitHubProxyUrl } from '../src/core/github/githubProxy'
import { buildGitHubSourceZipUrl } from '../src/core/github/sourceZip'

describe('GitHub helpers', () => {
	it('creates auth header only when token is present', () => {
		expect(createGitHubAuthHeaders()).toEqual({})
		expect(createGitHubAuthHeaders('  token-123  ')).toEqual({
			Authorization: 'Bearer token-123'
		})
	})

	it('redacts token from loggable text', () => {
		expect(redactGitHubToken('Authorization: Bearer token-123', 'token-123')).toBe(
			'Authorization: Bearer [redacted-github-token]'
		)
	})

	it('parses rate limit headers', () => {
		expect(
			parseGitHubRateLimit({
				'x-ratelimit-limit': '5000',
				'x-ratelimit-remaining': '4999',
				'x-ratelimit-reset': '1893456000'
			})
		).toEqual({
			limit: 5000,
			remaining: 4999,
			resetAt: '2030-01-01T00:00:00.000Z'
		})
	})

	it('classifies auth errors', () => {
		expect(classifyGitHubAuthError(401)).toContain('неверный')
		expect(classifyGitHubAuthError(403)).toContain('лимит')
	})

	it('builds GitHub source zip URL', () => {
		expect(buildGitHubSourceZipUrl({ repo: 'owner/repo', ref: 'master' })).toBe(
			'https://github.com/owner/repo/archive/refs/heads/master.zip'
		)
	})

	it('allows tokens only for trusted GitHub hosts', () => {
		expect(isTrustedGitHubUrl('https://api.github.com/repos/owner/repo')).toBe(true)
		expect(isTrustedGitHubUrl('https://raw.githubusercontent.com/owner/repo/main/a.toc')).toBe(
			true
		)
		expect(isTrustedGitHubUrl('https://github.com.evil.example/file')).toBe(false)
		expect(isTrustedGitHubUrl('https://example.test/version.toc')).toBe(false)
		expect(isTrustedGitHubUrl('http://raw.githubusercontent.com/owner/repo/main/a.toc')).toBe(
			false
		)
	})

	it('validates supported proxy URLs without credentials or paths', () => {
		expect(parseGitHubProxyUrl('http://127.0.0.1:7890/')).toBe('http://127.0.0.1:7890')
		expect(parseGitHubProxyUrl('socks5://localhost:1080')).toBe('socks5://localhost:1080')
		expect(() => parseGitHubProxyUrl('ftp://localhost:21')).toThrow('HTTP, HTTPS')
		expect(() => parseGitHubProxyUrl('http://user:secret@localhost:8080')).toThrow(
			'логином и паролем'
		)
		expect(() => parseGitHubProxyUrl('http://localhost:8080/path')).toThrow(
			'не должен содержать путь'
		)
		expect(() => parseGitHubProxyUrl('http://localhost:0')).toThrow('Порт прокси')
	})

	it('classifies GitHub HTTP errors including rate limits and regional blocks', () => {
		const limited = createGitHubHttpError(
			new Response(null, {
				status: 403,
				headers: {
					'x-ratelimit-remaining': '0',
					'x-ratelimit-reset': '1893456000'
				}
			})
		)
		const blocked = createGitHubHttpError(new Response(null, { status: 451 }))
		const unavailable = createGitHubHttpError(new Response(null, { status: 503 }))
		const secondaryLimit = createGitHubHttpError(
			new Response(null, { status: 403, headers: { 'retry-after': '60' } })
		)

		expect(limited.code).toBe('GITHUB_RATE_LIMITED')
		expect(limited.message).toContain('2030-01-01')
		expect(blocked.code).toBe('GITHUB_REGION_BLOCKED')
		expect(blocked.message).toContain('регионе')
		expect(unavailable.code).toBe('GITHUB_UNAVAILABLE')
		expect(secondaryLimit.code).toBe('GITHUB_RATE_LIMITED')
		expect(secondaryLimit.message).toContain('60 сек')
	})

	it('classifies DNS, timeout, proxy and TLS network failures', () => {
		const withCode = (code: string) => Object.assign(new Error('fetch failed'), { code })

		expect(createGitHubNetworkError(withCode('ENOTFOUND'), { usingProxy: false }).code).toBe(
			'GITHUB_DNS_FAILED'
		)
		expect(
			createGitHubNetworkError(withCode('ERR_CONNECTION_TIMED_OUT'), { usingProxy: false })
				.code
		).toBe('GITHUB_TIMEOUT')
		expect(
			createGitHubNetworkError(withCode('ERR_PROXY_CONNECTION_FAILED'), {
				usingProxy: true
			}).code
		).toBe('GITHUB_PROXY_UNAVAILABLE')
		expect(
			createGitHubNetworkError(withCode('ERR_CERT_AUTHORITY_INVALID'), { usingProxy: true })
				.code
		).toBe('GITHUB_TLS_FAILED')
	})
})
