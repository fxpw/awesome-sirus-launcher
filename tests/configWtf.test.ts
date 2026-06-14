import { describe, expect, it } from 'vitest'
import { updateAccountConfigText } from '../src/core/accounts/configWtf'

describe('updateAccountConfigText', () => {
  it('updates existing account lines and keeps other settings', () => {
    const result = updateAccountConfigText(
      [
        'SET gxResolution "1920x1080"',
        'SET accountName "old"',
        'SET readTerminationWithoutNotice "old-password"'
      ].join('\n'),
      {
        login: 'fxpw',
        password: 'password'
      }
    )

    expect(result.text).toContain('SET gxResolution "1920x1080"')
    expect(result.text).toContain('SET accountName "fxpw"')
    expect(result.text).toContain('SET readTerminationWithoutNotice "password"')
    expect(result.touchedKeys).toEqual(['accountName', 'readTerminationWithoutNotice'])
  })

  it('adds missing account lines', () => {
    const result = updateAccountConfigText('SET gxApi "D3D9"', {
      login: 'fxpw',
      password: 'secret'
    })

    expect(result.text.split('\n')).toEqual([
      'SET gxApi "D3D9"',
      'SET accountName "fxpw"',
      'SET readTerminationWithoutNotice "secret"'
    ])
  })

  it('escapes quotes and slashes in values', () => {
    const result = updateAccountConfigText('', {
      login: 'fx"pw',
      password: 'pa\\ss'
    })

    expect(result.text).toContain('SET accountName "fx\\"pw"')
    expect(result.text).toContain('SET readTerminationWithoutNotice "pa\\\\ss"')
  })
})
