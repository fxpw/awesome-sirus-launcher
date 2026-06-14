import { dirname, join } from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { safeStorage } from 'electron'
import type { SecretStore } from './memorySecretStore'

type SecretFile = Record<string, string>

export function createElectronSecretStore(getUserDataPath: () => string): SecretStore {
  const getFilePath = () => join(getUserDataPath(), 'secrets.json')

  return {
    async has(key) {
      const data = await readSecrets(getFilePath())
      return typeof data[key] === 'string'
    },
    async set(key, value) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Защищенное хранилище недоступно в этой системе')
      }

      const data = await readSecrets(getFilePath())
      data[key] = safeStorage.encryptString(value).toString('base64')
      await writeSecrets(getFilePath(), data)
    },
    async delete(key) {
      const data = await readSecrets(getFilePath())
      delete data[key]
      await writeSecrets(getFilePath(), data)
    }
  }
}

async function readSecrets(filePath: string): Promise<SecretFile> {
  if (!existsSync(filePath)) return {}

  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as SecretFile
}

async function writeSecrets(filePath: string, data: SecretFile): Promise<void> {
  const tempPath = `${filePath}.tmp`
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8')
  await rename(tempPath, filePath)
}
