import { createReadStream, type ReadStream } from 'node:fs'
import { createHash } from 'node:crypto'

export function md5File(filePath: string, options: { signal?: AbortSignal } = {}): Promise<string> {
	return new Promise((resolve, reject) => {
		if (options.signal?.aborted) {
			reject(new Error('Проверка клиента остановлена'))
			return
		}

		const hash = createHash('md5')
		const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 })
		const abort = () => destroyStreamAsCancelled(stream)

		options.signal?.addEventListener('abort', abort, { once: true })

		stream.on('data', (chunk) => hash.update(chunk))
		stream.on('error', reject)
		stream.on('end', () => resolve(hash.digest('hex')))
		stream.on('close', () => options.signal?.removeEventListener('abort', abort))
	})
}

function destroyStreamAsCancelled(stream: ReadStream): void {
	stream.destroy(new Error('Проверка клиента остановлена'))
}
