/**
 * `share` used to be contributed to Pinia's store options by the
 * `pinia-shared-state` package's own module augmentation. Cross-window syncing
 * is now handled by `app/plugins/pinia-shared-state.ts`, so that package is no
 * longer imported (or installed) and its augmentation no longer loads.
 *
 * Without this declaration the `share` block in `app/store/app.ts` is an
 * unknown property, which fails the `defineStore` overload and collapses type
 * inference for the whole store — every action silently becomes untyped.
 *
 * The fields below are exactly the ones the plugin reads.
 */
declare module "pinia" {
  interface DefineStoreOptionsBase<S, Store> {
    share?: {
      /** Keys a receiving window must not apply from an incoming snapshot. */
      omit?: Array<keyof S>
      /** Disable cross-window syncing for this store. Defaults to enabled. */
      enable?: boolean
      /** Request a snapshot from other windows on start. Defaults to true. */
      initialize?: boolean
    }
  }
}

export {}
