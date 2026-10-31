import type { Component } from "vue"
import CameraIntroAnimation from "~/components/intros/CameraIntroAnimation.vue"
import InterludeIntroAnimation from "~/components/intros/InterludeIntroAnimation.vue"
import SlidePairIntroAnimation from "~/components/intros/SlidePairIntroAnimation.vue"

/**
 * Looping hero animations for new-feature intros, keyed by
 * `QuickActionIntro.animation`. Imported explicitly: a dynamic <component>
 * can't resolve auto-imported components by name.
 */
export const INTRO_ANIMATIONS: Record<string, Component> = {
  interlude: InterludeIntroAnimation,
  camera: CameraIntroAnimation,
  "slide-pair": SlidePairIntroAnimation,
}
