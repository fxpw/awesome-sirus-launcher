import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
	main: {
		resolve: {
			alias: {
				'@core': resolve('src/core'),
				'@shared': resolve('src/shared'),
				'@main': resolve('src/main')
			}
		}
	},
	preload: {
		resolve: {
			alias: {
				'@shared': resolve('src/shared')
			}
		}
	},
	renderer: {
		resolve: {
			alias: {
				'@renderer': resolve('src/renderer'),
				'@shared': resolve('src/shared')
			}
		},
		plugins: [vue()]
	}
})
