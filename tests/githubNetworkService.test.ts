import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
	createGitHubNetworkService,
	type GitHubFetchSession,
	type GitHubProxyConfig
} from '../src/main/github/githubNetworkService'
import { defaultLauncherSettings } from '../src/core/settings/launcherSettings'
import type { LauncherSettings, LauncherSettingsPatch } from '../src/shared/contracts'
import type { SettingsStore } from '../src/main/settings/fileSettingsStore'

describe('GitHub network service', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined)
	})
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('uses the system network and configures its isolated session only once', async () => {
		const settingsStore = createSettingsStore()
		const requests: Array<{ url: string; init?: RequestInit }> = []
		const proxyConfigs: GitHubProxyConfig[] = []
		const session = createSession(requests, proxyConfigs)
		const service = createGitHubNetworkService(settingsStore, () => session)

		await service.fetchText('https://raw.githubusercontent.com/owner/repo/main/a.toc')
		await service.fetchJson('https://api.github.com/repos/owner/repo')

		expect(proxyConfigs).toEqual([{ mode: 'system' }])
		expect(session.closeAllConnections).toHaveBeenCalledTimes(1)
		expect(requests.map((request) => request.url)).toEqual([
			'https://raw.githubusercontent.com/owner/repo/main/a.toc',
			'https://api.github.com/repos/owner/repo'
		])
	})

	it('switches the session to a fixed proxy after settings change', async () => {
		const settingsStore = createSettingsStore()
		const proxyConfigs: GitHubProxyConfig[] = []
		const session = createSession([], proxyConfigs)
		const service = createGitHubNetworkService(settingsStore, () => session)

		await service.fetchText('https://github.com/owner/repo')
		await settingsStore.save({
			githubProxyEnabled: true,
			githubProxyUrl: 'socks5://127.0.0.1:1080'
		})
		await service.fetchText('https://github.com/owner/repo')

		expect(proxyConfigs).toEqual([
			{ mode: 'system' },
			{ mode: 'fixed_servers', proxyRules: 'socks5://127.0.0.1:1080' }
		])
		expect(session.closeAllConnections).toHaveBeenCalledTimes(2)
	})

	it('waits for active requests before switching proxy configuration', async () => {
		const settingsStore = createSettingsStore()
		const proxyConfigs: GitHubProxyConfig[] = []
		const session = createSession([], proxyConfigs)
		let finishFirstRequest: ((response: Response) => void) | undefined
		vi.mocked(session.fetch).mockImplementationOnce(
			async () =>
				new Promise<Response>((resolve) => {
					finishFirstRequest = resolve
				})
		)
		const service = createGitHubNetworkService(settingsStore, () => session)

		const firstRequest = service.fetchText('https://github.com/owner/first')
		await vi.waitFor(() => expect(session.fetch).toHaveBeenCalledTimes(1))
		await settingsStore.save({
			githubProxyEnabled: true,
			githubProxyUrl: 'http://127.0.0.1:7890'
		})
		const secondRequest = service.fetchText('https://github.com/owner/second')
		await new Promise((resolve) => setTimeout(resolve, 10))

		expect(proxyConfigs).toEqual([{ mode: 'system' }])
		expect(session.closeAllConnections).toHaveBeenCalledTimes(1)
		finishFirstRequest?.(new Response('first response'))
		await firstRequest
		await secondRequest

		expect(proxyConfigs).toEqual([
			{ mode: 'system' },
			{ mode: 'fixed_servers', proxyRules: 'http://127.0.0.1:7890' }
		])
		expect(session.closeAllConnections).toHaveBeenCalledTimes(2)
	})

	it('never sends a GitHub token to an untrusted version URL', async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = []
		const session = createSession(requests, [])
		const service = createGitHubNetworkService(createSettingsStore(), () => session)

		await service.fetchText('https://example.test/version.toc', { token: 'secret-token' })
		await service.fetchText('https://raw.githubusercontent.com/owner/repo/main/a.toc', {
			token: 'secret-token'
		})

		expect(new Headers(requests[0].init?.headers).has('authorization')).toBe(false)
		expect(new Headers(requests[1].init?.headers).get('authorization')).toBe(
			'Bearer secret-token'
		)
	})

	it('returns a friendly proxy failure and does not fall back to a direct request', async () => {
		const settingsStore = createSettingsStore({
			githubProxyEnabled: true,
			githubProxyUrl: 'http://127.0.0.1:7890'
		})
		const session = createSession([], [])
		vi.mocked(session.fetch).mockRejectedValue(
			Object.assign(new Error('fetch failed'), { code: 'ERR_PROXY_CONNECTION_FAILED' })
		)
		const service = createGitHubNetworkService(settingsStore, () => session)

		await expect(service.fetchText('https://github.com/owner/repo')).rejects.toMatchObject({
			code: 'GITHUB_PROXY_UNAVAILABLE',
			message: expect.stringContaining('прокси')
		})
		expect(session.fetch).toHaveBeenCalledTimes(1)
	})

	it('aborts a stalled GitHub request with a friendly timeout', async () => {
		const session = createSession([], [])
		vi.mocked(session.fetch).mockImplementation(
			async (_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => {
						reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
					})
				})
		)
		const service = createGitHubNetworkService(createSettingsStore(), () => session)

		await expect(
			service.fetchText('https://github.com/owner/repo', { timeoutMs: 5 })
		).rejects.toMatchObject({
			code: 'GITHUB_TIMEOUT'
		})
	})

	it('keeps the timeout active while reading a stalled response body', async () => {
		const session = createSession([], [])
		vi.mocked(session.fetch).mockImplementation(async (_url, init) => {
			const body = new ReadableStream({
				start(controller) {
					init?.signal?.addEventListener('abort', () => {
						controller.error(
							Object.assign(new Error('aborted'), { name: 'AbortError' })
						)
					})
				}
			})
			return new Response(body)
		})
		const service = createGitHubNetworkService(createSettingsStore(), () => session)

		await expect(
			service.fetchText('https://github.com/owner/repo', { timeoutMs: 5 })
		).rejects.toMatchObject({ code: 'GITHUB_TIMEOUT' })
	})

	it('tests the real addon archive route with a HEAD request', async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = []
		const session = createSession(requests, [])
		const service = createGitHubNetworkService(createSettingsStore(), () => session)

		const result = await service.testConnection()

		expect(result).toMatchObject({ connected: true, usingProxy: false })
		expect(requests[0].url).toContain('/archive/refs/heads/main.zip')
		expect(requests[0].init?.method).toBe('HEAD')
	})

	it('reports an HTML block page instead of trying to parse GitHub data', async () => {
		const session = createSession([], [])
		vi.mocked(session.fetch).mockResolvedValue(
			new Response('<html>blocked</html>', {
				headers: { 'content-type': 'text/html; charset=utf-8' }
			})
		)
		const service = createGitHubNetworkService(createSettingsStore(), () => session)

		await expect(service.fetchJson('https://api.github.com/rate_limit')).rejects.toMatchObject({
			code: 'GITHUB_UNEXPECTED_RESPONSE',
			message: expect.stringContaining('страницу блокировки')
		})
	})

	it('rejects a block page disguised as a GitHub zip archive', async () => {
		const root = await mkdtemp(join(tmpdir(), 'github-network-block-page-'))
		const targetPath = join(root, 'addon.zip')
		const session = createSession([], [])
		vi.mocked(session.fetch).mockResolvedValue(
			new Response('Access blocked', {
				headers: { 'content-type': 'application/octet-stream' }
			})
		)
		const service = createGitHubNetworkService(createSettingsStore(), () => session)

		await expect(
			service.downloadFile(
				'https://github.com/owner/repo/archive/refs/heads/main.zip',
				targetPath
			)
		).rejects.toMatchObject({
			code: 'GITHUB_UNEXPECTED_DOWNLOAD',
			message: expect.stringContaining('страницу блокировки')
		})
	})
})

function createSession(
	requests: Array<{ url: string; init?: RequestInit }>,
	proxyConfigs: GitHubProxyConfig[]
): GitHubFetchSession {
	return {
		setProxy: vi.fn(async (config: GitHubProxyConfig) => {
			proxyConfigs.push(config)
		}),
		closeAllConnections: vi.fn(async () => undefined),
		fetch: vi.fn(async (url: string, init?: RequestInit) => {
			requests.push({ url, init })
			if (init?.method === 'HEAD') {
				return new Response(null, { headers: { 'content-type': 'application/zip' } })
			}
			if (url.includes('api.github.com')) {
				return new Response('{}', { headers: { 'content-type': 'application/json' } })
			}
			return new Response('## Version: 1.0.0')
		})
	}
}

function createSettingsStore(patch: LauncherSettingsPatch = {}): SettingsStore {
	const settings: LauncherSettings = { ...defaultLauncherSettings, ...patch }
	return {
		async get() {
			return { ...settings }
		},
		async save(nextPatch) {
			Object.assign(settings, nextPatch)
			return { ...settings }
		}
	}
}
