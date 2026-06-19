import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	isSirusLauncherVersionCacheFresh,
	parseSirusLauncherReleaseTag,
	resolveSirusLauncherVersionFromRelease
} from '../src/core/sirus/sirusLauncherVersion'
import { createSirusLauncherVersionService } from '../src/main/sirus/sirusLauncherVersionService'

describe('sirus launcher version', () => {
	it('parses GitHub release tag names', () => {
		expect(parseSirusLauncherReleaseTag('v2.0.8')).toBe('2.0.8')
		expect(parseSirusLauncherReleaseTag('2.0.8')).toBe('2.0.8')
	})

	it('resolves version from release payload', () => {
		expect(resolveSirusLauncherVersionFromRelease({ tag_name: 'v2.0.8' })).toBe('2.0.8')
		expect(resolveSirusLauncherVersionFromRelease({ tag_name: '' })).toBeNull()
	})

	it('treats cache as fresh inside ttl window', () => {
		const now = Date.parse('2026-06-19T12:00:00.000Z')
		const fetchedAt = Date.parse('2026-06-19T10:00:00.000Z')
		expect(isSirusLauncherVersionCacheFresh(fetchedAt, now, 24 * 60 * 60 * 1000)).toBe(true)
		expect(isSirusLauncherVersionCacheFresh(fetchedAt, now, 60 * 60 * 1000)).toBe(false)
	})

	it('fetches latest release and caches it on disk', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-version-'))
		const service = createSirusLauncherVersionService(
			() => root,
			'1.0.15',
			async () => ({ tag_name: 'v2.0.8' })
		)

		await expect(service.refresh()).resolves.toBe('2.0.8')
		await expect(service.getVersion()).resolves.toBe('2.0.8')
	})

	it('falls back to cached version when refresh fails', async () => {
		const root = await mkdtemp(join(tmpdir(), 'sirus-version-fallback-'))
		let shouldFail = false
		const service = createSirusLauncherVersionService(
			() => root,
			'1.0.15',
			async () => {
				if (shouldFail) throw new Error('offline')
				return { tag_name: 'v2.0.8' }
			}
		)

		await service.refresh()
		shouldFail = true
		await expect(service.getVersion()).resolves.toBe('2.0.8')
	})
})
