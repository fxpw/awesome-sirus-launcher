import { describe, expect, it } from 'vitest'
import { translate } from '../src/renderer/shared/i18n'

describe('renderer i18n', () => {
	it('translates messages by locale', () => {
		expect(translate('ru', 'wow.save')).toBe('Сохранить')
		expect(translate('en', 'wow.save')).toBe('Save')
	})

	it('interpolates params', () => {
		expect(translate('en', 'app.versionToken', { name: 'Launcher', version: '1.2.3' })).toBe(
			'Launcher 1.2.3'
		)
	})
})
