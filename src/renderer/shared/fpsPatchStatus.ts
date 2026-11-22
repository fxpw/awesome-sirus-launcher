import type { FpsPatchStatus } from '@shared/contracts'
import type { MessageKey } from './i18n'

export function getFpsPatchState(status: FpsPatchStatus | null): {
	tone: 'neutral' | 'ok' | 'warning'
	labelKey: MessageKey
} {
	if (!status?.installed) return { tone: 'warning', labelKey: 'fpsPatch.missing' }
	if (status.freshness === 'latest') return { tone: 'ok', labelKey: 'fpsPatch.latest' }
	if (status.freshness === 'outdated') return { tone: 'warning', labelKey: 'fpsPatch.outdated' }
	return { tone: 'neutral', labelKey: 'fpsPatch.unknown' }
}
