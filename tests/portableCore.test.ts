import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

describe('portable core', () => {
	it('does not import Electron APIs', () => {
		const files = listFiles(join(process.cwd(), 'src', 'core')).filter((file) =>
			file.endsWith('.ts')
		)
		const offenders = files.filter((file) =>
			readFileSync(file, 'utf8').includes("from 'electron'")
		)

		expect(offenders).toEqual([])
	})
})

function listFiles(root: string): string[] {
	return readdirSync(root).flatMap((entry) => {
		const path = join(root, entry)
		return statSync(path).isDirectory() ? listFiles(path) : [path]
	})
}
