import { join } from 'node:path'
import { safeStorage } from 'electron'
import { readJsonFile, writeJsonFile } from '@main/files/jsonFile'
import type { SecretStore } from '@main/secrets/memorySecretStore'

type SecretFile = Record<string, string>

export function createElectronSecretStore(getUserDataPath: () => string): SecretStore {
	const getFilePath = () => join(getUserDataPath(), 'secrets.json')

	return {
		async has(key) {
			const data = await readSecrets(getFilePath())
			return typeof data[key] === 'string'
		},
		async get(key) {
			const data = await readSecrets(getFilePath())
			const value = data[key]
			if (typeof value !== 'string') return undefined
			if (!(await safeStorage.isAsyncEncryptionAvailable())) {
				throw new Error('Защищенное хранилище недоступно в этой системе')
			}

			return (await safeStorage.decryptStringAsync(Buffer.from(value, 'base64'))).result
		},
		async set(key, value) {
			if (!(await safeStorage.isAsyncEncryptionAvailable())) {
				throw new Error('Защищенное хранилище недоступно в этой системе')
			}

			const data = await readSecrets(getFilePath())
			data[key] = (await safeStorage.encryptStringAsync(value)).toString('base64')
			await writeJsonFile(getFilePath(), data)
		},
		async delete(key) {
			const data = await readSecrets(getFilePath())
			delete data[key]
			await writeJsonFile(getFilePath(), data)
		}
	}
}

async function readSecrets(filePath: string): Promise<SecretFile> {
	return ((await readJsonFile(filePath)) ?? {}) as SecretFile
}
