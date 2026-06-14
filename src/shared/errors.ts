export class LauncherError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly cause?: unknown
	) {
		super(message)
		this.name = 'LauncherError'
	}
}

export function toUserMessage(error: unknown): string {
	if (error instanceof LauncherError) return error.message
	if (error instanceof Error) return error.message
	return 'Неизвестная ошибка'
}
