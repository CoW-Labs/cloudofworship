/**
 * useScreenPermission
 *
 * Whether the browser will let us place the live window on another display.
 * That needs the Window Management API (Chrome/Edge 100+, HTTPS) and the
 * user's "window management" permission.
 *
 *  - "unsupported": no API (Firefox, Safari, plain HTTP). The live window can
 *    only open on the screen the operator is already on.
 *  - "denied":      the user blocked it. getScreenDetails() throws.
 *  - "prompt":      not asked yet. getScreenDetails() will show the prompt.
 *  - "granted":     good to go.
 *
 * Desktop (Tauri) places windows natively and never needs this.
 */
export type ScreenAccess = "unsupported" | "denied" | "prompt" | "granted"

export const getScreenAccess = async (): Promise<ScreenAccess> => {
  if (typeof window === "undefined" || !("getScreenDetails" in window)) {
    return "unsupported"
  }

  // Chrome renamed the permission from "window-placement" to
  // "window-management" in v111; try the current name first.
  for (const name of ["window-management", "window-placement"]) {
    try {
      const status = await navigator.permissions.query({ name } as any)
      return status.state as ScreenAccess
    } catch {
      // Unknown permission name in this browser, try the next one
    }
  }

  // The Permissions API can't tell us. Let getScreenDetails() ask.
  return "prompt"
}

export default getScreenAccess
