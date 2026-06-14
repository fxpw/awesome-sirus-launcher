import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		resolve: {
			alias: {
				'@core': resolve('src/core'),
				'@shared': resolve('src/shared'),
				'@main': resolve('src/main')
			}
		}
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
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
