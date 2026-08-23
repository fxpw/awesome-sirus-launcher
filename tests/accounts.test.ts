import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createAccountService } from '../src/main/accounts/accountService'
import { createSecretStore } from '../src/main/secrets/memorySecretStore'

describe('account service', () => {
	it('stores account summaries without returning passwords', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-accounts-'))
		const service = createAccountService(() => root, createSecretStore())

		const result = await service.add({ login: 'fxpw', password: 'secret' })

		expect(result.accounts).toHaveLength(1)
		expect(result.accounts[0]).toMatchObject({ login: 'fxpw' })
		expect(JSON.stringify(result)).not.toContain('secret')
		expect(result.selectedAccountId).toBe(result.accounts[0].id)
	})

	it('deletes only the requested account, its password and selected state', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-accounts-delete-'))
		const secretStore = createSecretStore()
		const service = createAccountService(() => root, secretStore)

		const firstResult = await service.add({ login: 'wrong', password: 'wrong-secret' })
		const firstAccount = firstResult.accounts[0]
		const secondResult = await service.add({ login: 'correct', password: 'correct-secret' })
		const secondAccount = secondResult.accounts[1]

		expect(firstAccount).toBeDefined()
		expect(secondAccount).toBeDefined()
		if (!firstAccount || !secondAccount) throw new Error('Тестовые аккаунты не созданы')

		const afterFirstDelete = await service.delete({ accountId: firstAccount.id })

		expect(afterFirstDelete).toEqual({
			accounts: [secondAccount],
			selectedAccountId: secondAccount.id
		})
		expect(await secretStore.has(`account-password:${firstAccount.id}`)).toBe(false)
		expect(await secretStore.has(`account-password:${secondAccount.id}`)).toBe(true)

		const afterSelectedDelete = await service.delete({ accountId: secondAccount.id })

		expect(afterSelectedDelete).toEqual({ accounts: [] })
		expect(await secretStore.has(`account-password:${secondAccount.id}`)).toBe(false)
		expect(JSON.parse(await readFile(join(root, 'accounts.json'), 'utf8'))).toEqual({
			accounts: []
		})
	})

	it('does not change accounts when the deleted id is unknown', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-accounts-delete-missing-'))
		const secretStore = createSecretStore()
		const service = createAccountService(() => root, secretStore)
		const result = await service.add({ login: 'fxpw', password: 'secret' })
		const account = result.accounts[0]

		expect(account).toBeDefined()
		if (!account) throw new Error('Тестовый аккаунт не создан')

		await expect(service.delete({ accountId: 'missing-account' })).rejects.toThrow(
			'Аккаунт не найден'
		)
		expect(await service.list()).toEqual(result)
		expect(await secretStore.has(`account-password:${account.id}`)).toBe(true)
	})

	it('writes selected account credentials to Config.wtf before launch', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-accounts-config-'))
		const wowPath = join(root, 'wow')
		await mkdir(join(wowPath, 'Data'), { recursive: true })
		await mkdir(join(wowPath, 'Interface'), { recursive: true })
		await mkdir(join(wowPath, 'WTF'), { recursive: true })
		await writeFile(join(wowPath, 'run.exe'), '')
		await writeFile(
			join(wowPath, 'WTF', 'Config.wtf'),
			['SET accountName "old"', 'SET readTerminationWithoutNotice "old"'].join('\n'),
			'utf8'
		)

		const service = createAccountService(() => root, createSecretStore())
		await service.add({ login: 'fxpw', password: 'password' })
		await service.applySelectedToWowConfig(wowPath)

		const configText = await readFile(join(wowPath, 'WTF', 'Config.wtf'), 'utf8')
		expect(configText).toContain('SET accountName "fxpw"')
		expect(configText).toContain('SET readTerminationWithoutNotice "password"')
	})
})
