import { defineStore } from "pinia"
import type {
  Alert,
  AppSettings,
  BackgroundVideo,
  Schedule,
  Slide,
  SlideStyle,
  Advert,
  BibleVersion,
  AppState,
  OnlineUser,
  OverlaySettings,
} from "~/types/index"
import type { Emitter, EventType } from "mitt"
import { bibleVersionObjects } from "~/utils/constants"
import { useThrottleFn } from "@vueuse/core"
import posthog from "posthog-js"
import { preserveDeviceNdiSetting } from "~/utils/ndiSettings"
import { appStateSerializer } from "~/utils/appStateSerializer"
import {
  cancelAllPendingSlideShadowPuts,
  cancelPendingScheduleShadowPuts,
  cancelPendingSlideShadowPut,
  enqueueSlideShadowWrite,
} from "~/composables/useSlideRepository"

// Absolute floors/ceilings for every resizable panel. These are hard usability
// stops only — the effective bounds a user drags against are derived from the
// viewport in `usePanelLayout`, so a 1280x585 screen gets the same panel
// *proportions* as a 1600x900 one instead of the same absolute pixels.
export const PANEL_SIZE_LIMITS = {
  quickActionsWidth: { min: 240, max: 550, default: 340 },
  liveOutputWidth: { min: 320, max: 600, default: 450 },
  previewHeight: { min: 170, max: 900, default: 290 },
  livePreviewHeight: { min: 140, max: 700, default: 280 },
  transcriptPanelHeight: { min: 160, max: 520, default: 280 },
} as const

// Fraction of the axis each panel wants to occupy, measured off the reference
// 1600x900 layout the design was drawn at (e.g. 450/1600 ≈ 0.28 for LiveOutput).
// `min`/`max` are the draggable range as fractions; they are intersected with
// the absolute limits above.
export const PANEL_SIZE_RATIOS = {
  quickActionsWidth: { axis: "width", ideal: 0.21, min: 0.18, max: 0.34 },
  liveOutputWidth: { axis: "width", ideal: 0.28, min: 0.25, max: 0.38 },
  previewHeight: { axis: "height", ideal: 0.35, min: 0.26, max: 0.6 },
  livePreviewHeight: { axis: "height", ideal: 0.34, min: 0.22, max: 0.55 },
  transcriptPanelHeight: { axis: "height", ideal: 0.34, min: 0.22, max: 0.5 },
} as const satisfies Record<
  PanelSizeKey,
  { axis: "width" | "height"; ideal: number; min: number; max: number }
>

export type PanelSizeKey = keyof typeof PANEL_SIZE_LIMITS
export type PanelSizes = Record<PanelSizeKey, number>

const getDefaultPanelSizes = (): PanelSizes => ({
  quickActionsWidth: PANEL_SIZE_LIMITS.quickActionsWidth.default,
  liveOutputWidth: PANEL_SIZE_LIMITS.liveOutputWidth.default,
  previewHeight: PANEL_SIZE_LIMITS.previewHeight.default,
  livePreviewHeight: PANEL_SIZE_LIMITS.livePreviewHeight.default,
  transcriptPanelHeight: PANEL_SIZE_LIMITS.transcriptPanelHeight.default,
})

const clampPanelSize = (panel: PanelSizeKey, size: number) => {
  const limits = PANEL_SIZE_LIMITS[panel]
  const safeSize = Number.isFinite(size) ? size : limits.default
  return Math.min(limits.max, Math.max(limits.min, safeSize))
}

/**
 * Every write to `currentState.settings` replaces the object, which costs a
 * full state serialization to localStorage (persist) plus a shared-state
 * rebroadcast to the live/stage windows. Several callers write settings on a
 * hot path with values that have not actually changed — `useSong` re-asserts
 * `linesPerSlide` on every verse advance, `useScriptureChapter` re-asserts the
 * Bible version on every chapter load — so setters compare before writing.
 *
 * Nested values are compared by reference: a caller that hands over a fresh
 * inner object is treated as a change, which is the safe direction to err in.
 */
const shallowEqual = (a: Record<string, any>, b: Record<string, any>) => {
  if (a === b) return true
  if (!a || !b) return false
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) return false
  return aKeys.every((key) => Object.is(a[key], b[key]))
}

