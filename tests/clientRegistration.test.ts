import { mkdtemp, readFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createClientRegistrationStore } from '../src/main/device/clientRegistrationStore'

describe('client registration store', () => {
	it('imports registered uuid from official sirus-launcher-v2 store when available', async () => {
		const officialStorePath = join(
			homedir(),
			'AppData',
			'Roaming',
			'sirus-launcher-v2',
			'store.json'
		)

		let officialRegistered: string | undefined
		try {
			const official = JSON.parse(await readFile(officialStorePath, 'utf8')) as {
				app?: { registered?: string }
			}
			officialRegistered = official.app?.registered
		} catch {
			return
		}
		if (!officialRegistered) return

		const root = await mkdtemp(join(tmpdir(), 'sirus-client-reg-'))
		const store = createClientRegistrationStore(() => root)
		const record = await store.get()

		expect(record).toEqual({ registered: officialRegistered })
		const persisted = JSON.parse(await readFile(join(root, 'client-registration.json'), 'utf8'))
		expect(persisted.registered).toBe(officialRegistered)
	})

	it('persists registered uuid in userData', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-client-reg-save-'))
		const store = createClientRegistrationStore(() => root)

		await store.save({ registered: 'abc123' })

		expect(await store.get()).toEqual({ registered: 'abc123' })
	})
})
