import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { ZodError, type ZodType } from 'zod'

export function registerIpcHandler<Input, Output>(
	channel: string,
	inputSchema: ZodType<Input>,
	outputSchema: ZodType<Output>,
	handler: (input: Input, event: IpcMainInvokeEvent) => Output | Promise<Output>
): void {
	ipcMain.handle(channel, async (event, input: unknown) => {
		let parsedInput: Input
		try {
			parsedInput = inputSchema.parse(input)
		} catch (error) {
			if (error instanceof ZodError) {
				throw new Error(error.issues[0]?.message ?? 'Некорректные данные запроса')
			}
			throw error
		}

		const result = await handler(parsedInput, event)
		try {
			return outputSchema.parse(result)
		} catch (error) {
			if (!(error instanceof ZodError)) throw error
			console.error(`[ipc] Некорректный ответ ${channel}:`, error.issues)
			throw new Error('Лаунчер получил некорректный внутренний ответ')
		}
	})
}
