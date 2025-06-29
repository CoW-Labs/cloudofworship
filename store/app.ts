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
} from "~/types/index"
import type { Emitter, EventType } from "mitt"
import { bibleVersionObjects } from "~/utils/constants"
import { useThrottleFn } from "@vueuse/core"
import posthog from "posthog-js"

// console.log(usePinia())
function ensureUniqueIds(arr: Slide[]): Slide[] {
  const seenIds = new Set()
  return arr.filter((obj) => {
    if (seenIds.has(obj.id)) {
      return false
    } else {
      seenIds.add(obj.id)
      return true
    }
  })
}

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
  },
  1500
)

export const useAppStore = defineStore("app", {
  state: (): {
    currentState: AppState
    pastStates: AppState[]
    futureStates: AppState[]
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
              backgroundType: "video",
              background: "/video-bg-1.mp4",
              backgroundVideoKey: "/video-bg-1.mp4",
            },
            bible: {
              backgroundType: "video",
              background: "/video-bg-3.mp4",
              backgroundVideoKey: "/video-bg-3.mp4",
            },
            text: {
              backgroundType: "video",
              background: "/video-bg-4.mp4",
              backgroundVideoKey: "/video-bg-4.mp4",
            },
          },
          animations: true,
          footnotes: true,
          songAndHymnLabelsVisibility: true,
          motionlessSlides: false,
          transitionInterval: 0.7,
          slideStyles: {
            blur: 0.5,
            brightness: 50,
            linesPerSlide: 4,
            alignment: "center",
            windowPadding: { left: 24, right: 24, top: 24, bottom: 24 },
            lettercase: "",
            lineSpacing: "normal",
          },
          bibleVersions: [], // Check app.vue for bible versions array in a list
          alertLimit: 5,
        },
        backgroundVideos: [],
        alerts: [],
        activeAlert: null,
        activeOverlay: "",
        recentBibleSearches: [],
        failedUploadRequests: [],
        slidesLoading: false,
        lastSynced: new Date().toISOString(),
        bannerVisible: true,
        bibleVersions: bibleVersionObjects, // Check app.vue for bible versions array in a list
        activeSocket: null,
        mainDisplayLabel: "",
        mainDisplayScreen: null,
        // activeLiveWindows: [] as any[]
      },
      // Undo/Redo stacks
      pastStates: [],
      futureStates: [],
    }
  },
  getters: {
    activeScheduleSlides: (state) =>
      state.currentState.activeSlides?.filter(
        (slide) => slide.scheduleId === state.currentState.activeSchedule?._id
      ),
    bibleVersions: (state) => state.currentState.settings.bibleVersions,
  },
  actions: {
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
        if (position && position >= 0) {
          this.currentState.activeSlides.splice(position, 0, slide)
        } else {
          this.currentState.activeSlides.push(slide)
        }
        this.currentState.liveOutputSlidesId = Array.from(
          new Set(this.currentState.activeSlides.map((slide) => slide?.id))
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
        new Set(this.currentState.activeSlides.map((slide) => slide.id))
      )
      this.futureStates = []
    },
    removeActiveSlide(slide: Slide) {
      // console.log('removing active slides', this.currentState.activeSlides?.length)
      onAppStateChange(this.pastStates, this.currentState, "activeSlides", [
        ...this.currentState.activeSlides,
      ])
      // onAppStateChange(this.pastStates, this.currentState)
      this.currentState.activeSlides.splice(
        this.currentState.activeSlides.findIndex((s) => s.id === slide.id),
        1
      )
      // console.log("removing active slide", this.currentState.activeSlides)
      this.currentState.liveOutputSlidesId = Array.from(
        new Set(this.currentState.activeSlides.map((slide) => slide.id))
      )
      this.futureStates = []
    },
    replaceScheduleActiveSlides(slides: Array<Slide>) {
      // console.log('replacing schedule active slides', this.currentState.activeSlides?.length)
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
        new Set(this.currentState.activeSlides.map((slide) => slide.id))
      )
      this.futureStates = []
    },
    setActiveSlides(slides: Array<Slide>) {
      // console.log('setting active slides', this.currentState.activeSlides?.length)
      // onAppStateChange(this.pastStates, this.currentState)
      // console.log("setActiveSlides", slides)
      this.currentState.activeSlides = ensureUniqueIds(slides)
      this.currentState.liveOutputSlidesId = Array.from(
        new Set(this.currentState.activeSlides.map((slide) => slide.id))
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
      this.currentState.settings = settings
    },
    setSlideStyles(styles: SlideStyle) {
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
    setDefaultBibleVersion(version: string) {
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
    setBackgroundVideos(bgVideos: BackgroundVideo[]) {
      this.currentState.backgroundVideos = bgVideos
      this.currentState.settings.defaultBackground.hymn.background =
        bgVideos?.[0]?.url
      this.currentState.settings.defaultBackground.bible.background =
        bgVideos?.[2]?.url
      this.currentState.settings.defaultBackground.text.background =
        bgVideos?.[3]?.url
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
      failedRequest: { path: string; options: any } | null
    ) {
      if (failedRequest) {
        this.currentState.failedUploadRequests.push(failedRequest)
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
    setMotionlessSlides(motionlessSlides: boolean) {
      this.currentState.settings = {
        ...this.currentState.settings,
        motionlessSlides: motionlessSlides,
      }
      usePosthogCapture("MOTIONLESS_SLIDES_SETTINGS_CHANGED")
    },
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
      backgroundVideoKey?: string | null
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
          },
        },
      }
      usePosthogCapture("DEFAULT_BACKGROUND_SETTINGS_CHANGED")
      // console.log("setDefaultSlideBackground", this.currentState.settings)
    },
    // setActiveLiveWindows(windows: any[]) {
    //   this.activeLiveWindows = JSON.stringify(windows)
    // },
    signOut() {
      this.setSchedules([])
      this.setActiveSchedule(null)
      this.setActiveSlides([])
      this.setLiveOutputSlidesId([])
      this.setLiveSlide("")
      this.setEmitter(null)
      this.setAppSettings({
        appVersion: "0.1.0",
        defaultBibleVersion: "KJV",
        defaultFont: "Inter",
        defaultBackground: {
          hymn: {
            backgroundType: "video",
            background: "/video-bg-1.mp4",
            backgroundVideoKey: "/video-bg-1.mp4",
          },
          bible: {
            backgroundType: "video",
            background: "/video-bg-3.mp4",
            backgroundVideoKey: "/video-bg-3.mp4",
          },
          text: {
            backgroundType: "video",
            background: "/video-bg-4.mp4",
            backgroundVideoKey: "/video-bg-4.mp4",
          },
        },
        slideStyles: {
          blur: 0.5,
          brightness: 50,
          linesPerSlide: 4,
          alignment: "center",
          windowPadding: { left: 24, right: 24, top: 24, bottom: 24 },
          lettercase: "",
        } as SlideStyle,
        bibleVersions: bibleVersionObjects, // Check app.vue for bible versions array in a list
        songAndHymnLabelsVisibility: true,
      })
      this.setBackgroundVideos([])
      this.setAlerts([])
      this.setActiveAlert(null)
      this.setRecentBibleSearches("")
      this.setFailedUploadRequests(null)
      this.setSlidesLoading(false)
      this.setLastSynced(new Date().toISOString())
      posthog.reset()
    },
    // Undo/Redo Actions
    setCurrentState(state: any) {
      this.currentState = { ...state }
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
  },
  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
  },
  share: {
    enable: true,
  },
})
