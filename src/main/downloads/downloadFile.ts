import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'

const idleTimeoutMs = 30_000

export async function downloadFile(url: string, targetPath: string): Promise<void> {
	const controller = new AbortController()
	let timeout = setTimeout(() => controller.abort(), idleTimeoutMs)
	const refreshTimeout = () => {
		clearTimeout(timeout)
		timeout = setTimeout(() => controller.abort(), idleTimeoutMs)
	}

	try {
		const response = await fetch(url, { signal: controller.signal })
		if (!response.ok || !response.body) {
			throw new Error(`Download failed ${response.status} ${response.statusText}`.trim())
		}
		refreshTimeout()

		await pipeline(
			Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
			new Transform({
				transform(chunk, _encoding, callback) {
					refreshTimeout()
					callback(null, chunk)
				}
			}),
			createWriteStream(targetPath),
			{ signal: controller.signal }
		)
	} catch (error) {
		if (!controller.signal.aborted) throw error
		throw new Error(
			`Источник перестал отдавать данные: за ${idleTimeoutMs / 1000} с не пришло ни одного байта`,
			{ cause: error }
		)
	} finally {
		clearTimeout(timeout)
	}
}
