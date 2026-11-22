import type { LauncherApi } from '@shared/contracts'

function getLauncher(): LauncherApi {
	if (!window.launcher) {
		throw new Error(
			'Electron preload API не доступен. Перезапусти dev-режим через npm run dev и открывай именно окно Electron.'
		)
	}

	return window.launcher
}

export const launcherApi = new Proxy({} as LauncherApi, {
	get: (_target, namespace: keyof LauncherApi) => getLauncher()[namespace]
})
