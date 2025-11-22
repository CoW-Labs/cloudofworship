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
}

export { }
