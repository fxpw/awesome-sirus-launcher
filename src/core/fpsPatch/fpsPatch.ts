import { join, normalize, resolve } from 'node:path'
import { getWowPaths } from '../wow/wowPaths'

export const fpsPatchFileName = 'patch-ruRU-[.mpq'

export const fpsPatchSourceUrls = [
	'https://d1st4r.ru/patch/patch-ruRU-[.mpq',
	'http://d1st4r.stream/patch/patch-ruRU-[.mpq'
] as const

export const fpsPatchMetadataUrls = [
	'https://api.d1st4r.ru/patchfx',
	...fpsPatchSourceUrls
] as const

export interface FpsPatchInstallPlan {
	targetPath: string
	tempPath: string
	sourceUrls: string[]
}

export function orderFpsPatchSourceUrls(remoteHash?: string): string[] {
	const urls = [...fpsPatchSourceUrls]
	if (!remoteHash) return urls
	return urls.sort((a, b) => Number(a.startsWith('https:')) - Number(b.startsWith('https:')))
}

export function createFpsPatchInstallPlan(
	wowPath: string,
	tempDir: string,
	remoteHash?: string
): FpsPatchInstallPlan {
	const paths = getWowPaths(wowPath)

	return {
		targetPath: join(paths.localeDataPath, fpsPatchFileName),
		tempPath: normalize(resolve(tempDir, `${fpsPatchFileName}.tmp`)),
		sourceUrls: orderFpsPatchSourceUrls(remoteHash)
	}
}
