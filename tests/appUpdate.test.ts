import { describe, expect, it } from 'vitest'
import { checkForAppUpdate, compareSemver, mapGitHubRelease } from '../src/core/updater/appUpdate'

describe('app update helpers', () => {
	it('compares semver versions', () => {
		expect(compareSemver('1.2.0', '1.1.9')).toBeGreaterThan(0)
		expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
		expect(compareSemver('0.9.9', '1.0.0')).toBeLessThan(0)
	})

	it('maps GitHub release response', () => {
		const release = mapGitHubRelease({
			tag_name: 'v1.2.3',
			html_url: 'https://github.com/fxpw/awesome-sirus-launcher/releases/tag/v1.2.3',
			body: 'Release notes',
			prerelease: false,
			assets: [
				{
					name: 'AwesomeSirusLauncher.exe',
					browser_download_url: 'https://example.test/download',
					size: 42
				}
			]
		})

		expect(release.version).toBe('1.2.3')
		expect(release.assets[0]).toEqual({
			name: 'AwesomeSirusLauncher.exe',
			downloadUrl: 'https://example.test/download',
			size: 42
		})
	})

	it('ignores prereleases by default', () => {
		const result = checkForAppUpdate('1.0.0', [
			{
				version: '2.0.0',
				url: 'https://example.test/beta',
				prerelease: true,
				assets: []
			},
			{
				version: '1.1.0',
				url: 'https://example.test/stable',
				prerelease: false,
				assets: []
			}
		])

		expect(result.updateAvailable).toBe(true)
		expect(result.latest?.version).toBe('1.1.0')
	})
})
