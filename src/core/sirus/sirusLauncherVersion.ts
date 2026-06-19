export const SIRUS_OFFICIAL_LAUNCHER_REPO = 'sirussu/open-launcher'
export const SIRUS_OFFICIAL_LAUNCHER_RELEASES_LATEST_URL =
	'https://api.github.com/repos/sirussu/open-launcher/releases/latest'
export const DEFAULT_SIRUS_LAUNCHER_VERSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface SirusOfficialLauncherRelease {
	tag_name: string
}

export function parseSirusLauncherReleaseTag(tagName: string): string {
	return tagName.trim().replace(/^v/i, '')
}

export function resolveSirusLauncherVersionFromRelease(
	release: SirusOfficialLauncherRelease
): string | null {
	if (!release.tag_name) return null
	const version = parseSirusLauncherReleaseTag(release.tag_name)
	return version.length > 0 ? version : null
}

export function isSirusLauncherVersionCacheFresh(
	fetchedAtMs: number,
	nowMs: number,
	ttlMs = DEFAULT_SIRUS_LAUNCHER_VERSION_CACHE_TTL_MS
): boolean {
	return nowMs - fetchedAtMs < ttlMs
}
