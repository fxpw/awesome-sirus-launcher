import { describe, expect, it } from 'vitest'
import {
	applyMiningConfigPatch,
	defaultMiningConfig,
	splitMiningArguments,
	validateMiningStart
} from '../src/core/mining/mining'

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
