import type { AppRelease, AppUpdateCheck, ReleaseAsset } from '@shared/contracts'

export interface GitHubReleaseResponse {
	tag_name: string
	html_url: string
	body?: string | null
	prerelease: boolean
	assets: Array<{
		name: string
		browser_download_url: string
		size?: number
	}>
}

export function mapGitHubRelease(release: GitHubReleaseResponse): AppRelease {
	return {
		version: normalizeVersion(release.tag_name),
		url: release.html_url,
		notes: release.body ?? undefined,
		prerelease: release.prerelease,
		assets: release.assets.map(mapAsset)
	}
}

export function checkForAppUpdate(
	currentVersion: string,
	releases: AppRelease[],
	includePrerelease = false
): AppUpdateCheck {
	const latest = releases
		.filter((release) => includePrerelease || !release.prerelease)
		.sort((a, b) => compareSemver(b.version, a.version))[0]

	return {
		currentVersion,
		latest,
		updateAvailable: latest ? compareSemver(latest.version, currentVersion) > 0 : false
	}
}

export function compareSemver(left: string, right: string): number {
	const a = parseSemver(left)
	const b = parseSemver(right)

	for (let index = 0; index < 3; index += 1) {
		const delta = a[index] - b[index]
		if (delta !== 0) return delta
	}

	return 0
}

function normalizeVersion(version: string): string {
	return version.trim().replace(/^v/i, '')
}

function parseSemver(version: string): [number, number, number] {
	const [major = '0', minor = '0', patch = '0'] = normalizeVersion(version).split('.')
	return [major, minor, patch].map((part) => Number.parseInt(part, 10) || 0) as [
		number,
		number,
		number
	]
}

function mapAsset(asset: GitHubReleaseResponse['assets'][number]): ReleaseAsset {
	return {
		name: asset.name,
		downloadUrl: asset.browser_download_url,
		size: asset.size
	}
}
