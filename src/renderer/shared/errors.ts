const electronIpcPrefix = /^Error invoking remote method ['"][^'"]+['"]:\s*/i
const genericErrorPrefix = /^Error:\s*/i

export function cleanIpcErrorMessage(message: string): string {
	let cleaned = message.trim().replace(electronIpcPrefix, '')
	while (genericErrorPrefix.test(cleaned)) {
		cleaned = cleaned.replace(genericErrorPrefix, '').trim()
	}
	return cleaned
}

export function getUserErrorMessage(error: unknown, fallback: string): string {
	const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
	return cleanIpcErrorMessage(message) || fallback
}
