import { describe, expect, it } from 'vitest'
import {
	classifyGitHubAuthError,
	createGitHubAuthHeaders,
	parseGitHubRateLimit,
	redactGitHubToken
} from '../src/core/github/githubAuth'
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
})
