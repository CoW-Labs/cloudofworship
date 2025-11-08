import type { getCurrentWindow } from '@tauri-apps/api/window'

declare module '#app' {
  interface NuxtApp {
    $tauri: {
      enabled: boolean
      invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T | null>
      getWindow: () => Promise<ReturnType<typeof getCurrentWindow> | null>
      getEvent: () => Promise<typeof import('@tauri-apps/api/event') | null>
    }
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $tauri: {
      enabled: boolean
      invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T | null>
      getWindow: () => Promise<ReturnType<typeof getCurrentWindow> | null>
      getEvent: () => Promise<typeof import('@tauri-apps/api/event') | null>
    }
  }
}

export { }
