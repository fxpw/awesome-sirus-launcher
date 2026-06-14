import { computed, ref } from 'vue'
import { defaultLocale, type Locale, type MessageKey, translate } from '@renderer/shared/i18n'
import { readLocalStorageValue, writeLocalStorageValue } from '@renderer/shared/storage'

const localeOptions = ['ru', 'en'] as const
const locale = ref<Locale>(readLocalStorageValue('launcher.locale', localeOptions, defaultLocale))

export function useLocale() {
	const t = (key: MessageKey, params?: Record<string, string | number>) =>
		translate(locale.value, key, params)

	function setLocale(next: Locale): void {
		locale.value = next
		writeLocalStorageValue('launcher.locale', next)
	}

	return {
		locale,
		localeOptions,
		currentLocale: computed(() => locale.value),
		setLocale,
		t
	}
}
