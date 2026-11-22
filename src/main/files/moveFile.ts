import { copyFile, rename, rm } from 'node:fs/promises'
import { basename } from 'node:path'

interface MoveFileSystem {
	copyFile(sourcePath: string, targetPath: string): Promise<void>
	rename(sourcePath: string, targetPath: string): Promise<void>
	rm(path: string, options: { force: boolean }): Promise<void>
}

const lockedFileErrorCodes = ['EBUSY', 'EPERM', 'EACCES']

export async function moveFile(
	sourcePath: string,
	targetPath: string,
	fileSystem: MoveFileSystem = { copyFile, rename, rm }
): Promise<void> {
	try {
		await fileSystem.rename(sourcePath, targetPath).catch(async (error) => {
			if ((error as NodeJS.ErrnoException | undefined)?.code !== 'EXDEV') throw error

			await fileSystem.copyFile(sourcePath, targetPath)
			await fileSystem.rm(sourcePath, { force: true })
		})
	} catch (error) {
		const code = (error as NodeJS.ErrnoException | undefined)?.code
		if (!code || !lockedFileErrorCodes.includes(code)) throw error

		throw new Error(
			`Не удалось заменить ${basename(targetPath)}: файл занят другой программой (например, запущенной игрой) или нет прав на запись`,
			{ cause: error }
		)
	}
}
