import type { ClientPatchFileInput } from '@shared/contracts'

export function createClientFileKey(
	file: Pick<ClientPatchFileInput, 'fileName' | 'relativePath'>
): string {
	return `${file.relativePath}\u0000${file.fileName}`
}
