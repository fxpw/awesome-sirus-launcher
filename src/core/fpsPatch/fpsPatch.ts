import { join, normalize, resolve } from 'node:path'
import { getWowPaths } from '../wow/wowPaths'

export const fpsPatchFileName = 'patch-ruRU-[.mpq'

export const fpsPatchSourceUrls = [
	'https://d1st4r.ru/patch/patch-ruRU-[.mpq',
	'http://d1st4r.stream/patch/patch-ruRU-[.mpq'
] as const

export interface FpsPatchInstallPlan {
	targetPath: string
	tempPath: string
	sourceUrls: string[]
}

export function createFpsPatchInstallPlan(
	wowPath: string,
	tempDir: string,
	sourceUrls: readonly string[] = fpsPatchSourceUrls
): FpsPatchInstallPlan {
	const paths = getWowPaths(wowPath)

	return {
		targetPath: join(paths.localeDataPath, fpsPatchFileName),
		tempPath: normalize(resolve(tempDir, `${fpsPatchFileName}.tmp`)),
		sourceUrls: [...sourceUrls]
	}
}
