import { join, normalize, resolve, isAbsolute, relative } from 'node:path'

export const clientPatchManifestUrls = [
	'https://s-patches.pro/api/client/patches',
	'https://s-patches.ru/api/client/patches',
	'https://sirus.world/api/client/patches'
] as const

export interface ClientPatchManifestFile {
	fileName: string
	relativePath: string
	size: number
	md5: string
	downloadUrl: string
	updatedAt?: string
}

export type ClientPatchFileStatus = 'ok' | 'missing' | 'outdated'

export interface ClientPatchFileCheck {
	fileName: string
	relativePath: string
	targetPath: string
	expectedMd5: string
	actualMd5?: string
	expectedSize: number
	actualSize?: number
	downloadUrl: string
	status: ClientPatchFileStatus
}

export function normalizeClientPatchManifest(raw: unknown): ClientPatchManifestFile[] {
	const items = Array.isArray(raw) ? raw : getRecordArray(raw, 'patches')

	return items.map(normalizeClientPatchFile)
}

export function createClientPatchTargetPath(
	wowPath: string,
	patch: ClientPatchManifestFile
): string {
	const root = normalize(resolve(wowPath))
	const safeRelativePath = createSafeRelativePatchPath(patch.relativePath, patch.fileName)
	const targetPath = normalize(resolve(root, safeRelativePath))

	if (!isPathInside(root, targetPath)) {
		throw new Error('Небезопасный путь файла клиента')
	}

	return targetPath
}

export function isExpectedMd5(actualMd5: string, expectedMd5: string): boolean {
	return actualMd5.toLowerCase() === expectedMd5.toLowerCase()
}

function normalizeClientPatchFile(raw: unknown): ClientPatchManifestFile {
	if (!raw || typeof raw !== 'object') throw new Error('Некорректный файл manifest клиента')
	const record = raw as Record<string, unknown>
	const fileName = readString(record, 'filename')
	const relativePath = readString(record, 'path')
	const md5 = readString(record, 'md5').toLowerCase()
	const size = readNumber(record, 'size')
	const downloadUrl = readString(record, 'host')
	const updatedAt = typeof record.updated_at === 'string' ? record.updated_at : undefined

	if (!/^[a-f0-9]{32}$/.test(md5)) throw new Error(`Некорректный MD5 для ${fileName}`)

	return {
		fileName,
		relativePath,
		size,
		md5,
		downloadUrl,
		updatedAt
	}
}

function createSafeRelativePatchPath(relativePath: string, fileName: string): string {
	const cleanedPath = relativePath.replaceAll('\\', '/').replace(/^\/+/, '')
	const cleanedFileName = fileName.replaceAll('\\', '/')
	const parts = [...cleanedPath.split('/'), ...cleanedFileName.split('/')].filter(Boolean)

	if (parts.length === 0 || parts.some((part) => part === '..' || /^[A-Za-z]:/.test(part))) {
		throw new Error('Небезопасный путь файла клиента')
	}

	const candidate = join(...parts)
	if (isAbsolute(candidate)) throw new Error('Небезопасный путь файла клиента')

	return candidate
}

function getRecordArray(raw: unknown, key: string): unknown[] {
	if (!raw || typeof raw !== 'object') throw new Error('Некорректный manifest клиента')
	const value = (raw as Record<string, unknown>)[key]
	if (!Array.isArray(value)) throw new Error('Manifest клиента не содержит patches')

	return value
}

function readString(record: Record<string, unknown>, key: string): string {
	const value = record[key]
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`Manifest клиента содержит некорректное поле ${key}`)
	}

	return value
}

function readNumber(record: Record<string, unknown>, key: string): number {
	const value = record[key]
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		throw new Error(`Manifest клиента содержит некорректное поле ${key}`)
	}

	return value
}

function isPathInside(parentPath: string, childPath: string): boolean {
	const relativePath = relative(parentPath, childPath)
	return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}
