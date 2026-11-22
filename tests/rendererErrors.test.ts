import { describe, expect, it } from 'vitest'
import { cleanIpcErrorMessage, getUserErrorMessage } from '../src/renderer/shared/errors'

describe('renderer error messages', () => {
	it('removes Electron IPC and generic Error prefixes', () => {
		expect(
			cleanIpcErrorMessage(
				"Error invoking remote method 'addons:check': Error: GitHub недоступен"
			)
		).toBe('GitHub недоступен')
		expect(
			cleanIpcErrorMessage(
				"Error invoking remote method 'github:test-connection': LauncherError: Прокси недоступен"
			)
		).toBe('Прокси недоступен')
		expect(
			getUserErrorMessage(
				new Error(
					"Error invoking remote method 'client:check': Error: Проверка клиента остановлена"
				),
				'fallback'
			)
		).toBe('Проверка клиента остановлена')
	})

	it('uses a fallback for unknown or empty errors', () => {
		expect(getUserErrorMessage({}, 'Понятная ошибка')).toBe('Понятная ошибка')
		expect(getUserErrorMessage(new Error(''), 'Понятная ошибка')).toBe('Понятная ошибка')
	})
})
