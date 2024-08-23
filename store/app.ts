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
        slideStyles: { blur: 0.5, brightness: 50, linesPerSlide: 4 } as SlideStyle
      },
      backgroundVideos: [] as BackgroundVideo[],
      alerts: [] as Alert[],
      activeAlert: null as Alert | null,
      recentBibleSearches: [] as string[],
      failedUploadRequests: [] as { path: string, options: any }[],
      slidesLoading: false as boolean,
      lastSynced: new Date().toISOString() as string,
      bannerVisible: true as boolean,
      bibleVersions: [
        { id: 'KJV', name: 'King James Version', isDownloaded: false, copyrightContent: '' },
        { id: 'NKJV', name: 'New King James Version', isDownloaded: false, copyrightContent: 'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. All rights reserved.' },
        { id: 'NIV', name: 'New International Version', isDownloaded: false, copyrightContent: 'Scriptures taken from the Holy Bible, New International Version®, NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ All rights reserved worldwide.' },
        { id: 'AMP', name: 'Amplified Bible', isDownloaded: false, copyrightContent: 'All Scripture quotations, unless otherwise indicated, are taken from the Amplified Bible, Copyright © 2015 by The Lockman Foundation.' },
        { id: 'NLT', name: 'New Living Translation', isDownloaded: false, copyrightContent: 'Scripture quotations marked (NLT) are taken from the Holy Bible, New Living Translation, copyright ©1996, 2004, 2015 by Tyndale House Foundation.' },
        // { id: 'TPT', name: 'The Passion Translation', isDownloaded: false, copyrightContent: '' },
        // { id: 'GNT', name: 'Good News Translation', isDownloaded: false, copyrightContent: '' },
        // { id: 'CEV', name: 'Contemporary English Version', isDownloaded: false, copyrightContent: '' },
      ]
    }
  },
  getters: {
    activeScheduleSlides: (state) => state.activeSlides?.filter(slide => slide.scheduleId === (state.activeSchedule?._id))
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
      this.bibleVersions = bibleVersions
    },
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