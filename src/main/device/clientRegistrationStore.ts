import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ClientRegistrationRecord } from '@core/device/clientRegistration'
import { isRecord } from '@core/isRecord'
import { readJsonFile, writeJsonFile } from '@main/files/jsonFile'

export interface ClientRegistrationStore {
	get(): Promise<ClientRegistrationRecord | null>
	save(record: ClientRegistrationRecord): Promise<void>
}

export function createClientRegistrationStore(
	getUserDataPath: () => string
): ClientRegistrationStore {
	const getFilePath = () => join(getUserDataPath(), 'client-registration.json')

	return {
		async get() {
			const filePath = getFilePath()
			const raw = await readJsonFile(filePath).catch(() => null)
			if (raw !== undefined) return toRecord(raw)

			const migrated = await readOfficialLauncherRegistration()
			if (migrated) {
				await writeJsonFile(filePath, migrated)
				return migrated
			}

			return null
		},
		async save(record) {
			await writeJsonFile(getFilePath(), record)
		}
	}
}

function toRecord(raw: unknown): ClientRegistrationRecord | null {
	if (!isRecord(raw) || typeof raw.registered !== 'string' || raw.registered.length === 0) {
		return null
	}
	return { registered: raw.registered }
}

async function readOfficialLauncherRegistration(): Promise<ClientRegistrationRecord | null> {
	const storePath = join(homedir(), 'AppData', 'Roaming', 'sirus-launcher-v2', 'store.json')
	const raw = await readJsonFile(storePath).catch(() => undefined)

	return toRecord(isRecord(raw) ? raw.app : undefined)
}
