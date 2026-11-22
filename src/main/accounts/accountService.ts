import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import type {
	AccountListResult,
	AccountSummary,
	AddAccountInput,
	DeleteAccountInput,
	SelectAccountInput
} from '@shared/contracts'
import { updateAccountConfigText } from '@core/accounts/configWtf'
import { validateWowPath } from '@core/wow/wowPaths'
import { readJsonFile, writeJsonFile } from '@main/files/jsonFile'
import type { SecretStore } from '@main/secrets/memorySecretStore'

interface AccountRecord {
	id: string
	login: string
}

interface AccountFile {
	selectedAccountId?: string
	accounts: AccountRecord[]
}

export interface AccountService {
	list(): Promise<AccountListResult>
	add(input: AddAccountInput): Promise<AccountListResult>
	select(input: SelectAccountInput): Promise<AccountListResult>
	delete(input: DeleteAccountInput): Promise<AccountListResult>
	applySelectedToWowConfig(wowPath: string): Promise<void>
}

export function createAccountService(
	getUserDataPath: () => string,
	secretStore: SecretStore
): AccountService {
	const getFilePath = () => join(getUserDataPath(), 'accounts.json')

	return {
		async list() {
			return toListResult(await readAccounts(getFilePath()))
		},
		async add(input) {
			const data = await readAccounts(getFilePath())
			const account: AccountRecord = {
				id: randomUUID(),
				login: input.login.trim()
			}

			if (!account.login) throw new Error('Логин аккаунта пустой')

			data.accounts.push(account)
			data.selectedAccountId = account.id
			await secretStore.set(createAccountPasswordKey(account.id), input.password)
			await writeJsonFile(getFilePath(), data)

			return toListResult(data)
		},
		async select(input) {
			const data = await readAccounts(getFilePath())
			if (!data.accounts.some((account) => account.id === input.accountId)) {
				throw new Error('Аккаунт не найден')
			}

			data.selectedAccountId = input.accountId
			await writeJsonFile(getFilePath(), data)

			return toListResult(data)
		},
		async delete(input) {
			const data = await readAccounts(getFilePath())
			const account = data.accounts.find((item) => item.id === input.accountId)
			if (!account) throw new Error('Аккаунт не найден')

			await secretStore.delete(createAccountPasswordKey(account.id))
			data.accounts = data.accounts.filter((item) => item.id !== account.id)
			if (data.selectedAccountId === account.id) delete data.selectedAccountId
			await writeJsonFile(getFilePath(), data)

			return toListResult(data)
		},
		async applySelectedToWowConfig(wowPath) {
			const data = await readAccounts(getFilePath())
			if (!data.selectedAccountId) return

			const account = data.accounts.find((item) => item.id === data.selectedAccountId)
			if (!account) return

			const password = await secretStore.get(createAccountPasswordKey(account.id))
			if (!password) throw new Error('Пароль выбранного аккаунта не найден')

			const validation = validateWowPath(wowPath)
			if (!validation.valid) {
				throw new Error(`Клиент WoW не готов: ${validation.missing.join(', ')}`)
			}

			const configText = existsSync(validation.configWtfPath)
				? await readFile(validation.configWtfPath, 'utf8')
				: ''
			const preview = updateAccountConfigText(configText, {
				login: account.login,
				password
			})
			if (!preview.changed) return

			await mkdir(dirname(validation.configWtfPath), { recursive: true })
			if (existsSync(validation.configWtfPath)) {
				await copyFile(
					validation.configWtfPath,
					`${validation.configWtfPath}.${new Date().toISOString().replaceAll(':', '-')}.bak`
				)
			}
			await writeFile(validation.configWtfPath, preview.text, 'utf8')
		}
	}
}

async function readAccounts(filePath: string): Promise<AccountFile> {
	const data = (await readJsonFile(filePath)) as AccountFile | undefined
	if (data === undefined) return { accounts: [] }

	return {
		selectedAccountId: data.selectedAccountId,
		accounts: Array.isArray(data.accounts) ? data.accounts : []
	}
}

function toListResult(data: AccountFile): AccountListResult {
	const accounts: AccountSummary[] = data.accounts.map((account) => ({
		id: account.id,
		login: account.login
	}))
	const selectedAccountId = accounts.some((account) => account.id === data.selectedAccountId)
		? data.selectedAccountId
		: undefined

	return {
		accounts,
		selectedAccountId
	}
}

function createAccountPasswordKey(accountId: string): string {
	return `account-password:${accountId}`
}
