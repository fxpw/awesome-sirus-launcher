import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AddCustomAddonInput, AddonCatalogEntry } from '@shared/contracts'

export function parseGitHubRepoUrl(url: string): string {
	const match = url.trim().match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?[/?#\s]*$/i)
	if (!match) throw new Error('GitHub ссылка должна вести на репозиторий')

	return `${match[1]}/${match[2].replace(/\.git$/i, '')}`
}

export function createCustomAddonEntry(
	input: AddCustomAddonInput,
	index: number
): AddonCatalogEntry {
	const repo = parseGitHubRepoUrl(input.githubUrl)
	const branch = input.branch?.trim() || 'main'
	const folders = input.folders?.map((folder) => folder.trim()).filter(Boolean)

	return {
		id: `custom:${slugify(input.name)}:${index}`,
		source: 'custom',
		name: input.name.trim(),
		versionUrl: normalizeOptional(input.versionUrl),
		versionFolder: normalizeOptional(input.versionFolder),
		versionFile: normalizeOptional(input.versionFile),
		branch,
		folders: folders ?? [],
		description: normalizeOptional(input.description),
		githubUrl: input.githubUrl.trim(),
		repo
	}
}

export function parseTocVersion(tocText: string): string | undefined {
	const line = tocText
		.split(/\r?\n/)
		.find((item) => /^##\s*(?:version|x-version|interface-version)\s*:/i.test(item.trim()))

	if (!line) return undefined

	const [, value] = line.split(/:(.*)/s)
	return value?.trim() || undefined
}

export function compareAddonVersions(installedVersion: string, remoteVersion: string): number {
	const installed = installedVersion.trim()
	const remote = remoteVersion.trim()
	if (installed === remote) return 0

	const installedSemver = parseSemver(installed)
	const remoteSemver = parseSemver(remote)
	if (installedSemver && remoteSemver) return compareVersionParts(installedSemver, remoteSemver)

	const installedDotted = parseDottedNumeric(installed)
	const remoteDotted = parseDottedNumeric(remote)
	if (installedDotted && remoteDotted) return compareVersionParts(installedDotted, remoteDotted)

	const installedNumber = parsePlainNumber(installed)
	const remoteNumber = parsePlainNumber(remote)
	if (installedNumber !== undefined && remoteNumber !== undefined) {
		return Math.sign(installedNumber - remoteNumber)
	}

	return installed === remote ? 0 : -1
}

export async function readInstalledAddonVersion(addonDir: string): Promise<string | undefined> {
	const addonName = addonDir.split(/[\\/]/).pop()
	if (!addonName) return undefined

	const tocPath = join(addonDir, `${addonName}.toc`)
	if (existsSync(tocPath)) {
		return parseTocVersion(await readFile(tocPath, 'utf8'))
	}

	const files = await readdir(addonDir)
	const tocFile = files.find((file) => file.toLowerCase().endsWith('.toc'))
	if (!tocFile) return undefined

	return parseTocVersion(await readFile(join(addonDir, tocFile), 'utf8'))
}

export function hasGitFolder(addonDir: string): boolean {
	return existsSync(join(addonDir, '.git'))
}

function normalizeOptional(value?: string): string | undefined {
	const text = value?.trim()
	return text ? text : undefined
}

function parseSemver(value: string): number[] | undefined {
	const match = value.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9a-z.-]+)?$/i)
	if (!match) return undefined

	return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function parseDottedNumeric(value: string): number[] | undefined {
	if (!/^\d+(?:\.\d+)+$/.test(value)) return undefined

	return value.split('.').map(Number)
}

function parsePlainNumber(value: string): number | undefined {
	if (!/^\d+$/.test(value)) return undefined

	return Number(value)
}

function compareVersionParts(installedParts: number[], remoteParts: number[]): number {
	const maxLength = Math.max(installedParts.length, remoteParts.length)
	for (let index = 0; index < maxLength; index += 1) {
		const installed = installedParts[index] ?? 0
		const remote = remoteParts[index] ?? 0
		if (installed !== remote) return Math.sign(installed - remote)
	}

	return 0
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9а-яё!_-]+/gi, '-')
		.replace(/^-+|-+$/g, '')
}
