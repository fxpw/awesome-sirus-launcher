import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl } from '../src/main/externalUrl'

describe('external url', () => {
	it('allows only http and https links', () => {
		expect(isAllowedExternalUrl('https://github.com/fxpw/awesome-sirus-launcher')).toBe(true)
		expect(isAllowedExternalUrl('http://d1st4r.stream/patch')).toBe(true)
		expect(isAllowedExternalUrl('file:///C:/Windows/System32/calc.exe')).toBe(false)
		expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
		expect(isAllowedExternalUrl('ms-settings:privacy')).toBe(false)
		expect(isAllowedExternalUrl('not a url')).toBe(false)
	})
})
