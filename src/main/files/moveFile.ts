import { copyFile, rename, rm } from 'node:fs/promises'

interface MoveFileSystem {
	copyFile(sourcePath: string, targetPath: string): Promise<void>
	rename(sourcePath: string, targetPath: string): Promise<void>
	rm(path: string, options: { force: boolean }): Promise<void>
}

export async function moveFile(
	sourcePath: string,
	targetPath: string,
	fileSystem: MoveFileSystem = { copyFile, rename, rm }
): Promise<void> {
	try {
		await fileSystem.rename(sourcePath, targetPath)
	} catch (error) {
		if ((error as NodeJS.ErrnoException | undefined)?.code !== 'EXDEV') throw error

		await fileSystem.copyFile(sourcePath, targetPath)
		await fileSystem.rm(sourcePath, { force: true })
	}
}
