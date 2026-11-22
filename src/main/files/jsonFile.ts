import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export async function readJsonFile(filePath: string): Promise<unknown> {
	if (!existsSync(filePath)) return undefined

	const text = await readFile(filePath, 'utf8')
	try {
		return JSON.parse(text)
	} catch {
		const corruptPath = `${filePath}.${new Date().toISOString().replaceAll(':', '-')}.corrupt`
		await rename(filePath, corruptPath)
		console.warn(
			`[files] ${basename(filePath)} не разобран как JSON, перенесён в ${basename(corruptPath)}`
		)
		return undefined
	}
}

const pendingWrites = new Map<string, Promise<void>>()

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
	const text = JSON.stringify(value, null, 2)
	const key = resolve(filePath)
	const write = (pendingWrites.get(key) ?? Promise.resolve())
		.catch(() => undefined)
		.then(() => replaceFile(filePath, text))
	pendingWrites.set(key, write)
	try {
		await write
	} finally {
		if (pendingWrites.get(key) === write) pendingWrites.delete(key)
	}
}

async function replaceFile(filePath: string, text: string): Promise<void> {
	const tempPath = `${filePath}.${randomUUID()}.tmp`
	await mkdir(dirname(filePath), { recursive: true })
	try {
		await writeFile(tempPath, text, 'utf8')
		await renameWhenReleased(tempPath, filePath)
	} catch (error) {
		await rm(tempPath, { force: true })
		throw error
	}
}

const lockedFileErrorCodes = ['EPERM', 'EACCES', 'EBUSY']

async function renameWhenReleased(sourcePath: string, targetPath: string): Promise<void> {
	for (let attempt = 1; ; attempt += 1) {
		try {
			await rename(sourcePath, targetPath)
			return
		} catch (error) {
			const code = (error as NodeJS.ErrnoException | undefined)?.code
			if (attempt === 10 || !code || !lockedFileErrorCodes.includes(code)) throw error
			await delay(attempt * 20)
		}
	}
}
