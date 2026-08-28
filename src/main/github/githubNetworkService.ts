import { createWriteStream } from 'node:fs'
import { open, rm } from 'node:fs/promises'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { GitHubConnectionCheck, LauncherSettings } from '@shared/contracts'
import { LauncherError } from '@shared/errors'
import { createGitHubAuthHeaders, isTrustedGitHubUrl } from '@core/github/githubAuth'
import { createGitHubHttpError, createGitHubNetworkError } from '@core/github/githubErrors'
import type { SettingsStore } from '@main/settings/fileSettingsStore'

export interface GitHubProxyConfig {
	mode: 'system' | 'fixed_servers'
	proxyRules?: string
}

export interface GitHubFetchSession {
	setProxy(config: GitHubProxyConfig): Promise<void>
	closeAllConnections(): Promise<void>
	fetch(input: string, init?: RequestInit): Promise<Response>
}

export interface GitHubRequestOptions {
	headers?: HeadersInit
	method?: string
	signal?: AbortSignal
	timeoutMs?: number
	token?: string
}

export interface GitHubNetworkService {
	fetchJson(url: string, options?: GitHubRequestOptions): Promise<unknown>
	fetchText(url: string, options?: GitHubRequestOptions): Promise<string>
	downloadFile(
		url: string,
		targetPath: string,
		options?: Pick<GitHubRequestOptions, 'token'>
	): Promise<void>
	testConnection(): Promise<GitHubConnectionCheck>
}

const connectionCheckUrl = 'https://github.com/github/gitignore/archive/refs/heads/main.zip'

