import { stat } from 'node:fs/promises'
import type { ClientCheckResult } from '@shared/contracts'
import type { SettingsStore } from '@main/settings/fileSettingsStore'
import {
	clientPatchManifestUrls,
	createClientPatchTargetPath,
	isExpectedMd5,
	normalizeClientPatchManifest
} from '../../core/clientPatches/clientPatches'

export type FetchJson = (url: string) => Promise<unknown>
export type HashFile = (filePath: string) => Promise<string>

export interface ClientPatchService {
	check(): Promise<ClientCheckResult>
}

export function createClientPatchService(
	settingsStore: SettingsStore,
	fetchJson: FetchJson,
	hashFile: HashFile
): ClientPatchService {
	return {
		async check() {
			const settings = await settingsStore.get()
			if (!settings.wowPath) throw new Error('Сначала выберите папку WoW')

			const manifest = await fetchManifestWithFallback(fetchJson)
			const files = await Promise.all(
				manifest.patches.map(async (patch) => {
					const targetPath = createClientPatchTargetPath(settings.wowPath, patch)

					try {
						const fileStat = await stat(targetPath)
						const actualSize = fileStat.size
						if (!fileStat.isFile() || actualSize !== patch.size) {
							return {
								fileName: patch.fileName,
								relativePath: patch.relativePath,
								targetPath,
								expectedMd5: patch.md5,
								expectedSize: patch.size,
								actualSize,
								downloadUrl: patch.downloadUrl,
								status: 'outdated' as const
							}
						}

						const actualMd5 = await hashFile(targetPath)

						return {
							fileName: patch.fileName,
							relativePath: patch.relativePath,
							targetPath,
							expectedMd5: patch.md5,
							actualMd5,
							expectedSize: patch.size,
							actualSize,
							downloadUrl: patch.downloadUrl,
							status: isExpectedMd5(actualMd5, patch.md5)
								? ('ok' as const)
								: ('outdated' as const)
						}
					} catch {
						return {
							fileName: patch.fileName,
							relativePath: patch.relativePath,
							targetPath,
							expectedMd5: patch.md5,
							expectedSize: patch.size,
							downloadUrl: patch.downloadUrl,
							status: 'missing' as const
						}
					}
				})
			)

			const ok = files.filter((file) => file.status === 'ok').length
			const missing = files.filter((file) => file.status === 'missing').length
			const outdated = files.filter((file) => file.status === 'outdated').length

			return {
				checkedAt: new Date().toISOString(),
				sourceUrl: manifest.sourceUrl,
				total: files.length,
				ok,
				missing,
				outdated,
				files
			}
		}
	}
}

async function fetchManifestWithFallback(fetchJson: FetchJson) {
	const errors: string[] = []

	for (const sourceUrl of clientPatchManifestUrls) {
		try {
			const raw = await fetchJson(sourceUrl)
			return {
				sourceUrl,
				patches: normalizeClientPatchManifest(raw)
			}
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error))
		}
	}

	throw new Error(`Не удалось получить manifest клиента: ${errors.join('; ')}`)
}
