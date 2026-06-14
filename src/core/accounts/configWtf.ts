import type { AccountConfigPreview } from '@shared/contracts'

export interface AccountCredentials {
  login: string
  password: string
}

const ACCOUNT_NAME_KEY = 'accountName'
const PASSWORD_KEY = 'readTerminationWithoutNotice'

export function updateAccountConfigText(
  configText: string,
  credentials: AccountCredentials
): AccountConfigPreview {
  const updates = new Map<string, string>([
    [ACCOUNT_NAME_KEY, credentials.login],
    [PASSWORD_KEY, credentials.password]
  ])
  const touchedKeys = new Set<string>()
  const lines = splitLines(configText)
  const nextLines = lines.map((line) => {
    const key = parseSetKey(line)
    if (!key || !updates.has(key)) return line

    touchedKeys.add(key)
    return formatSetLine(key, updates.get(key) ?? '')
  })

  for (const [key, value] of updates) {
    if (!touchedKeys.has(key)) {
      nextLines.push(formatSetLine(key, value))
      touchedKeys.add(key)
    }
  }

  const text = nextLines.join('\n')
  return {
    changed: text !== normalizeLineEndings(configText),
    text,
    touchedKeys: [...touchedKeys]
  }
}

function splitLines(text: string): string[] {
  const normalized = normalizeLineEndings(text)
  if (normalized.length === 0) return []
  return normalized.split('\n')
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function parseSetKey(line: string): string | null {
  const match = line.match(/^\s*SET\s+([^\s]+)\s+/i)
  return match?.[1] ?? null
}

function formatSetLine(key: string, value: string): string {
  return `SET ${key} "${escapeWowValue(value)}"`
}

function escapeWowValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
