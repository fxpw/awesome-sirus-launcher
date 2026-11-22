import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadFile } from '../src/main/downloads/downloadFile'

const stalledMessage = /Источник перестал отдавать данные/

function track(promise: Promise<void>): { settled: () => boolean; result: Promise<void> } {
	let settled = false
	const result = promise.finally(() => {
		settled = true
	})
	result.catch(() => undefined)
	return { settled: () => settled, result }
}

describe('download file', () => {
	let root: string

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), 'sirus-download-'))
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
	})

	it('aborts a download whose body stops sending data', async () => {
		vi.stubGlobal('fetch', async () => {
			return new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array([1, 2, 3]))
					}
				})
			)
		})

		const download = track(downloadFile('https://example.test/file', join(root, 'file.tmp')))
		await vi.advanceTimersByTimeAsync(29_000)
		expect(download.settled()).toBe(false)

		await vi.advanceTimersByTimeAsync(2_000)
		await expect(download.result).rejects.toThrow(stalledMessage)
	})

	it('aborts a request that sends no response headers', async () => {
		vi.stubGlobal(
			'fetch',
			(_url: string, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
				})
		)

		const download = track(downloadFile('https://example.test/file', join(root, 'file.tmp')))
		await vi.advanceTimersByTimeAsync(30_000)
		await expect(download.result).rejects.toThrow(stalledMessage)
	})

	it('keeps a slow download alive while chunks keep arriving', async () => {
		let sent = 0
		vi.stubGlobal('fetch', async () => {
			return new Response(
				new ReadableStream({
					async pull(controller) {
						await new Promise((resolve) => setTimeout(resolve, 20_000))
						if (sent === 5) {
							controller.close()
							return
						}
						sent += 1
						controller.enqueue(new Uint8Array([sent]))
					}
				})
			)
		})

		const targetPath = join(root, 'file.tmp')
		const download = track(downloadFile('https://example.test/file', targetPath))
		await vi.advanceTimersByTimeAsync(120_000)
		await expect(download.result).resolves.toBeUndefined()
		expect(sent).toBe(5)
		expect([...(await readFile(targetPath))]).toEqual([1, 2, 3, 4, 5])
	})
})