export function createGitHubNetworkService(
	settingsStore: SettingsStore,
	getSession: () => GitHubFetchSession
): GitHubNetworkService {
	let configuredFingerprint = ''
	let configurationQueue = Promise.resolve()
	let activeRequests = 0
	const idleWaiters: Array<() => void> = []

	async function request<T>(
		url: string,
		options: GitHubRequestOptions,
		readResponse: (
			response: Response,
			context: { usingProxy: boolean; refreshTimeout: () => void }
		) => Promise<T>
	): Promise<T> {
		const acquired = await acquireSession()
		const { networkSession, usingProxy } = acquired

		const controller = new AbortController()
		const timeoutMs = options.timeoutMs ?? 15_000
		let timedOut = false
		const abortFromCaller = () => controller.abort(options.signal?.reason)
		if (options.signal?.aborted) abortFromCaller()
		else options.signal?.addEventListener('abort', abortFromCaller, { once: true })
		const abortOnTimeout = () => {
			timedOut = true
			controller.abort()
		}
		let timeout = setTimeout(abortOnTimeout, timeoutMs)
		const refreshTimeout = () => {
			clearTimeout(timeout)
			timeout = setTimeout(abortOnTimeout, timeoutMs)
		}

		try {
			const headers = new Headers(options.headers)
			if (options.token && isTrustedGitHubUrl(url)) {
				for (const [name, value] of Object.entries(
					createGitHubAuthHeaders(options.token)
				)) {
					headers.set(name, value)
				}
			}

			const response = await networkSession.fetch(url, {
				method: options.method,
				headers,
				signal: controller.signal
			})
			if (!response.ok) throw createGitHubHttpError(response)
			return await readResponse(response, { usingProxy, refreshTimeout })
		} catch (error) {
			const source = timedOut
				? Object.assign(new Error('GitHub request timed out', { cause: error }), {
						name: 'TimeoutError'
					})
				: error
			const classified = createGitHubNetworkError(source, { usingProxy })
			console.warn('[github-network]', classified.code, safeHostname(url))
			throw classified
		} finally {
			clearTimeout(timeout)
			options.signal?.removeEventListener('abort', abortFromCaller)
			acquired.release()
		}
	}

	async function acquireSession(): Promise<{
		networkSession: GitHubFetchSession
		usingProxy: boolean
		release: () => void
	}> {
		let selectedSettings: LauncherSettings | undefined
		const action = configurationQueue.then(async () => {
			const settings = await settingsStore.get()
			selectedSettings = settings
			const fingerprint = settings.githubProxyEnabled
				? `proxy:${settings.githubProxyUrl}`
				: 'system'
			const networkSession = getSession()

			if (fingerprint !== configuredFingerprint) {
				await waitForIdle()
				await networkSession.setProxy(
					settings.githubProxyEnabled
						? { mode: 'fixed_servers', proxyRules: settings.githubProxyUrl }
						: { mode: 'system' }
				)
				await networkSession.closeAllConnections()
				configuredFingerprint = fingerprint
			}

			activeRequests += 1
			let released = false
			return {
				networkSession,
				usingProxy: settings.githubProxyEnabled,
				release: () => {
					if (released) return
					released = true
					activeRequests -= 1
					if (activeRequests !== 0) return
					for (const resolve of idleWaiters.splice(0)) resolve()
				}
			}
		})
		configurationQueue = action.then(
			() => undefined,
			() => undefined
		)

		try {
			return await action
		} catch (error) {
			throw new LauncherError(
				selectedSettings?.githubProxyEnabled
					? 'Не удалось применить настройки прокси для GitHub'
					: 'Не удалось применить системные настройки сети для GitHub',
				'GITHUB_PROXY_CONFIG_FAILED',
				error
			)
		}
	}

	function waitForIdle(): Promise<void> {
		if (activeRequests === 0) return Promise.resolve()
		return new Promise((resolve) => idleWaiters.push(resolve))
	}

	return {
		async fetchJson(url, options) {
			return request(url, options ?? {}, async (response) => {
				assertNotHtmlResponse(response)
				try {
					return await response.json()
				} catch (error) {
					throw new LauncherError(
						'GitHub вернул некорректный ответ вместо данных. Доступ может блокироваться сетью или регионом',
						'GITHUB_UNEXPECTED_RESPONSE',
						error
					)
				}
			})
		},
		async fetchText(url, options) {
			return request(url, options ?? {}, async (response) => {
				assertNotHtmlResponse(response)
				return response.text()
			})
		},
		async downloadFile(url, targetPath, options = {}) {
			return request(
				url,
				{ token: options.token, timeoutMs: 30_000 },
				async (response, context) => {
					if (!response.body) {
						throw new LauncherError(
							'GitHub вернул пустой файл. Повтори попытку позже',
							'GITHUB_EMPTY_DOWNLOAD'
						)
					}
					const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
					if (contentType.includes('text/html')) {
						throw new LauncherError(
							'GitHub вернул веб-страницу вместо файла. Доступ может блокироваться сетью или регионом; попробуй VPN/прокси',
							'GITHUB_UNEXPECTED_DOWNLOAD'
						)
					}

					try {
						const keepAlive = new Transform({
							transform(chunk, _encoding, callback) {
								context.refreshTimeout()
								callback(null, chunk)
							}
						})
						await pipeline(
							Readable.fromWeb(
								response.body as Parameters<typeof Readable.fromWeb>[0]
							),
							keepAlive,
							createWriteStream(targetPath)
						)
						if (isGitHubSourceArchiveUrl(url) && !(await hasZipSignature(targetPath))) {
							await rm(targetPath, { force: true })
							throw new LauncherError(
								'GitHub вернул повреждённый архив или страницу блокировки вместо ZIP. Попробуй VPN/прокси',
								'GITHUB_UNEXPECTED_DOWNLOAD'
							)
						}
					} catch (error) {
						await rm(targetPath, { force: true }).catch(() => undefined)
						if (isFileWriteError(error)) {
							throw new LauncherError(
								'Не удалось сохранить скачанный файл. Проверь свободное место и права доступа',
								'DOWNLOAD_WRITE_FAILED',
								error
							)
						}
						throw error
					}
				}
			)
		},
		async testConnection() {
			const usingProxy = await request(
				connectionCheckUrl,
				{ method: 'HEAD', timeoutMs: 12_000 },
				async (response, context) => {
					const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
					if (!contentType.includes('application/zip')) {
						throw new LauncherError(
							'GitHub вернул страницу-заглушку вместо архива. Доступ может блокироваться сетью или регионом',
							'GITHUB_UNEXPECTED_RESPONSE'
						)
					}
					return context.usingProxy
				}
			)
			return {
				connected: true,
				usingProxy,
				checkedAt: new Date().toISOString()
			}
		}
	}
}

function safeHostname(value: string): string {
	try {
		return new URL(value).hostname
	} catch {
		return 'invalid-url'
	}
}

function assertNotHtmlResponse(response: Response): void {
	const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
	if (!contentType.includes('text/html')) return
	throw new LauncherError(
		'GitHub вернул страницу блокировки или авторизации вместо данных. Попробуй VPN/прокси',
		'GITHUB_UNEXPECTED_RESPONSE'
	)
}

function isFileWriteError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false
	const code = (error as Record<string, unknown>).code
	return typeof code === 'string' && ['EACCES', 'EDQUOT', 'ENOSPC', 'EPERM'].includes(code)
}

function isGitHubSourceArchiveUrl(value: string): boolean {
	try {
		const url = new URL(value)
		return url.hostname.toLowerCase() === 'github.com' && url.pathname.endsWith('.zip')
	} catch {
		return false
	}
}

async function hasZipSignature(filePath: string): Promise<boolean> {
	const handle = await open(filePath, 'r')
	try {
		const signature = Buffer.alloc(4)
		const { bytesRead } = await handle.read(signature, 0, signature.length, 0)
		if (bytesRead !== signature.length) return false
		return (
			signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
			signature.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
			signature.equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
		)
	} finally {
		await handle.close()
	}
}