function ensureUniqueIds(arr: Slide[]): Slide[] {
  const seenIds = new Set()
  return arr.filter((obj) => {
    const id = obj?.id || obj?._id
    if (!id || seenIds.has(id)) {
      return false
    } else {
      seenIds.add(id)
      return true
    }
  })
}

/**
 * Upper bound on the undo/redo stack. Depth beyond this is never reached in
 * practice, and each retained entry holds a full activeSlides snapshot.
 */
const MAX_UNDO_HISTORY = 50

/**
 * This function is used to throttle the amount of times the app state is updated
 * in relation to the past states (undo/redo stack)
 * The key/value approach for updating is used to ensure reactivity of the app state
 * @param pastStates
 * @param currentState
 * @param key
 * @param value
 */
const onAppStateChange = useThrottleFn(
  (
    pastStates: AppState[],
    currentState: any,
    key: keyof AppState,
    value: any
  ) => {
    // console.log('added to Stack')
    const tempCurrentState = { ...currentState }
    if (key) {
      tempCurrentState[key] = value
    }
    pastStates.push({ ...tempCurrentState })
    // Every entry expands its full activeSlides array when serialized, so an
    // uncapped stack grows without bound over a long session.
    if (pastStates.length > MAX_UNDO_HISTORY) {
      pastStates.splice(0, pastStates.length - MAX_UNDO_HISTORY)
    }
  },
  1500
)

