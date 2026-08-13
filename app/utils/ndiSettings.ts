import type { AppSettings } from "~/types"

export const DEFAULT_NDI_ENABLED = false

/** Keep the NDI preference local when account-backed settings omit the field. */
export const preserveDeviceNdiSetting = (
  current: Pick<AppSettings, "ndiEnabled">,
  incoming: AppSettings
): AppSettings => ({
  ...incoming,
  ndiEnabled:
    incoming.ndiEnabled ?? current.ndiEnabled ?? DEFAULT_NDI_ENABLED,
})
