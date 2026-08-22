import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { parseCombo } from "~/composables/useRegisteredShortcut"
import { getShortcut, shortcutIds, shortcuts } from "~/utils/shortcuts"

// `useCreateShortcut` is a Nuxt auto-import (default export, no Nuxt runtime
// deps), so it can be imported directly here.
import useCreateShortcut from "~/composables/useCreateShortcut"

type Listener = (event: any) => void

let listeners: Listener[] = []

beforeEach(() => {
  listeners = []
  vi.stubGlobal("window", {
    addEventListener: (_type: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_type: string, fn: Listener) => {
      listeners = listeners.filter((l) => l !== fn)
    },
  })
  vi.stubGlobal("document", { activeElement: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Fire a keydown at every registered handler. */
const press = (event: Partial<KeyboardEvent> & { key: string }) => {
  const full = {
    code: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => {},
    stopImmediatePropagation: () => {},
    ...event,
  }
  listeners.forEach((fn) => fn(full))
}

describe("parseCombo", () => {
  it("maps punctuation chords to their physical key", () => {
    expect(parseCombo("Mod+Shift+>")).toEqual({
      key: ">",
      ctrlOrMeta: true,
      shift: true,
      code: "Period",
    })
    expect(parseCombo("Mod+Shift+<")).toEqual({
      key: "<",
      ctrlOrMeta: true,
      shift: true,
      code: "Comma",
    })
  })

  it("does not add a code fallback to unmodified keys", () => {
    // Otherwise bare "?" (code Slash) would also fire on bare "/".
    expect(parseCombo("?").code).toBeUndefined()
    expect(parseCombo("/").code).toBeUndefined()
  })

  it("handles letters, arrows and Space", () => {
    expect(parseCombo("Mod+Shift+U")).toMatchObject({
      key: "u",
      ctrlOrMeta: true,
      shift: true,
    })
    expect(parseCombo("ArrowDown")).toMatchObject({ key: "ArrowDown" })
    expect(parseCombo("Space")).toMatchObject({ key: " " })
  })
})

describe("font size chords on a Mac", () => {
  const increase = getShortcut(shortcutIds.fontSizeIncrease)!
  const decrease = getShortcut(shortcutIds.fontSizeDecrease)!

  const bind = (combo: string, fn: () => boolean) => {
    const { key, ctrlOrMeta, shift, code } = parseCombo(combo)
    useCreateShortcut(key, fn, { ctrlOrMeta, shift, code, allowInEditable: true })
  }

  it("fires when the browser reports the shifted character", () => {
    const fn = vi.fn(() => true)
    bind(increase.combo, fn)
    press({ key: ">", code: "Period", metaKey: true, shiftKey: true })
    expect(fn).toHaveBeenCalledOnce()
  })

  it("fires when the browser reports the UNSHIFTED character", () => {
    // This is the case that was broken: some layouts/browsers report "." for
    // Cmd+Shift+. and the key-only comparison missed it.
    const fn = vi.fn(() => true)
    bind(increase.combo, fn)
    press({ key: ".", code: "Period", metaKey: true, shiftKey: true })
    expect(fn).toHaveBeenCalledOnce()
  })

  it("decrease fires on both reported characters", () => {
    const fn = vi.fn(() => true)
    bind(decrease.combo, fn)
    press({ key: "<", code: "Comma", metaKey: true, shiftKey: true })
    press({ key: ",", code: "Comma", metaKey: true, shiftKey: true })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("does not fire without Shift, so Cmd+, still means settings", () => {
    const fontSize = vi.fn(() => true)
    const settings = vi.fn(() => true)
    bind(decrease.combo, fontSize)
    bind(getShortcut(shortcutIds.settings)!.combo, settings)

    press({ key: ",", code: "Comma", metaKey: true, shiftKey: false })

    expect(fontSize).not.toHaveBeenCalled()
    expect(settings).toHaveBeenCalledOnce()
  })

  it("stays reachable while the verse input has focus", () => {
    ;(globalThis as any).document.activeElement = {
      tagName: "INPUT",
      getAttribute: () => null,
    }
    const fn = vi.fn(() => true)
    bind(increase.combo, fn)
    press({ key: ">", code: "Period", metaKey: true, shiftKey: true })
    expect(fn).toHaveBeenCalledOnce()
  })
})

describe("registry integrity", () => {
  it("has no duplicate ids", () => {
    const ids = shortcuts.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("has no two bindable shortcuts on the same combo within a scope", () => {
    const seen = new Map<string, string>()
    shortcuts
      .filter((s) => !s.external && !s.displayOnly)
      .forEach((s) => {
        const signature = `${s.scope}:${s.combo}`
        expect(
          seen.has(signature),
          `${s.id} collides with ${seen.get(signature)} on ${s.combo}`
        ).toBe(false)
        seen.set(signature, s.id)
      })
  })
})

describe("editor chords match what TipTap actually binds", () => {
  // The registry advertises these in tooltips but does not bind them — TipTap's
  // own extensions do. They drifted once already (v3 moved strike from
  // Mod-Shift-X to Mod-Shift-S), so pin them against the installed packages.
  const readShortcuts = (pkg: string) => {
    const path = `node_modules/@tiptap/${pkg}/dist/index.js`
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("node:fs").readFileSync(path, "utf8") as string
  }

  const cases: [string, string, string][] = [
    // shortcut id, package, chord TipTap registers
    [shortcutIds.bold, "extension-bold", "Mod-b"],
    [shortcutIds.italic, "extension-italic", "Mod-i"],
    [shortcutIds.paragraph, "extension-paragraph", "Mod-Alt-0"],
    [shortcutIds.blockquote, "extension-blockquote", "Mod-Shift-b"],
    [shortcutIds.codeBlock, "extension-code-block", "Mod-Alt-c"],
    [shortcutIds.alignLeft, "extension-text-align", "Mod-Shift-l"],
    [shortcutIds.alignCenter, "extension-text-align", "Mod-Shift-e"],
    [shortcutIds.alignRight, "extension-text-align", "Mod-Shift-r"],
    [shortcutIds.bulletList, "extension-list", "Mod-Shift-8"],
    [shortcutIds.orderedList, "extension-list", "Mod-Shift-7"],
  ]

  it.each(cases)("%s is still bound by TipTap", (id, pkg, chord) => {
    expect(readShortcuts(pkg)).toContain(`"${chord}"`)
    // The registry combo should describe that same chord.
    const combo = getShortcut(id)!.combo
    const normalised = combo.replace(/\+/g, "-").toLowerCase()
    expect(normalised).toBe(chord.toLowerCase())
  })

  it("strike is bound to Mod-Shift-X by our own extension, not by TipTap", () => {
    // TipTap v3 ships Mod-Shift-S. We re-bind the Google Docs / Slack chord in
    // TipTap.client.vue, so the tooltip's Mod+Shift+X must stay truthful.
    expect(getShortcut(shortcutIds.strike)!.combo).toBe("Mod+Shift+X")
    expect(readShortcuts("extension-strike")).toContain('"Mod-Shift-s"')

    const editor = require("node:fs").readFileSync(
      "app/components/editor/TipTap.client.vue",
      "utf8"
    ) as string
    expect(editor).toContain(
      '"Mod-Shift-x": () => this.editor.commands.toggleStrike()'
    )
    expect(editor).toContain("EditorKeymap,")
  })

  it("hands Mod-Shift-S back to the app instead of striking text", () => {
    // TipTap's Strike still ships Mod-Shift-S. Our higher-priority keymap
    // returns true for it so Strike never toggles, leaving the chord free for
    // "open schedules" — which must therefore work inside the editor too.
    const editor = require("node:fs").readFileSync(
      "app/components/editor/TipTap.client.vue",
      "utf8"
    ) as string
    expect(editor).toContain('"Mod-Shift-s": () => true')
    expect(editor).toContain("priority: 1000")

    const schedules = getShortcut(shortcutIds.openSchedules)!
    expect(schedules.combo).toBe("Mod+Shift+S")
    expect(schedules.allowInEditable).toBe(true)
  })

  it("opens schedules while the caret is in a text slide", () => {
    ;(globalThis as any).document.activeElement = {
      tagName: "DIV",
      getAttribute: (name: string) =>
        name === "contenteditable" ? "true" : null,
    }
    const fn = vi.fn(() => true)
    const { key, ctrlOrMeta, shift, code } = parseCombo(
      getShortcut(shortcutIds.openSchedules)!.combo
    )
    useCreateShortcut(key, fn, {
      ctrlOrMeta,
      shift,
      code,
      allowInEditable: getShortcut(shortcutIds.openSchedules)!.allowInEditable,
    })
    press({ key: "S", code: "KeyS", metaKey: true, shiftKey: true })
    expect(fn).toHaveBeenCalledOnce()
  })
})
