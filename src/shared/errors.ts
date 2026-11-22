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
