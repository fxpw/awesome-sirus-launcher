import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { ZodType } from 'zod'

export function registerIpcHandler<Input, Output>(
	channel: string,
	inputSchema: ZodType<Input>,
	outputSchema: ZodType<Output>,
	handler: (input: Input, event: IpcMainInvokeEvent) => Output | Promise<Output>
): void {
	ipcMain.handle(channel, async (event, input: unknown) => {
		const parsedInput = inputSchema.parse(input)
		const result = await handler(parsedInput, event)
		return outputSchema.parse(result)
	})
}
