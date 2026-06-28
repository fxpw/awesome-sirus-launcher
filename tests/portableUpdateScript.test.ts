import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import {
	createPortableUpdateScript,
	getPortableUpdateDownloadPath
} from '../src/core/updater/portableUpdateScript'

describe('portable update script', () => {
	it('builds a script that replaces the executable and restarts it', () => {
		const script = createPortableUpdateScript({
			currentPid: 4242,
			downloadedPath: 'C:\\Launcher\\Awesome-Sirus-Launcher-Portable-1.2.0.exe.download',
			executablePath: 'C:\\Launcher\\Awesome-Sirus-Launcher-Portable-1.0.0.exe'
		})

		expect(script).toContain('$launcherPid = 4242')
		expect(script).toContain("'C:\\Launcher\\Awesome-Sirus-Launcher-Portable-1.2.0.exe.download'")
		expect(script).toContain("'C:\\Launcher\\Awesome-Sirus-Launcher-Portable-1.0.0.exe'")
		expect(script).toContain('$workingDirectory = Split-Path -Parent $executablePath')
		expect(script).toContain('for ($attempt = 1; $attempt -le 20; $attempt += 1)')
		expect(script).toContain('Remove-Item -LiteralPath $executablePath -Force')
		expect(script).toContain('Move-Item -LiteralPath $downloadedPath -Destination $executablePath -Force')
		expect(script).toContain(
			'Start-Process -FilePath $executablePath -WorkingDirectory $workingDirectory -PassThru'
		)
		expect(script).toContain('throw "Portable update restart failed: $lastErrorMessage"')
	})

	it('downloads portable updates to a sidecar .download file', () => {
		const path = getPortableUpdateDownloadPath(
			'Awesome-Sirus-Launcher-Portable-1.2.0.exe',
			'C:\\Launcher\\Awesome-Sirus-Launcher-Portable-1.0.0.exe'
		)

		expect(path).toBe(
			join('C:\\Launcher', 'Awesome-Sirus-Launcher-Portable-1.2.0.exe.download')
		)
	})
})
