import { defineStore } from 'pinia'
import type { Alert, AppSettings, Slide, SlideStyle } from '~/types/index'
import type { Emitter } from 'mitt'

// console.log(usePinia())

export const useAppStore = defineStore('app', {
  state: () => {
    return {
      activeSlides: [] as Array<Slide>,
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
            background: '/video-bg-1.mp4'
          },
          bible: {
            backgroundType: "video",
            background: '/video-bg-3.mp4'
          },
          text: {
            backgroundType: "video",
            background: '/video-bg-4.mp4'
          }
        },
        slideStyles: { blur: 0.5, brightness: 50 } as SlideStyle
      },
      backgroundVideos: [] as string[],
      alert: null as Alert | null,
      copyrightContent: {
        'KJV': '',
        'NKJV': 'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. All rights reserved.',
        'NIV': 'Scriptures taken from the Holy Bible, New International Version®, NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ All rights reserved worldwide.',
        'AMP': 'All Scripture quotations, unless otherwise indicated, are taken from the Amplified Bible, Copyright © 2015 by The Lockman Foundation.'
      }
    }
  },
  actions: {
    setActiveSlides(slides: Array<Slide>) {
      this.activeSlides = slides
      this.liveOutputSlidesId = slides?.map(slide => slide.id)
    },
    // setActiveSlideId(slideId: string) {
    //   this.activeSlideId = slideId
    // },
    setLiveOutputSlidesId(slides: Array<string>) {
      this.liveOutputSlidesId = slides
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
    setAlert(alert: Alert | null) {
      this.alert = alert
    },
    setBackgroundVideos(bgVideos: string[]) {
      this.backgroundVideos = bgVideos
      this.settings.defaultBackground.hymn.background = bgVideos?.[0]
      this.settings.defaultBackground.bible.background = bgVideos?.[2]
      this.settings.defaultBackground.text.background = bgVideos?.[3]
    }
  },
  persist: {
    storage: persistedState.localStorage
  },
  share: {
    enable: true,
    initialize: true
  }
}) 