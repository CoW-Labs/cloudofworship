import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * A component that emits an event WITHOUT declaring it in `defineEmits` leaves
 * the parent's listener sitting in `$attrs`. Vue then also attaches that
 * listener to the component's root element as a *native* DOM listener, so any
 * same-named DOM event bubbling out of the subtree calls the parent handler
 * with an `Event` object instead of the intended payload.
 *
 * That is not theoretical: PostHog caught `TipTapFontSelect` delivering a DOM
 * `Event` to `onFontFamilyChange`, because its searchable menu contains an
 * `<input>` whose native `change` bubbled to the component's root `<div>`.
 *
 * Only event names that are *bubbling* native DOM events can collide this way.
 * `close`, `toggle` and `cancel` are native names too, but they do not bubble
 * (and only fire on `<dialog>`/`<details>`), so components are free to use
 * them undeclared.
 */
const BUBBLING_DOM_EVENTS = new Set([
  "change",
  "input",
  "select",
  "submit",
  "reset",
  "search",
  "click",
  "dblclick",
  "keydown",
  "keyup",
  "keypress",
  "focusin",
  "focusout",
  "copy",
  "cut",
  "paste",
  "drop",
  "dragstart",
  "dragend",
  "wheel",
  "contextmenu",
])

const componentsDir = fileURLToPath(
  new URL("../app/components", import.meta.url)
)

const vueFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return vueFiles(path)
    return path.endsWith(".vue") ? [path] : []
  })

/** Event names the file emits, from `$emit("x")` and `emit("x")` alike. */
const emittedEvents = (source: string): string[] => {
  const names = new Set<string>()
  for (const match of source.matchAll(/\$?\bemit\(\s*['"]([\w:-]+)['"]/g)) {
    names.add(match[1]!)
  }
  return [...names]
}

/**
 * Event names declared by `defineEmits`. Both type forms are in use here — the
 * property form (`change: [value: number]`) and the older call-signature form
 * (`(e: "change", value: number): void`) — plus the runtime array form.
 */
const declaredEvents = (source: string): string[] => {
  const typed = source.match(/defineEmits<\{([\s\S]*?)\}>\(\)/)
  if (typed) {
    const body = typed[1]!
    const callSignature = [
      ...body.matchAll(/\(\s*e\s*:\s*['"]([\w:-]+)['"]/g),
    ].map((match) => match[1]!)
    const property = [
      ...body.matchAll(/^\s*['"]?([\w:-]+)['"]?\s*\??\s*:/gm),
    ].map((match) => match[1]!)
    return [...callSignature, ...property]
  }
  const array = source.match(/defineEmits\(\s*\[([\s\S]*?)\]/)
  if (array) {
    return [...array[1]!.matchAll(/['"]([\w:-]+)['"]/g)].map(
      (match) => match[1]!
    )
  }
  return []
}

describe("component emit declarations", () => {
  const files = vueFiles(componentsDir)

  it("finds components to check", () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it("declares every emitted event that collides with a bubbling DOM event", () => {
    const offenders: string[] = []

    for (const file of files) {
      const source = readFileSync(file, "utf8")
      const declared = new Set(declaredEvents(source))
      const undeclared = emittedEvents(source).filter(
        (name) => BUBBLING_DOM_EVENTS.has(name) && !declared.has(name)
      )
      if (undeclared.length) {
        offenders.push(`${file.replace(componentsDir, "")}: ${undeclared.join(", ")}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it("reads the font select as declaring its change event", () => {
    const source = readFileSync(
      join(componentsDir, "editor/TipTapFontSelect.vue"),
      "utf8"
    )
    expect(emittedEvents(source)).toContain("change")
    expect(declaredEvents(source)).toContain("change")
  })
})
