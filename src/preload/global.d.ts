import type { LauncherApi } from '@shared/contracts'

declare global {
  interface Window {
    launcher: LauncherApi
  }
}

export {}
