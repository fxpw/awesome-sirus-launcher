import { createServer, type Server } from 'node:net'
import { describe, expect, it, afterEach } from 'vitest'
import {
	crc32c,
	createMcrRequestFrame,
	createMcrResponseFrame,
	MCR_CHALLENGE,
	MCR_LENGTH,
	MCR_REQUEST,
	parseMcrChallenge
} from '../src/core/secureConnection/mcrProtocol'
import {
	mapSecuredConnectionHosts,
	verifySecureConnection,
	type SecuredConnectionConfig
} from '../src/core/secureConnection/verifySecureConnection'
import { createSecureConnectionService } from '../src/main/secureConnection/secureConnectionService'
describe('mcr protocol', () => {
	it('computes stable crc32c hashes', () => {
		const data = new TextEncoder().encode('123456789')
		expect(crc32c(data)).toBe(crc32c(data))
		expect(crc32c(data)).not.toBe(crc32c(new TextEncoder().encode('987654321')))
	})

	it('pads request frame to MCR_LENGTH', () => {
		const frame = createMcrRequestFrame()
		expect(frame.length).toBe(MCR_LENGTH)
		expect(new TextDecoder().decode(frame.subarray(0, MCR_REQUEST.length))).toBe(MCR_REQUEST)
	})

	it('builds challenge response from cookie and key', () => {
		const cookie = Uint8Array.from([1, 2, 3, 4])
		const key = 'a58ff763236a14a2fb177cff937eaeee00ef4a56'
		const frame = createMcrResponseFrame(cookie, key)
		expect(frame.length).toBe(MCR_LENGTH)
		expect(new TextDecoder().decode(frame.subarray(0, 4))).toBe('MCRR')
	})

	it('parses HTTP and MCR challenge prefixes', () => {
		expect(parseMcrChallenge(new TextEncoder().encode('HTTP/1.1'))).toEqual({ kind: 'http' })
		expect(
			parseMcrChallenge(
				Uint8Array.from([...new TextEncoder().encode(MCR_CHALLENGE), 9, 8, 7, 6])
			)
		).toEqual({ kind: 'challenge', cookie: Uint8Array.from([9, 8, 7, 6]) })
		expect(parseMcrChallenge(new Uint8Array([1, 2, 3]))).toEqual({ kind: 'invalid' })
	})
})

describe('verifySecureConnection', () => {
	it('skips handshake when config is disabled or empty', async () => {
		let connections = 0
		const deps = {
			fetchConfig: async () => ({ enabled: false, hosts: [] }),
			establishConnection: async () => {
				connections += 1
			}
		}

		expect(await verifySecureConnection('1.0.15', deps)).toEqual({ verified: true })
		expect(connections).toBe(0)
	})

	it('connects to all configured hosts', async () => {
		const config: SecuredConnectionConfig = {
			enabled: true,
			hosts: [
				{ address: '127.0.0.1', port: 1, phrase: 'aa', delay: 0 },
				{ address: '127.0.0.1', port: 2, phrase: 'bb', delay: 0 }
			]
		}
		const connected: string[] = []

		const result = await verifySecureConnection('1.0.15', {
			fetchConfig: async () => config,
			establishConnection: async (host) => {
				connected.push(`${host.host}:${host.port}`)
			}
		})

		expect(result).toEqual({ verified: true })
		expect(connected).toEqual(['127.0.0.1:1', '127.0.0.1:2'])
		expect(mapSecuredConnectionHosts(config)).toEqual([
			{ host: '127.0.0.1', port: 1, key: 'aa', delay: 0 },
			{ host: '127.0.0.1', port: 2, key: 'bb', delay: 0 }
		])
	})

	it('returns error when host handshake fails', async () => {
		const result = await verifySecureConnection('1.0.15', {
			fetchConfig: async () => ({
				enabled: true,
				hosts: [{ address: '127.0.0.1', port: 1, phrase: 'aa' }]
			}),
			establishConnection: async () => {
				throw new Error('Invalid challenge signature')
			}
		})

		expect(result.verified).toBe(false)
		expect(result.error).toBe('Invalid challenge signature')
	})
})

describe('secure connection service', () => {
	let server: Server | undefined

	afterEach(async () => {
		await new Promise<void>((resolve) => {
			if (!server) {
				resolve()
				return
			}
			server.close(() => resolve())
		})
		server = undefined
	})

	it('completes MCR handshake against a mock host', async () => {
		const key = 'a58ff763236a14a2fb177cff937eaeee00ef4a56'
		const cookie = Uint8Array.from([0x11, 0x22, 0x33, 0x44])
		const expectedResponse = createMcrResponseFrame(cookie, key)

		server = createServer((socket) => {
			socket.once('data', (request) => {
				expect(request.length).toBe(MCR_LENGTH)
				expect(new TextDecoder().decode(request.subarray(0, MCR_REQUEST.length))).toBe(
					MCR_REQUEST
				)

				const challenge = Buffer.concat([
					Buffer.from(MCR_CHALLENGE),
					Buffer.from(cookie)
				])
				socket.write(challenge)

				socket.once('data', (response) => {
					expect(Buffer.from(response.subarray(0, expectedResponse.length))).toEqual(
						Buffer.from(expectedResponse)
					)
					socket.end()
				})
			})
		})

		const port = await new Promise<number>((resolve, reject) => {
			server!.once('error', reject)
			server!.listen(0, '127.0.0.1', () => {
				const address = server!.address()
				if (!address || typeof address === 'string') {
					reject(new Error('Failed to bind mock MCR server'))
					return
				}
				resolve(address.port)
			})
		})

		const service = createSecureConnectionService({
			getVersion: async () => '2.0.8-test',
			refresh: async () => '2.0.8-test'
		})
		const originalFetch = globalThis.fetch
		globalThis.fetch = async () =>
			({
				ok: true,
				json: async () => ({
					enabled: true,
					hosts: [{ address: '127.0.0.1', port, phrase: key, delay: 0 }]
				})
			}) as Response

		try {
			const result = await service.verifyClient()
			expect(result).toEqual({ verified: true })
		} finally {
			globalThis.fetch = originalFetch
		}
	})
})
