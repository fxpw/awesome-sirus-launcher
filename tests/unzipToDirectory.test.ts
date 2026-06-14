import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { unzipToDirectory } from '../src/main/archive/unzipToDirectory'
import { zipDirectory } from '../src/main/archive/zipDirectory'

describe('unzipToDirectory', () => {
	it('extracts a zip archive into target directory', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-unzip-'))
		const sourceDir = join(root, 'source')
		const targetDir = join(root, 'target')
		const archivePath = join(root, 'backup.zip')

		await mkdir(join(sourceDir, 'Account', 'Demo'), { recursive: true })
		await writeFile(join(sourceDir, 'Account', 'Demo', 'SavedVariables.lua'), 'value = true')
		await zipDirectory(sourceDir, archivePath)

		await unzipToDirectory(archivePath, targetDir)

		await expect(
			readFile(join(targetDir, 'Account', 'Demo', 'SavedVariables.lua'), 'utf8')
		).resolves.toBe('value = true')
	})

	it('rejects zip entries outside target directory', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-zip-slip-'))
		const archivePath = join(root, 'unsafe.zip')
		const targetDir = join(root, 'target')

		await createUnsafeZip(archivePath)

		await expect(unzipToDirectory(archivePath, targetDir)).rejects.toThrow(
			/Небезопасный путь внутри zip-архива|invalid relative path/
		)
	})
})

async function createUnsafeZip(archivePath: string): Promise<void> {
	const fileName = Buffer.from('..\\evil.txt')
	const content = Buffer.from('nope')
	const crc = crc32(content)
	const localHeader = Buffer.alloc(30)
	localHeader.writeUInt32LE(0x04034b50, 0)
	localHeader.writeUInt16LE(20, 4)
	localHeader.writeUInt16LE(0, 6)
	localHeader.writeUInt16LE(0, 8)
	localHeader.writeUInt16LE(0, 10)
	localHeader.writeUInt16LE(0, 12)
	localHeader.writeUInt32LE(crc, 14)
	localHeader.writeUInt32LE(content.length, 18)
	localHeader.writeUInt32LE(content.length, 22)
	localHeader.writeUInt16LE(fileName.length, 26)
	localHeader.writeUInt16LE(0, 28)

	const centralHeader = Buffer.alloc(46)
	centralHeader.writeUInt32LE(0x02014b50, 0)
	centralHeader.writeUInt16LE(20, 4)
	centralHeader.writeUInt16LE(20, 6)
	centralHeader.writeUInt16LE(0, 8)
	centralHeader.writeUInt16LE(0, 10)
	centralHeader.writeUInt16LE(0, 12)
	centralHeader.writeUInt16LE(0, 14)
	centralHeader.writeUInt32LE(crc, 16)
	centralHeader.writeUInt32LE(content.length, 20)
	centralHeader.writeUInt32LE(content.length, 24)
	centralHeader.writeUInt16LE(fileName.length, 28)
	centralHeader.writeUInt16LE(0, 30)
	centralHeader.writeUInt16LE(0, 32)
	centralHeader.writeUInt16LE(0, 34)
	centralHeader.writeUInt16LE(0, 36)
	centralHeader.writeUInt32LE(0, 38)
	centralHeader.writeUInt32LE(0, 42)

	const centralDirectory = Buffer.concat([centralHeader, fileName])
	const centralOffset = localHeader.length + fileName.length + content.length
	const end = Buffer.alloc(22)
	end.writeUInt32LE(0x06054b50, 0)
	end.writeUInt16LE(0, 4)
	end.writeUInt16LE(0, 6)
	end.writeUInt16LE(1, 8)
	end.writeUInt16LE(1, 10)
	end.writeUInt32LE(centralDirectory.length, 12)
	end.writeUInt32LE(centralOffset, 16)
	end.writeUInt16LE(0, 20)

	await writeFile(
		archivePath,
		Buffer.concat([localHeader, fileName, content, centralDirectory, end])
	)
}

function crc32(buffer: Buffer): number {
	let crc = 0xffffffff

	for (const byte of buffer) {
		crc ^= byte
		for (let index = 0; index < 8; index += 1) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
		}
	}

	return (crc ^ 0xffffffff) >>> 0
}
