import { defineStore } from 'pinia'
import type { Alert, AppSettings, BackgroundVideo, Schedule, Slide, SlideStyle } from '~/types/index'
import type { Emitter } from 'mitt'

// console.log(usePinia())
function ensureUniqueIds(arr: Slide[]): Slide[] {
  const seenIds = new Set();
  return arr.filter(obj => {
    if (seenIds.has(obj.id)) {
      return false;
    } else {
      seenIds.add(obj.id);
      return true;
    }
  });
}

export const useAppStore = defineStore('app', {
  state: () => {
    return {
      schedules: [] as Array<Schedule>,
      activeSchedule: null as Schedule | null,
      activeSlides: [] as Array<Slide>, // Returns all slides on CoW
      liveOutputSlidesId: null as Array<string> | null,
      liveSlideId: null as string | null,
      emitter: null as Emitter | null,
      settings: {
        appVersion: '0.1.0',
        defaultBibleVersion: 'KJV',
        defaultFont: 'Inter',
        defaultBackground: {
          hymn: {
            backgroundType: "video",
            background: '/video-bg-1.mp4',
            backgroundVideoKey: '/video-bg-1.mp4'
          },
          bible: {
            backgroundType: "video",
            background: '/video-bg-3.mp4',
            backgroundVideoKey: '/video-bg-3.mp4'
          },
          text: {
            backgroundType: "video",
            background: '/video-bg-4.mp4',
            backgroundVideoKey: '/video-bg-4.mp4'
          }
        },
        slideStyles: { blur: 0.5, brightness: 50, linesPerSlide: 4, alignment: 'center' } as SlideStyle,
        bibleVersions: [] as Array<any>, // Check app.vue for bible versions array in a list
      },
      backgroundVideos: [] as BackgroundVideo[],
      alerts: [] as Alert[],
      activeAlert: null as Alert | null,
      recentBibleSearches: [] as string[],
      failedUploadRequests: [] as { path: string, options: any }[],
      slidesLoading: false as boolean,
      lastSynced: new Date().toISOString() as string,
      bannerVisible: true as boolean,
      bibleVersions: [] as Array<any>, // Check app.vue for bible versions array in a list
      activeSocket: null as WebSocket | null,
      // activeLiveWindows: [] as any[]
    }
  },
  getters: {
    activeScheduleSlides: (state) => state.activeSlides?.filter(slide => slide.scheduleId === (state.activeSchedule?._id)),
    bibleVersions: (state) => state.settings.bibleVersions
  },
  actions: {
    setSchedules(schedules: Schedule[]) {
      this.schedules = schedules
      if (this.activeSchedule) {
        const tempSchedule = schedules.find(sch => sch?._id === this.activeSchedule?._id) as Schedule
        // console.log("tempSchedule", tempSchedule)
        this.activeSchedule = tempSchedule
      }
    },
    setActiveSchedule(schedule: Schedule) {
      this.activeSchedule = schedule
      const existingSchedule = this.schedules.find(sch => sch?._id === schedule?._id)
      if (!existingSchedule) {
        this.schedules.push(schedule)
      } else {
        this.schedules.splice(this.schedules.findIndex(sch => sch?._id === schedule?._id), 1, schedule)
      }
    },
    appendActiveSlide(slide: Slide, position?: number) {
      if (!this.activeSlides.find(s => s?.id === slide?.id)) {
        if (position && position >= 0) {
          this.activeSlides.splice(position, 0, slide)
        } else {
          this.activeSlides.push(slide)
        }
        this.liveOutputSlidesId = Array.from(new Set(this.activeSlides.map(slide => slide?.id)))
      }
    },
    appendActiveSlides(slides: Array<Slide>) {
      let tempSlides = [...this.activeSlides]
      tempSlides.push(...slides)
      this.activeSlides = ensureUniqueIds(tempSlides)
      this.liveOutputSlidesId = Array.from(new Set(this.activeSlides.map(slide => slide.id)))
    },
    removeActiveSlide(slide: Slide) {
      this.activeSlides.splice(this.activeSlides.findIndex(s => s.id === slide.id), 1)
      // console.log("removing active slide", this.activeSlides)
      this.liveOutputSlidesId = Array.from(new Set(this.activeSlides.map(slide => slide.id)))
    },
    replaceScheduleActiveSlides(slides: Array<Slide>) {
      let tempSlides = [...this.activeSlides]
      tempSlides = tempSlides.filter(slide => slide.scheduleId !== (this.activeSchedule?._id))
      // console.log("tempSlides", tempSlides)
      tempSlides.push(...slides)
      this.activeSlides = ensureUniqueIds(tempSlides)
      // console.log("replacing schedule active slides - p2", this.activeSlides)
      this.liveOutputSlidesId = Array.from(new Set(this.activeSlides.map(slide => slide.id)))
    },
    setActiveSlides(slides: Array<Slide>) {
      // console.log("setActiveSlides", slides)
      this.activeSlides = ensureUniqueIds(slides)
      this.liveOutputSlidesId = Array.from(new Set(this.activeSlides.map(slide => slide.id)))
    },
    // setActiveSlideId(slideId: string) {
    //   this.activeSlideId = slideId
    // },
    setLiveOutputSlidesId(slides: Array<string>) {
      this.liveOutputSlidesId = Array.from(new Set(slides))
    },
    setLiveSlide(slide: string) {
      this.liveSlideId = slide
    },
    setEmitter(emitter: Emitter) {
      this.emitter = emitter
    },
    setAppSettings(settings: AppSettings) {
      this.settings = settings
    },
    setSlideStyles(styles: SlideStyle) {
      this.settings = { ...this.settings, slideStyles: styles }
    },
    setDefaultBibleVersion(version: string) {
      this.settings = { ...this.settings, defaultBibleVersion: version }
    },
    setDefaultFont(font: string) {
      this.settings = { ...this.settings, defaultFont: font }
    },
    setAlerts(alerts: Alert[]) {
      this.alerts = alerts
    },
    setActiveAlert(alert: Alert | null) {
      this.activeAlert = alert
    },
    setBackgroundVideos(bgVideos: BackgroundVideo[]) {
      this.backgroundVideos = bgVideos
      this.settings.defaultBackground.hymn.background = bgVideos?.[0]?.url
      this.settings.defaultBackground.bible.background = bgVideos?.[2]?.url
      this.settings.defaultBackground.text.background = bgVideos?.[3]?.url
    },
    setRecentBibleSearches(searchQuery: string) {
      let tempArr = [...this.recentBibleSearches]
      if (this.recentBibleSearches.length >= 20) {
        tempArr.shift()
        this.recentBibleSearches = tempArr
      }
      const tempSet = new Set(tempArr)
      tempSet.add(searchQuery)
      this.recentBibleSearches = Array.from(tempSet)
    },
    setFailedUploadRequests(failedRequest: { path: string, options: any }) {
      this.failedUploadRequests.push()
    },
    setSlidesLoading(loading: boolean) {
      this.slidesLoading = loading
    },
    setLastSynced(lastSynced: string) {
      this.lastSynced = lastSynced
    },
    setBannerVisible(bannerVisible: boolean) {
      this.bannerVisible = bannerVisible
    },
    setBibleVersions(bibleVersions: Array<any>) {
      // this.bibleVersions = []
      // this.bibleVersions = [...bibleVersions]
      this.settings = { ...this.settings, bibleVersions: bibleVersions }
    },
    setActiveSocket(socket: WebSocket) {
      this.activeSocket = socket
    },
    // setActiveLiveWindows(windows: any[]) {
    //   this.activeLiveWindows = JSON.stringify(windows)
    // },
    signOut() {
      this.setSchedules([])
      this.setActiveSchedule(null)
      this.setActiveSlides([])
      this.setLiveOutputSlidesId([])
      this.setLiveSlide('')
      this.setEmitter(null)
      this.setAppSettings({
        appVersion: '0.1.0',
        defaultBibleVersion: 'KJV',
        defaultFont: 'Inter',
        defaultBackground: {
          hymn: {
            backgroundType: "video",
            background: '/video-bg-1.mp4',
            backgroundVideoKey: '/video-bg-1.mp4'
          },
          bible: {
            backgroundType: "video",
            background: '/video-bg-3.mp4',
            backgroundVideoKey: '/video-bg-3.mp4'
          },
          text: {
            backgroundType: "video",
            background: '/video-bg-4.mp4',
            backgroundVideoKey: '/video-bg-4.mp4'
          }
        },
        slideStyles: { blur: 0.5, brightness: 50 } as SlideStyle
      })
      this.setBackgroundVideos([])
      this.setAlerts([])
      this.setActiveAlert(null)
      this.setRecentBibleSearches([])
      this.setFailedUploadRequests([])
      this.setSlidesLoading(false)
      this.setLastSynced(new Date().toISOString())
    }
  },
  persist: {
    storage: persistedState.localStorage
  },
  share: {
    enable: true,
  }
}) 