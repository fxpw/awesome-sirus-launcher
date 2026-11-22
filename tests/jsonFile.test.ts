import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readJsonFile, writeJsonFile } from '../src/main/files/jsonFile'

describe('json file', () => {
	it('returns undefined for a missing file and replaces the file without leaving a temp copy', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-json-file-'))
		const filePath = join(root, 'nested', 'settings.json')

		await expect(readJsonFile(filePath)).resolves.toBeUndefined()

		await writeJsonFile(filePath, { value: 1 })
		await writeJsonFile(filePath, { value: 2 })

		await expect(readJsonFile(filePath)).resolves.toEqual({ value: 2 })
		await expect(readdir(join(root, 'nested'))).resolves.toEqual(['settings.json'])
	})
})
