// Type declarations for browser APIs not yet in TypeScript

interface ScreenDetails {
  currentScreen: ScreenDetailed
  screens: ScreenDetailed[]
  addEventListener(type: 'screenschange', listener: () => void): void
  removeEventListener(type: 'screenschange', listener: () => void): void
}

interface ScreenDetailed {
  id?: string
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
  left: number
  top: number
  width: number
  height: number
  colorDepth: number
  pixelDepth: number
  label: string
  isPrimary: boolean
  isInternal: boolean
  devicePixelRatio: number
}

interface Window {
  getScreenDetails(): Promise<ScreenDetails>
  PaystackPop?: {
    setup: (config: {
      key: string
      email: string
      amount: number
      currency: string
      plan?: string
      ref: string
      metadata?: {
        custom_fields: Array<{
          display_name: string
          variable_name: string
          value: string
        }>
      }
      onClose: () => void
      callback: (response: { reference: string; status: string }) => void
    }) => {
      openIframe: () => void
    }
  }
}

export { }
