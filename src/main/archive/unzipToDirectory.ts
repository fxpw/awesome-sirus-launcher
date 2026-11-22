import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import yauzl, { type Entry, type ZipFile } from 'yauzl'

export async function unzipToDirectory(archivePath: string, targetDir: string): Promise<void> {
	const targetRoot = resolve(targetDir)
	await mkdir(targetRoot, { recursive: true })

	const zip = await openZip(archivePath)

	await new Promise<void>((resolvePromise, reject) => {
		let settled = false

		const fail = (error: unknown): void => {
			if (settled) return
			settled = true
			zip.close()
			reject(error)
		}

		const done = (): void => {
			if (settled) return
			settled = true
			resolvePromise()
		}

		zip.on('entry', (entry) => {
			void handleEntry(zip, entry, targetRoot)
				.then(() => zip.readEntry())
				.catch(fail)
		})
		zip.on('end', done)
		zip.on('error', fail)
		zip.readEntry()
	})
}

async function handleEntry(zip: ZipFile, entry: Entry, targetRoot: string): Promise<void> {
	const targetPath = getSafeEntryPath(targetRoot, entry.fileName)

	if (entry.fileName.endsWith('/')) {
		await mkdir(targetPath, { recursive: true })
		return
	}

	await mkdir(dirname(targetPath), { recursive: true })
	await extractEntry(zip, entry, targetPath)
}

function openZip(archivePath: string): Promise<ZipFile> {
	return new Promise((resolvePromise, reject) => {
		yauzl.open(archivePath, { lazyEntries: true }, (error, zip) => {
			if (error) {
				reject(error)
				return
			}
			if (!zip) {
				reject(new Error('Не удалось открыть zip-архив'))
				return
			}

			resolvePromise(zip)
		})
	})
}

async function extractEntry(zip: ZipFile, entry: Entry, targetPath: string): Promise<void> {
	const readStream = await new Promise<Readable>((resolvePromise, reject) => {
		zip.openReadStream(entry, (error, stream) => {
			if (error) reject(error)
			else if (!stream) reject(new Error('Не удалось прочитать файл из zip-архива'))
			else resolvePromise(stream)
		})
	})

	await pipeline(readStream, createWriteStream(targetPath))
}

function getSafeEntryPath(targetRoot: string, fileName: string): string {
	const normalizedName = fileName.replaceAll('\\', '/')
	if (
		normalizedName.startsWith('/') ||
		isAbsolute(normalizedName) ||
		/^[A-Za-z]:/.test(normalizedName)
	) {
		throw new Error('Небезопасный путь внутри zip-архива')
	}

	const targetPath = resolve(targetRoot, normalizedName)
	if (!isPathInside(targetRoot, targetPath)) {
		throw new Error('Небезопасный путь внутри zip-архива')
	}

	return targetPath
}

function isPathInside(parentPath: string, childPath: string): boolean {
	const relativePath = relative(parentPath, childPath)
	return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}
