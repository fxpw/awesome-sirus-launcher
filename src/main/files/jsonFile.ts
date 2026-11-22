import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function readJsonFile(filePath: string): Promise<unknown> {
	if (!existsSync(filePath)) return undefined

	return JSON.parse(await readFile(filePath, 'utf8'))
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
	const tempPath = `${filePath}.tmp`
	await mkdir(dirname(filePath), { recursive: true })
	await writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8')
	await rename(tempPath, filePath)
}