export const useAppStore = defineStore("app", {
  state: (): {
    currentState: AppState
    pastStates: AppState[]
    futureStates: AppState[]
    panelSizes: PanelSizes
    panelSizesTouched: Partial<Record<PanelSizeKey, boolean>>
  } => {
    return {
      currentState: {
        activeAdvert: null,
        schedules: [],
        activeSchedule: null,
        activeSlides: [], // Returns all slides on CoW
        liveOutputSlidesId: null,
        liveSlideId: null,
        emitter: null,
        settings: {
          appVersion: "0.1.0",
          defaultBibleVersion: "KJV",
          defaultFont: "Inter",
          defaultBackground: {
            hymn: {
              backgroundType: "image",
              background: "https://images.unsplash.com/photo-1506056820413-f8fa4de15de6?q=80&w=1740",
              backgroundVideoKey: null
            },
            bible: {
              backgroundType: "image",
              background: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=1740",
              backgroundVideoKey: null
            },
            text: {
              backgroundType: "image",
              background: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1740",
              backgroundVideoKey: null
            },
          },
          animations: true,
          microAnimations: true,
          verseTransitionStyle: "off",
          verseTransitionInterval: 0.3,
          footnotes: false,
          songAndHymnLabelsVisibility: false,
          liveWindowFullscreen: true, // Default to fullscreen mode
          closeLiveWindowWithOperator: false, // Default: live window stays open when operator tab closes
          ndiEnabled: false,
          transcriptionAutoActions: true,
          transcriptionVoiceBibleVersionCommands: true,
          uploadVideosToCloud: true,
          // motionlessSlides: true,
          transitionInterval: 0.7,
          slideStyles: {
            blur: 0.5,
            brightness: 50,
            linesPerSlide: 4,
            alignment: "center",
            windowPadding: { left: 24, right: 24, top: 24, bottom: 24 },
            lettercase: "",
            lineSpacing: "normal",
            fontSizePercent: 100,
            textOutlined: false,
            textBold: false,
            textLinesBackground: false
          },
          bibleVersions: [], // Check app.vue for bible versions array in a list
          alertLimit: 5,
        },
        backgroundVideos: [],
        alerts: [],
        activeAlert: null,
        activeOverlay: "none",
        activeOverlaySlide: null,
        recentBibleSearches: [],
        failedUploadRequests: [],
        slidesLoading: false,
        lastSynced: new Date().toISOString(),
        bannerVisible: true,
        bibleVersions: bibleVersionObjects, // Check app.vue for bible versions array in a list
        activeSocket: null,
        mainDisplayLabel: "",
        mainDisplayScreen: null,
        stageDisplayLabel: "",
        stageDisplayScreen: null,
        defaultMicrophoneId: "",
        defaultCameraId: "",
        onlineUsers: [] as OnlineUser[],
        slidesBeingEdited: {} as Record<
          string,
          { userId: string; userName: string; avatar?: string; theme?: string }
        >,
        // activeLiveWindows: [] as any[]
      },
      // Undo/Redo stacks
      pastStates: [],
      futureStates: [],
      panelSizes: getDefaultPanelSizes(),
      panelSizesTouched: {},
    }
  },
  getters: {
    // Compatibility index for the repository transition. It is derived and
    // cached by Pinia, so it does not duplicate slides in persisted state.
    slidesBySchedule: (state) => {
      const grouped: Record<string, Slide[]> = {}
      state.currentState.activeSlides?.forEach((slide) => {
        if (!slide?.scheduleId) return
        ;(grouped[slide.scheduleId] ||= []).push(slide)
      })
      return grouped
    },
    activeScheduleSlides(): Slide[] {
      const scheduleId = this.currentState.activeSchedule?._id
      return scheduleId ? this.slidesBySchedule[scheduleId] || [] : []
    },
    bibleVersions: (state) => state.currentState.settings.bibleVersions,
    panelSize: (state) => (panel: PanelSizeKey) =>
      clampPanelSize(panel, state.panelSizes?.[panel]),
    // A panel is "user-sized" once it has been dragged. Sizes that still sit on
    // the legacy fixed default were never chosen by anyone, so `usePanelLayout`
    // is free to replace them with a viewport-proportional size.
    isPanelUserSized: (state) => (panel: PanelSizeKey) => {
      if (state.panelSizesTouched?.[panel]) return true
      const saved = state.panelSizes?.[panel]
      return saved != null && saved !== PANEL_SIZE_LIMITS[panel].default
    },
  },
  actions: {
    setPanelSize(panel: PanelSizeKey, size: number) {
      this.panelSizes[panel] = clampPanelSize(panel, size)
      if (!this.panelSizesTouched) this.panelSizesTouched = {}
      this.panelSizesTouched[panel] = true
    },
    setSchedules(schedules: Schedule[]) {
      // onAppStateChange(this.pastStates, this.currentState)
      this.currentState.schedules = schedules?.filter(
        (schedule) => schedule !== null
      )
      if (this.currentState.activeSchedule) {
        const tempSchedule = schedules.find(
          (sch) => sch?._id === this.currentState.activeSchedule?._id
        ) as Schedule
        // console.log("tempSchedule", tempSchedule)
        this.currentState.activeSchedule = tempSchedule
      }
      this.futureStates = []
    },
    setActiveSchedule(schedule: Schedule | null) {
      if (schedule) {
        this.currentState.activeSchedule = schedule
        const existingSchedule = this.currentState.schedules.find(
          (sch) => sch?._id === schedule?._id
        )
        if (!existingSchedule) {
          this.currentState.schedules.push(schedule)
        } else {
          this.currentState.schedules.splice(
            this.currentState.schedules.findIndex(
              (sch) => sch?._id === schedule?._id
            ),
            1,
            schedule
          )
        }
      }
    },
    appendActiveSlide(slide: Slide, position?: number) {
      onAppStateChange(this.pastStates, this.currentState, "activeSlides", [
        ...this.currentState.activeSlides,
      ])
      // console.log('appending active slide', [...this.currentState.activeSlides])
      if (!this.currentState.activeSlides.find((s) => s?.id === slide?.id)) {
        const nextSlides = [...this.currentState.activeSlides]
        if (position !== undefined && position >= 0) {
          nextSlides.splice(position, 0, slide)
        } else {
          nextSlides.push(slide)
        }
        this.currentState.activeSlides = ensureUniqueIds(nextSlides)
        this.currentState.liveOutputSlidesId = Array.from(
          new Set(this.currentState.activeSlides.map((slide) => slide?.id))
        )
        enqueueSlideShadowWrite("append slide", (repository) =>
          repository.putSlide(slide)
        )
      }
      this.futureStates = []
    },
    appendActiveSlides(slides: Array<Slide>) {
      // console.log('appending active slides', this.currentState.activeSlides?.length)
      // onAppStateChange(this.pastStates, this.currentState)
      let tempSlides = [...this.currentState.activeSlides]
      tempSlides.push(...slides)
      this.currentState.activeSlides = ensureUniqueIds(tempSlides)
      this.currentState.liveOutputSlidesId = Array.from(
        new Set(this.currentState.activeSlides.map((slide) => slide?.id).filter(Boolean))
      )
      enqueueSlideShadowWrite("append slides", (repository) =>
        repository.putSlides(slides)
      )
      this.futureStates = []
    },
    removeActiveSlide(slide: Slide) {
      // console.log('removing active slides', this.currentState.activeSlides?.length)
      const slideIndex = this.currentState.activeSlides.findIndex(
        (s) => s?.id === slide?.id || s?._id === slide?._id
      )
      if (slideIndex < 0) {
        return
      }

      if (
        this.currentState.activeOverlaySlide?.id === slide.id ||
        (slide._id && this.currentState.activeOverlaySlide?._id === slide._id)
      ) {
        this.currentState.activeOverlaySlide = null
      }

      onAppStateChange(this.pastStates, this.currentState, "activeSlides", [
        ...this.currentState.activeSlides,
      ])
      // onAppStateChange(this.pastStates, this.currentState)
      // Reassign the array reference (not an in-place splice) so shallow
      // watchers re-fire. PreviewContent keeps a filtered copy synced via
      // `watch(() => activeSlides)`, which only triggers on reference change.
      // !! - IMPACTS PERFORMANCE SLIGHTLY
      const nextSlides = [...this.currentState.activeSlides]
      nextSlides.splice(slideIndex, 1)
      this.currentState.activeSlides = nextSlides
      this.currentState.liveOutputSlidesId = Array.from(
        new Set(this.currentState.activeSlides.map((slide) => slide?.id).filter(Boolean))
      )
      cancelPendingSlideShadowPut(slide.scheduleId, slide.id)
      enqueueSlideShadowWrite("remove slide", (repository) =>
        repository.deleteSlide(slide.scheduleId, slide.id)
      )
      this.futureStates = []
    },
    replaceScheduleActiveSlides(slides: Array<Slide>) {
      // onAppStateChange(this.pastStates, this.currentState)
      let tempSlides = [...this.currentState.activeSlides]
      tempSlides = tempSlides.filter(
        (slide) => slide.scheduleId !== this.currentState.activeSchedule?._id
      )
      // console.log("tempSlides", tempSlides)
      tempSlides.push(...slides)
      this.currentState.activeSlides = ensureUniqueIds(tempSlides)
      // console.log("replacing schedule active slides - p2", this.currentState.activeSlides)
      this.currentState.liveOutputSlidesId = Array.from(
        new Set(this.currentState.activeSlides.map((slide) => slide?.id).filter(Boolean))
      )
      const scheduleId =
        slides[0]?.scheduleId || this.currentState.activeSchedule?._id
      if (scheduleId) {
        cancelPendingScheduleShadowPuts(scheduleId)
        enqueueSlideShadowWrite("replace schedule slides", (repository) =>
          repository.replaceScheduleSlides(scheduleId, slides, {
            removeMissing: true,
          })
        )
      }
      this.futureStates = []
    },
    setActiveSlides(slides: Array<Slide>) {
      // console.log('setting active slides', this.currentState.activeSlides?.length)
      // onAppStateChange(this.pastStates, this.currentState)
      // console.log("setActiveSlides", slides)
      this.currentState.activeSlides = ensureUniqueIds(slides)
      if (
        this.currentState.activeOverlaySlide &&
        !this.currentState.activeSlides.some(
          (slide) =>
            slide.id === this.currentState.activeOverlaySlide?.id ||
            (slide._id && slide._id === this.currentState.activeOverlaySlide?._id)
        )
      ) {
        this.currentState.activeOverlaySlide = null
      }
      this.currentState.liveOutputSlidesId = Array.from(
        new Set(this.currentState.activeSlides.map((slide) => slide?.id).filter(Boolean))
      )
      this.futureStates = []
    },
    // setActiveSlideId(slideId: string) {
    //   this.currentState.activeSlideId = slideId
    // },
    setLiveOutputSlidesId(slides: Array<string>) {
      this.currentState.liveOutputSlidesId = Array.from(new Set(slides))
    },
    setLiveSlide(slide: string) {
      this.currentState.liveSlideId = slide
    },
    setEmitter(emitter: Emitter<Record<EventType, any>> | null) {
      this.currentState.emitter = emitter
    },
    setAppSettings(settings: AppSettings) {
      this.currentState.settings = {
        ...preserveDeviceNdiSetting(this.currentState.settings, settings),
        // NDI is a device capability, not an account preference. Preserve the
        // local value when server-backed settings or sign-out defaults omit it.
        transcriptionAutoActions: settings.transcriptionAutoActions ?? true,
        transcriptionVoiceBibleVersionCommands:
          settings.transcriptionVoiceBibleVersionCommands ?? true,
        uploadVideosToCloud: settings.uploadVideosToCloud ?? true,
      }
    },
    setSlideStyles(styles: SlideStyle) {
      if (shallowEqual(this.currentState.settings.slideStyles || {}, styles || {})) {
        return
      }
      this.currentState.settings = {
        ...this.currentState.settings,
        slideStyles: styles,
      }

      // Update slide styles in all active slides
      // this.currentState.activeSlides.forEach((slide) => {
      //   slide.slideStyle = {
      //     ...slide.slideStyle,
      //     textOutlined: styles.textOutlined, // only this property inherited for now
      //   }
      // })
    },
    setOverlaySettings(settings: OverlaySettings) {
      this.currentState.settings = {
        ...this.currentState.settings,
        overlaySettings: settings,
      }
    },
    setDefaultBibleVersion(version: string) {
      if (this.currentState.settings.defaultBibleVersion === version) return
      this.currentState.settings = {
        ...this.currentState.settings,
        defaultBibleVersion: version,
      }
    },
    setDefaultFont(font: string) {
      this.currentState.settings = {
        ...this.currentState.settings,
        defaultFont: font,
      }
    },
    setAlerts(alerts: Alert[]) {
      this.currentState.alerts = alerts
    },
    setActiveAlert(alert: Alert | null) {
      this.currentState.activeAlert = alert
    },
    setActiveOverlay(overlay: string) {
      this.currentState.activeOverlay = overlay
    },
    setActiveOverlaySlide(slide: Slide | null) {
      this.currentState.activeOverlaySlide = slide
    },
    setBackgroundVideos(bgVideos: BackgroundVideo[]) {
      this.currentState.backgroundVideos = bgVideos
    },
    setDefaultSlideBackgrounds() {
      if (this.currentState.backgroundVideos.length >= 4) {
        const bibleBackgroundVideo = this.currentState.backgroundVideos[2]
        const textBackgroundVideo = this.currentState.backgroundVideos[3]
        if (!bibleBackgroundVideo || !textBackgroundVideo) return

        this.currentState.settings.defaultBackground.hymn.background =
          this.currentState.settings.defaultBackground.bible.background =
          bibleBackgroundVideo.url
        this.currentState.settings.defaultBackground.text.background =
          textBackgroundVideo.url
      }
    },
    setRecentBibleSearches(searchQuery: string) {
      if (searchQuery) {
        let tempArr = [...this.currentState.recentBibleSearches]
        if (this.currentState.recentBibleSearches.length >= 20) {
          tempArr.shift()
          this.currentState.recentBibleSearches = tempArr
        }
        const tempSet = new Set(tempArr)
        tempSet.add(searchQuery)
        this.currentState.recentBibleSearches = Array.from(tempSet)
      }
    },
    setFailedUploadRequests(
      failedRequest: { path: string; options: any; timestamp: number } | null
    ) {
      const tempArr = this.currentState.failedUploadRequests ? [...this.currentState.failedUploadRequests] : []
      if (failedRequest) {
        tempArr.push(failedRequest)
        this.currentState.failedUploadRequests = tempArr
      }
    },
    removeFailedUploadRequest(
      failedRequest: { path: string; options: any; timestamp: number }
    ) {
      const index = this.currentState.failedUploadRequests.findIndex(
        (req) =>
          req.path === failedRequest.path &&
          req.timestamp === failedRequest.timestamp
      );
      if (index !== -1) {
        const tempArr = [...this.currentState.failedUploadRequests];
        tempArr.splice(index, 1);
        this.currentState.failedUploadRequests = tempArr;
      }
    },
    setSlidesLoading(loading: boolean) {
      this.currentState.slidesLoading = loading
    },
    setLastSynced(lastSynced: string) {
      this.currentState.lastSynced = lastSynced
    },
    setBannerVisible(bannerVisible: boolean) {
      this.currentState.bannerVisible = bannerVisible
    },
    setBibleVersions(bibleVersions: Array<BibleVersion>) {
      // console.log("bibleVersions", bibleVersions)
      // this.currentState.bibleVersions = []
      // this.currentState.bibleVersions = [...bibleVersions]
      this.currentState.settings = {
        ...this.currentState.settings,
        bibleVersions: bibleVersions,
      }
      usePosthogCapture("BIBLE_VERSIONS_SETTINGS_CHANGED")
    },
    setActiveSocket(socket: WebSocket) {
      this.currentState.activeSocket = socket
    },
    setMainDisplayLabel(label: string) {
      this.currentState.mainDisplayLabel = label
    },
    setMainDisplayScreen(screen: Screen | null) {
      this.currentState.mainDisplayScreen = screen
    },
    setStageDisplayLabel(label: string) {
      this.currentState.stageDisplayLabel = label
    },
    setStageDisplayScreen(screen: Screen | null) {
      this.currentState.stageDisplayScreen = screen
    },
    setDefaultMicrophone(deviceId: string) {
      this.currentState.defaultMicrophoneId = deviceId
    },
    setDefaultCamera(deviceId: string) {
      this.currentState.defaultCameraId = deviceId
    },
    setLiveWindowFullscreen(fullscreen: boolean) {
      this.currentState.settings = {
        ...this.currentState.settings,
        liveWindowFullscreen: fullscreen,
      }
      usePosthogCapture("LIVE_WINDOW_FULLSCREEN_SETTINGS_CHANGED")
    },
    setCloseLiveWindowWithOperator(value: boolean) {
      this.currentState.settings = {
        ...this.currentState.settings,
        closeLiveWindowWithOperator: value,
      }
    },
    setNdiEnabled(value: boolean) {
      this.currentState.settings = {
        ...this.currentState.settings,
        ndiEnabled: value,
      }
    },
    setLinesPerSlide(lines: number) {
      this.currentState.settings = {
        ...this.currentState.settings,
        slideStyles: {
          ...this.currentState.settings.slideStyles,
          linesPerSlide: lines,
        },
      }
      usePosthogCapture("LINES_PER_SLIDE_SETTINGS_CHANGED")
    },
    setAnimations(animations: boolean) {
      this.currentState.settings = {
        ...this.currentState.settings,
        animations: animations,
      }
      usePosthogCapture("ANIMATIONS_SETTINGS_CHANGED")
    },
    setMicroAnimations(microAnimations: boolean) {
      this.currentState.settings = {
        ...this.currentState.settings,
        microAnimations: microAnimations,
      }
      usePosthogCapture("MICRO_ANIMATIONS_SETTINGS_CHANGED")
    },
    setVerseTransitionStyle(verseTransitionStyle: "off" | "fade" | "slide-up") {
      this.currentState.settings = {
        ...this.currentState.settings,
        verseTransitionStyle: verseTransitionStyle,
      }
      usePosthogCapture("VERSE_TRANSITION_STYLE_SETTINGS_CHANGED")
    },
    setVerseTransitionInterval(interval: number) {
      this.currentState.settings = {
        ...this.currentState.settings,
        verseTransitionInterval: interval,
      }
      usePosthogCapture("VERSE_TRANSITION_INTERVAL_SETTINGS_CHANGED")
    },
    setFootnotes(footnotes: boolean) {
      this.currentState.settings = {
        ...this.currentState.settings,
        footnotes: footnotes,
      }
      usePosthogCapture("FOOTNOTES_SETTINGS_CHANGED")
    },
    setSongAndHymnLabelsVisibility(songAndHymnLabelsVisibility: boolean) {
      this.currentState.settings = {
        ...this.currentState.settings,
        songAndHymnLabelsVisibility: songAndHymnLabelsVisibility,
      }
      usePosthogCapture("SONG_AND_HYMN_LABELS_SETTINGS_CHANGED")
    },
    setUploadVideosToCloud(uploadVideosToCloud: boolean) {
      this.currentState.settings = {
        ...this.currentState.settings,
        uploadVideosToCloud: uploadVideosToCloud,
      }
      usePosthogCapture("UPLOAD_VIDEOS_TO_CLOUD_SETTINGS_CHANGED", {
        enabled: uploadVideosToCloud,
      })
    },
    // setMotionlessSlides(motionlessSlides: boolean) {
    //   this.currentState.settings = {
    //     ...this.currentState.settings,
    //     motionlessSlides: motionlessSlides,
    //   }
    //   usePosthogCapture("MOTIONLESS_SLIDES_SETTINGS_CHANGED")
    // },
    setTransitionInterval(interval: number) {
      this.currentState.settings = {
        ...this.currentState.settings,
        transitionInterval: interval,
      }
      usePosthogCapture("TRANSITION_INTERVAL_SETTINGS_CHANGED")
    },
    setWindowPadding(padding: {
      left?: number
      right?: number
      top?: number
      bottom?: number
    }) {
      this.currentState.settings = {
        ...this.currentState.settings,
        slideStyles: {
          ...this.currentState.settings.slideStyles,
          windowPadding: {
            ...this.currentState.settings.slideStyles.windowPadding,
            ...padding,
          },
        },
      }
      usePosthogCapture("WINDOW_PADDING_SETTINGS_CHANGED")
    },
    setActiveAdvert(advert: Advert | null) {
      this.currentState.activeAdvert = advert
    },
    setDefaultSlideBackground(
      type: string,
      background: string,
      backgroundVideoKey?: string | null,
      backgroundImageKey?: string | null
    ) {
      console.log(
        "setDefaultSlideBackground",
        type,
        background,
        backgroundVideoKey
      )
      this.currentState.settings = {
        ...this.currentState.settings,
        defaultBackground: {
          ...this.currentState.settings.defaultBackground,
          default: {
            backgroundType: type,
            background,
            backgroundVideoKey: backgroundVideoKey || null,
            backgroundImageKey: backgroundImageKey || null,
          },
        },
      }
      usePosthogCapture("DEFAULT_BACKGROUND_SETTINGS_CHANGED")
      // console.log("setDefaultSlideBackground", this.currentState.settings)
    },
    setIntermissionSettings(payload: AppSettings["intermission"]) {
      this.currentState.settings = {
        ...this.currentState.settings,
        intermission: {
          mode: "default",
          ...this.currentState.settings.intermission,
          ...payload,
        },
      }
      usePosthogCapture("INTERMISSION_SETTINGS_CHANGED")
    },
    // setActiveLiveWindows(windows: any[]) {
    //   this.activeLiveWindows = JSON.stringify(windows)
    // },
    signOut() {
      // Match the legacy sign-out behaviour, which removed all persisted
      // activeSlides, so another account on this device cannot inherit them.
      cancelAllPendingSlideShadowPuts()
      enqueueSlideShadowWrite("sign out", (repository) =>
        repository.clearAllSlides()
      )
      this.setSchedules([])
      this.setActiveSchedule(null)
      this.setActiveSlides([])
      this.setLiveOutputSlidesId([])
      this.setLiveSlide("")
      this.setEmitter(null)
      this.setAppSettings({
        appVersion: this.currentState.settings.appVersion, // preserve current version to avoid re-triggering changelog
        defaultBibleVersion: "KJV",
        defaultFont: "Inter",
        defaultBackground: {
          hymn: {
            backgroundType: "image",
            background: "https://images.unsplash.com/photo-1506056820413-f8fa4de15de6?q=80&w=1740",
            backgroundVideoKey: null
          },
          bible: {
            backgroundType: "image",
            background: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=1740",
            backgroundVideoKey: null
          },
          text: {
            backgroundType: "image",
            background: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1740",
            backgroundVideoKey: null
          },
        },
        slideStyles: {
          blur: 0.5,
          brightness: 50,
          linesPerSlide: 4,
          alignment: "center",
          windowPadding: { left: 24, right: 24, top: 24, bottom: 24 },
          lettercase: "",
          fontSizePercent: 100,
          textOutlined: false,
          textBold: false,
          textLinesBackground: false
        } as SlideStyle,
        bibleVersions: bibleVersionObjects, // Check app.vue for bible versions array in a list
        songAndHymnLabelsVisibility: false,
        transcriptionAutoActions: true,
        transcriptionVoiceBibleVersionCommands: true,
      })
      this.setBackgroundVideos([])
      this.setDefaultSlideBackgrounds()
      this.setAlerts([])
      this.setActiveAlert(null)
      this.setActiveOverlaySlide(null)
      this.setRecentBibleSearches("")
      this.setFailedUploadRequests(null)
      this.setSlidesLoading(false)
      this.setLastSynced(new Date().toISOString())
      this.setMainDisplayLabel("")
      this.setMainDisplayScreen(null)
      this.setStageDisplayLabel("")
      this.setStageDisplayScreen(null)
      this.currentState.onlineUsers = []
      this.currentState.slidesBeingEdited = {}
      this.refreshAppActionsStack()
      posthog.reset()
    },
    // Undo/Redo Actions
    setCurrentState(state: any) {
      this.currentState = { ...state }
      const scheduleId = this.currentState.activeSchedule?._id
      if (scheduleId) {
        cancelPendingScheduleShadowPuts(scheduleId)
        const scheduleSlides = this.currentState.activeSlides.filter(
          (slide) => slide.scheduleId === scheduleId
        )
        enqueueSlideShadowWrite("restore undo state", (repository) =>
          repository.replaceScheduleSlides(scheduleId, scheduleSlides, {
            removeMissing: true,
            preservePending: false,
            syncState: "pending",
          })
        )
      }
      // console.log("updated current state", this.currentState)
    },
    undo() {
      // console.log("undo action")
      if (this.pastStates.length) {
        this.futureStates.push(this.currentState)
        this.setCurrentState(this.pastStates.pop())
      }
    },
    redo() {
      // console.log("redo action")
      if (this.futureStates.length) {
        this.pastStates.push(this.currentState)
        this.setCurrentState(this.futureStates.pop())
      }
    },
    refreshAppActionsStack() {
      this.pastStates = []
      this.futureStates = []
    },
    setOnlineUsers(users: OnlineUser[]) {
      this.currentState.onlineUsers = users
    },
    addOnlineUser(user: OnlineUser) {
      const existingIndex = this.currentState.onlineUsers.findIndex(
        (u) => u.userId === user.userId
      )
      if (existingIndex === -1) {
        this.currentState.onlineUsers.push(user)
      }
    },
    removeOnlineUser(userId: string) {
      this.currentState.onlineUsers = this.currentState.onlineUsers.filter(
        (u) => u.userId !== userId
      )
    },
    setSlideBeingEdited(
      slideId: string,
      user: { userId: string; userName: string; avatar?: string; theme?: string }
    ) {
      this.currentState.slidesBeingEdited[slideId] = { ...user }
    },
    clearSlideBeingEdited(slideId: string) {
      delete this.currentState.slidesBeingEdited[slideId]
    },
    clearAllSlidesBeingEdited() {
      this.currentState.slidesBeingEdited = {}
    },
    triggerUserJoinedAnimation(user: OnlineUser) {
      const nuxtApp = useNuxtApp()
      const emitter = nuxtApp.$emitter as any
      if (emitter) {
        emitter.emit('user-joined-animation', user)
      }
    },
    // Update a specific slide in the active slides array (for realtime updates)
    updateSlideInActiveSlides(updatedSlide: Slide) {
      const slideIndex = this.currentState.activeSlides.findIndex(
        (s) =>
          s.id === updatedSlide.id ||
          (!!updatedSlide._id && s._id === updatedSlide._id)
      )
      if (slideIndex !== -1) {
        const existingSlide = this.currentState.activeSlides[slideIndex]
        this.currentState.activeSlides.splice(slideIndex, 1, {
          ...existingSlide,
          ...updatedSlide,
        })
      }
    },
  },
  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
    serializer: appStateSerializer,
    // Undo history remains memory-only. appStateSerializer also removes
    // activeSlides because SlideRepository is now its durable store.
    pick: ["currentState", "panelSizes", "panelSizesTouched"],
  },
  share: {
    enable: true,
    // Undo history is per-window. The outgoing serializer also removes it and
    // activeSlides before pinia-shared-state sends the snapshot.
    omit: ["pastStates", "futureStates"],
  },
})
