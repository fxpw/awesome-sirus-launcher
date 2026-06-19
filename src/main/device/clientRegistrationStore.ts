import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ClientRegistrationRecord } from '@core/device/clientRegistration'

export interface ClientRegistrationStore {
	get(): Promise<ClientRegistrationRecord | null>
	save(record: ClientRegistrationRecord): Promise<void>
}

export function createClientRegistrationStore(getUserDataPath: () => string): ClientRegistrationStore {
	const getFilePath = () => join(getUserDataPath(), 'client-registration.json')

	return {
		async get() {
			const filePath = getFilePath()
			if (existsSync(filePath)) {
				return readRecord(filePath)
			}

			const migrated = await readOfficialLauncherRegistration()
			if (migrated) {
				await writeRecord(filePath, migrated)
				return migrated
			}

			return null
		},
		async save(record) {
			await writeRecord(getFilePath(), record)
		}
	}
}

async function readRecord(filePath: string): Promise<ClientRegistrationRecord | null> {
	try {
		const raw = JSON.parse(await readFile(filePath, 'utf8')) as Partial<ClientRegistrationRecord>
		if (typeof raw.registered !== 'string' || raw.registered.length === 0) return null
		return { registered: raw.registered }
	} catch {
		return null
	}
}

async function writeRecord(filePath: string, record: ClientRegistrationRecord): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true })
	const tempPath = `${filePath}.tmp`
	await writeFile(tempPath, JSON.stringify(record, null, 2), 'utf8')
	await rename(tempPath, filePath)
}

async function readOfficialLauncherRegistration(): Promise<ClientRegistrationRecord | null> {
	const storePath = join(homedir(), 'AppData', 'Roaming', 'sirus-launcher-v2', 'store.json')
	if (!existsSync(storePath)) return null

	try {
		const raw = JSON.parse(await readFile(storePath, 'utf8')) as {
			app?: { registered?: string }
		}
		const registered = raw.app?.registered
		if (typeof registered !== 'string' || registered.length === 0) return null
		return { registered }
	} catch {
		return null
	}
}
