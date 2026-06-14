import { join, normalize, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import type { WowPathValidation } from '@shared/contracts'

export function getWowPaths(wowPath: string): Omit<WowPathValidation, 'valid' | 'missing'> {
	const root = normalize(resolve(wowPath))
	const interfacePath = join(root, 'Interface')
	const wtfPath = join(root, 'WTF')

	return {
		wowPath: root,
		executablePath: join(root, 'Wow.exe'),
		dataPath: join(root, 'Data'),
		localeDataPath: join(root, 'Data', 'ruRU'),
		interfacePath,
		addonsPath: join(interfacePath, 'AddOns'),
		wtfPath,
		configWtfPath: join(wtfPath, 'Config.wtf')
	}
}

export function validateWowPath(wowPath: string): WowPathValidation {
	const paths = getWowPaths(wowPath)
	const required = [
		['Wow.exe', paths.executablePath],
		['Data', paths.dataPath],
		['Interface', paths.interfacePath],
		['WTF', paths.wtfPath]
	] as const
	const missing = required.filter(([, path]) => !existsSync(path)).map(([label]) => label)

	return {
		...paths,
		valid: missing.length === 0,
		missing
	}
}
