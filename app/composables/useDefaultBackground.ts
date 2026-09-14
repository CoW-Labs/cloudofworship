import { useAppStore } from "~/store/app"
import type { DefaultBackgroundSetting, SlideBackgroundKey } from "~/types"

/**
 * The slide-type groups a user can give their own background in Background
 * Settings. Slide types that share a look share a group (songs, hymns and
 * setlists all read as sung content), so the settings panel stays short.
 */
export const slideBackgroundGroups: Array<{
  key: SlideBackgroundKey
  label: string
  description: string
  icon: string
}> = [
  {
    key: "default",
    label: "All slides",
    description:
      "Used by every new slide that has no background of its own set below.",
    icon: "i-bx-layer",
  },
  {
    key: "hymn",
    label: "Songs & Hymns",
    description: "Songs, hymns and setlists.",
    icon: "i-bx-music",
  },
  {
    key: "bible",
    label: "Bible",
    description: "Scripture slides.",
    icon: "i-bx-book-open",
  },
  {
    key: "text",
    label: "Text",
    description: "Free text slides.",
    icon: "i-bx-text",
  },
]

/**
 * Resolve the background a newly created slide should get.
 *
 * A per-slide-type entry only wins when the user actually picked it (`custom`).
 * Otherwise the app-wide `default` applies, and the seeded per-type entry is
 * the last resort — the behaviour accounts had before per-type backgrounds
 * were editable.
 *
 * Pass "default" for slide types that belong to no group (countdowns): they
 * follow the app-wide background. Legacy accounts may not have that entry, so
 * the songs background remains their fallback, matching the behaviour those
 * accounts had before the app-wide setting existed.
 */
export const useResolvedDefaultBackground = (
  key: SlideBackgroundKey
): Partial<DefaultBackgroundSetting> => {
  const appStore = useAppStore()
  const backgrounds = appStore.currentState.settings.defaultBackground

  let source: DefaultBackgroundSetting | undefined
  if (key === "default") {
    source = backgrounds?.default || backgrounds?.hymn
  } else {
    const perType = backgrounds?.[key]
    source = perType?.custom ? perType : backgrounds?.default || perType
  }

  return {
    backgroundType: source?.backgroundType,
    background: source?.background,
    backgroundVideoKey: source?.backgroundVideoKey ?? null,
    backgroundImageKey: source?.backgroundImageKey ?? null,
  }
}
