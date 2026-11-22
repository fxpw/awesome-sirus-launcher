import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
	applyMiningConfigPatch,
	defaultMiningConfig,
	splitMiningArguments,
	validateMiningStart
} from '../src/core/mining/mining'
import { createMiningService } from '../src/main/mining/miningService'

describe('mining core', () => {
	it('requires explicit consent and visible arguments before start', () => {
		expect(() => validateMiningStart(defaultMiningConfig)).toThrow(
			'Нужно явно согласиться на запуск майнинга'
		)

		const withoutArgs = applyMiningConfigPatch(defaultMiningConfig, {
			consentAccepted: true,
			minerPath: 'C:/miners/miner.exe'
		})

		expect(() => validateMiningStart(withoutArgs)).toThrow(
			'Укажи видимые аргументы запуска майнера'
		)
	})

	it('splits miner arguments without invoking a shell', () => {
		expect(splitMiningArguments('--algo kawpow --server "pool.example:3333" --pass x')).toEqual(
			['--algo', 'kawpow', '--server', 'pool.example:3333', '--pass', 'x']
		)
	})
})

describe('mining service', () => {
	it('counts every accepted share when miner output arrives in a burst', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-mining-burst-'))
		const minerPath = join(root, 'miner.exe')
		await writeFile(minerPath, '')
		await writeFile(
			join(root, 'mining.json'),
			JSON.stringify({
				config: { consentAccepted: true, minerPath, arguments: '--algo test' },
				acceptedSharesTotal: 5,
				receivedTotal: 7
			})
		)

		let emitOutput: (text: string) => void = () => undefined
		const service = createMiningService(() => root, {
			start(_executablePath, _args, onOutput) {
				emitOutput = onOutput
				return { stop() {}, onExit() {} }
			}
		})
		await service.start()

		for (let index = 0; index < 20; index += 1) emitOutput('share accepted')

		await vi.waitFor(async () => {
			expect((await service.getState()).acceptedSharesTotal).toBe(25)
		})
		const state = await service.getState()
		expect(state.acceptedSharesSession).toBe(20)
		expect(state).not.toHaveProperty('receivedTotal')
		expect(await readdir(root)).toEqual(['miner.exe', 'mining.json'])
		expect(JSON.parse(await readFile(join(root, 'mining.json'), 'utf8'))).toEqual({
			config: expect.objectContaining({ minerPath }),
			acceptedSharesTotal: 25
		})
	})
})
