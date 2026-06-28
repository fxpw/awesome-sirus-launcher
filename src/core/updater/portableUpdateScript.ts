import { dirname, join } from 'node:path'

export interface PortableUpdateScriptInput {
	currentPid: number
	downloadedPath: string
	executablePath: string
}

export function createPortableUpdateScript(input: PortableUpdateScriptInput): string {
	const downloadedPath = toPowerShellLiteral(input.downloadedPath)
	const executablePath = toPowerShellLiteral(input.executablePath)

	return [
		"$ErrorActionPreference = 'Stop'",
		`$launcherPid = ${input.currentPid}`,
		`$downloadedPath = ${downloadedPath}`,
		`$executablePath = ${executablePath}`,
		'$workingDirectory = Split-Path -Parent $executablePath',
		'$deadline = (Get-Date).AddMinutes(2)',
		'while ((Get-Process -Id $launcherPid -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {',
		'	Start-Sleep -Milliseconds 250',
		'}',
		'Start-Sleep -Milliseconds 500',
		'if (-not (Test-Path -LiteralPath $downloadedPath)) {',
		"	throw \"Downloaded update file not found: $downloadedPath\"",
		'}',
		'$lastErrorMessage = $null',
		'for ($attempt = 1; $attempt -le 20; $attempt += 1) {',
		'	try {',
		'		if (Test-Path -LiteralPath $executablePath) {',
		'			Remove-Item -LiteralPath $executablePath -Force',
		'		}',
		'		Move-Item -LiteralPath $downloadedPath -Destination $executablePath -Force',
		'		if (-not (Test-Path -LiteralPath $executablePath)) {',
		"			throw 'Portable executable was not moved into place'",
		'		}',
		'		$process = Start-Process -FilePath $executablePath -WorkingDirectory $workingDirectory -PassThru',
		'		if ($process -and -not $process.HasExited) {',
		'			exit 0',
		'		}',
		"		throw 'Portable executable exited immediately after launch'",
		'	} catch {',
		'		$lastErrorMessage = $_.Exception.Message',
		'		Start-Sleep -Milliseconds 500',
		'	}',
		'}',
		'throw "Portable update restart failed: $lastErrorMessage"'
	].join('\r\n')
}

export function getPortableUpdateDownloadPath(assetName: string, executablePath: string): string {
	return join(dirname(executablePath), `${sanitizeFileName(assetName)}.download`)
}

function sanitizeFileName(fileName: string): string {
	return fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
}

function toPowerShellLiteral(value: string): string {
	return `'${value.replace(/'/g, "''")}'`
}
