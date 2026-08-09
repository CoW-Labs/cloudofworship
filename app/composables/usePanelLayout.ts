import { useWindowSize } from "@vueuse/core"
import {
  PANEL_SIZE_LIMITS,
  PANEL_SIZE_RATIOS,
  useAppStore,
  type PanelSizeKey,
} from "~/store/app"

// Vertical chrome sitting above the resizable panel row on `/`: the navbar plus
// the row's own top margin. Kept in sync with the `h-[calc(100vh-…)]` on the
// panel row in pages/index.vue.
export const APP_CHROME_HEIGHT = 80
export const APP_CHROME_HEIGHT_SHORT = 64

// Horizontal chrome the panel row cannot use: the row's `px-4` gutters plus the
// two drag handles (`w-2` + `mx-1` each) between the three columns.
const ROW_HORIZONTAL_CHROME = 32 + 32

export interface PanelBounds {
  min: number
  max: number
  ideal: number
}

/**
 * Sizing for the three resizable panels on the operator screen.
 *
 * Panels used to be stored as fixed pixel widths/heights, which meant a 290px
 * preview grid took 35% of a 1600x900 screen but 57% of a 1280x585 one — the
 * editor below it was pushed off-screen. Here every panel is expressed as a
 * fraction of the axis it lives on, so short/narrow screens keep the same
 * proportions as the reference 1600x900 layout. Sizes a user has explicitly
 * dragged are preserved, but still clamped into the current viewport's range.
 */
export const usePanelLayout = () => {
  const appStore = useAppStore()
  const { width, height } = useWindowSize()

  const isShortViewport = computed(() => height.value <= 760)

  // Space actually available to the panel row on each axis.
  const availableWidth = computed(() =>
    Math.max(0, width.value - ROW_HORIZONTAL_CHROME)
  )
  const availableHeight = computed(() =>
    Math.max(
      0,
      height.value -
        (isShortViewport.value ? APP_CHROME_HEIGHT_SHORT : APP_CHROME_HEIGHT)
    )
  )

  const axisSize = (axis: "width" | "height") =>
    axis === "width" ? availableWidth.value : availableHeight.value

  /** Draggable range + preferred size for a panel at the current viewport. */
  const resolveBounds = (panel: PanelSizeKey): PanelBounds => {
    const ratios = PANEL_SIZE_RATIOS[panel]
    const limits = PANEL_SIZE_LIMITS[panel]
    const axis = axisSize(ratios.axis)

    // The absolute floor only bites on small screens, and the absolute ceiling
    // only on large ones — in between, the ratios drive the range.
    const min = Math.max(limits.min, Math.round(ratios.min * axis))
    const max = Math.max(
      min,
      Math.min(limits.max, Math.round(ratios.max * axis))
    )
    const ideal = Math.min(max, Math.max(min, Math.round(ratios.ideal * axis)))

    return { min, max, ideal }
  }

  const panelBounds = (panel: PanelSizeKey): ComputedRef<PanelBounds> =>
    computed(() => resolveBounds(panel))

  /**
   * The size a panel should render at: the user's dragged size clamped into the
   * current viewport, or the proportional ideal if they never dragged it.
   */
  const panelSize = (panel: PanelSizeKey): ComputedRef<number> =>
    computed(() => {
      const { min, max, ideal } = resolveBounds(panel)
      if (!appStore.isPanelUserSized(panel)) return ideal
      return Math.min(max, Math.max(min, appStore.panelSize(panel)))
    })

  const commitPanelSize = (panel: PanelSizeKey, size: number) => {
    const { min, max } = resolveBounds(panel)
    appStore.setPanelSize(panel, Math.min(max, Math.max(min, size)))
  }

  return {
    isShortViewport,
    availableWidth,
    availableHeight,
    panelBounds,
    panelSize,
    commitPanelSize,
  }
}
