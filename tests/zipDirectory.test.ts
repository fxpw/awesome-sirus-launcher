import { mkdtemp, readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { zipDirectory } from '../src/main/archive/zipDirectory'

describe('zipDirectory', () => {
	it('creates a zip archive from directory contents', async () => {
		const root = await mkdtemp(join(tmpdir(), 'asl-zip-'))
		const source = join(root, 'WTF')
		const nested = join(source, 'Account', 'fxpw')
		const archivePath = join(root, 'wtf-backup.zip')

		await mkdir(nested, { recursive: true })
		await writeFile(join(source, 'Config.wtf'), 'SET accountName "fxpw"', 'utf8')
		await writeFile(join(nested, 'SavedVariables.lua'), 'value = true', 'utf8')

		await zipDirectory(source, archivePath)

		const archiveStat = await stat(archivePath)
		const signature = await readFile(archivePath)

		expect(archiveStat.size).toBeGreaterThan(0)
		expect(signature.subarray(0, 2).toString()).toBe('PK')
	})
})
