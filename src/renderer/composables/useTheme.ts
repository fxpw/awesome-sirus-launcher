import { computed, ref, watchEffect } from 'vue'
import { readLocalStorageValue, writeLocalStorageValue } from '@renderer/shared/storage'

export type ThemeMode = 'light' | 'dark'

const themeOptions = ['light', 'dark'] as const
const theme = ref<ThemeMode>(readLocalStorageValue('launcher.theme', themeOptions, 'light'))

export function useTheme() {
	function setTheme(next: ThemeMode): void {
		theme.value = next
		writeLocalStorageValue('launcher.theme', next)
	}

	function toggleTheme(): void {
		setTheme(theme.value === 'dark' ? 'light' : 'dark')
	}

	watchEffect(() => {
		document.documentElement.dataset.theme = theme.value
	})

	return {
		theme,
		themeOptions,
		currentTheme: computed(() => theme.value),
		setTheme,
		toggleTheme
	}
}
