import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'

export function md5File(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = createHash('md5')
		const stream = createReadStream(filePath)

		stream.on('data', (chunk) => hash.update(chunk))
		stream.on('error', reject)
		stream.on('end', () => resolve(hash.digest('hex')))
	})
}
