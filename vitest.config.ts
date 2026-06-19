import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		alias: {
			'@core': resolve('src/core'),
			'@shared': resolve('src/shared'),
			'@main': resolve('src/main')
		}
	},
	test: {
		environment: 'node'
	}
})
