import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createApp } from "vue"
import { createPinia, defineStore } from "pinia"
import { describe, expect, it, vi } from "vitest"

const PLUGIN_DIR = fileURLToPath(new URL("../app/plugins", import.meta.url))
/** Comments discuss `enforce: "pre"` and `useAppStore()`; only code counts. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const readPlugin = (file: string) =>
  stripComments(readFileSync(`${PLUGIN_DIR}/${file}`, "utf8"))

/** Nuxt loads app plugins in filename order. */
const loadOrder = readdirSync(PLUGIN_DIR)
  .filter((file) => file.endsWith(".ts"))
  .sort()

/** Plugins that register a Pinia plugin every store must receive. */
const PINIA_REGISTRARS = loadOrder.filter((file) =>
  /pinia\.use\(/.test(readPlugin(file))
)

const RESOLVES_A_STORE = /\buse(App|Auth|Template)Store\s*\(/

describe("pinia plugin registration order", () => {
  // The trap this suite guards. Pinia runs its plugins from `createSetupStore`,
  // so a store that already exists when `pinia.use()` is called never receives
  // the plugin — and nothing warns.
  it("never applies a pinia plugin to a store created before it", () => {
    const useStore = defineStore("app", { state: () => ({ n: 0 }) })
    const pinia = createPinia()
    createApp({}).use(pinia)

    useStore(pinia)
    const registered = vi.fn()
    pinia.use(registered)
    useStore(pinia)

    expect(registered).not.toHaveBeenCalled()
  })

  it("applies to a store created after registration", () => {
    const useStore = defineStore("app", { state: () => ({ n: 0 }) })
    const pinia = createPinia()
    createApp({}).use(pinia)

    const registered = vi.fn()
    pinia.use(registered)
    useStore(pinia)

    expect(registered).toHaveBeenCalledTimes(1)
  })

  it("registers state sharing and persistence", () => {
    expect(PINIA_REGISTRARS).toEqual([
      "01.app-state-persistence.client.ts",
      "02.pinia-shared-state.ts",
    ])
  })

  // `build-freshness.client.ts` resolving a store at setup used to create the
  // app store before `pinia-shared-state.ts` registered — killing operator/live
  // sharing, which is what alerts on /live depend on.
  it("loads every pinia registrar before any plugin that resolves a store", () => {
    const lastRegistrar = Math.max(
      ...PINIA_REGISTRARS.map((file) => loadOrder.indexOf(file))
    )
    const tooEarly = loadOrder
      .slice(0, lastRegistrar)
      .filter(
        (file) =>
          !PINIA_REGISTRARS.includes(file) &&
          RESOLVES_A_STORE.test(readPlugin(file))
      )

    expect(tooEarly).toEqual([])
  })

  // `enforce: "pre"` is order -20, ahead of the Pinia module's own plugin at 0,
  // so it would run these before `nuxtApp.$pinia` exists. Filename order is the
  // only safe lever here.
  it.each(PINIA_REGISTRARS)("%s does not use enforce: pre", (file) => {
    expect(readPlugin(file)).not.toMatch(/enforce:\s*["']pre["']/)
  })

  // Defence in depth: no plugin should resolve a store during setup at all —
  // it only needs one at the moment it actually reads state.
  it("resolves stores lazily inside build-freshness", () => {
    const source = readPlugin("build-freshness.client.ts")
    const body = source.slice(source.indexOf("defineNuxtPlugin"))
    const beforeFirstUse = body.slice(0, body.indexOf("isSafeToReload"))

    expect(RESOLVES_A_STORE.test(beforeFirstUse)).toBe(false)
    expect(RESOLVES_A_STORE.test(body)).toBe(true)
  })
})
