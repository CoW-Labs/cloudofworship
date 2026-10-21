<template>
  <div
    ref="root"
    class="live-pair-projection relative w-full overflow-hidden bg-black"
    :class="[
      fullScreen ? 'h-[100vh]' : 'h-full min-h-[120px] rounded-2xl',
      { 'live-pair-projection--still': !animationsOn },
    ]"
    :style="motionVars"
    @dblclick="activateFullScreen"
  >
    <audio ref="micEl" class="hidden" autoplay playsinline></audio>

    <!-- PAIR BACKGROUND — the pair's own backdrop, never a member's. Only the
         side-by-side layout leaves any of it uncovered. -->
    <div
      class="pair-backdrop absolute inset-0 bg-cover bg-center bg-no-repeat"
      :class="{
        'pair-backdrop--hidden': layout !== 'side-by-side' || !!soloRole,
      }"
      :style="backdropStyle"
    >
      <!-- Removed once faded out (another layout, or one member alone), so
           a backdrop nobody sees is not decoding. -->
      <BackgroundVideo
        v-if="
          backdropVideoMounted &&
          backdrop.backgroundType === backgroundTypes.video &&
          backdropUrl
        "
        :source="backdropUrl"
        :repeat="true"
        :visible="true"
      />
    </div>

    <!-- One region per role, keyed by role. Every layout positions the same
         two elements, so a layout change only moves them (see the FLIP
         animation below): nothing remounts and a member's video or camera
         keeps running. A member changing inside a role crossfades in
         LiveProjectionOnly as it does for a single slide. -->
    <div
      v-for="role in ROLES"
      v-show="members[role]"
      :key="role"
      :ref="(el) => setRegion(role, el as HTMLElement | null)"
      class="pair-region absolute"
      :class="`pair-region--${role}`"
      :style="regionStyle(role)"
    >
      <div class="pair-card relative h-full w-full" :style="cardStyle(role)">
        <div
          class="pair-card__clip relative h-full w-full overflow-hidden"
          :style="clipStyle(role)"
        >
        <div
          :ref="(el) => setContent(role, el as HTMLElement | null)"
          class="pair-content h-full w-full"
        >
        <!-- A member taken off the screen fades out, then is removed, so its
             video, camera or interlude stops drawing. It is mounted again the
             moment it is shown, and its media picks up where it stopped. -->
        <LiveProjectionOnly
          v-if="members[role] && roleMounted[role]"
          embedded
          hide-global-layers
          :content-visible="true"
          :full-screen="fullScreen"
          :slide="members[role]"
          :slide-label="false"
          :slide-styles="slideStyles"
          :audio-muted="isMemberMuted(members[role]!)"
          :camera-mode="cameraMode"
          :camera-resolution="
            !soloRole && role === 'frame' && layout === 'picture-in-picture'
              ? 'inset'
              : 'full'
          "
          :hide-background="
            !soloRole && role === 'text' && layout === 'caption'
          "
          :text-shadow="!soloRole && role === 'text' && layout === 'caption'"
          :fit-text="
            !soloRole &&
            role === 'text' &&
            (layout === 'caption' || layout === 'lower-third')
          "
          :fill-media="
            !soloRole &&
            role === 'frame' &&
            (layout === 'side-by-side' || layout === 'picture-in-picture')
          "
          class="h-full w-full"
        />
        </div>
        </div>
      </div>
    </div>

    <!-- The slide name and LIVE pill sit over the whole pair, where a single
         slide has them. -->
    <template v-if="slideLabel">
      <div class="overlay-gradient absolute inset-0 z-20 pointer-events-none" />
      <div class="heading p-3 absolute inset-0 z-20 pointer-events-none">
        <h5
          class="font-semibold text-white overflow-hidden truncate w-48 2xl:w-64"
        >
          {{ activeMember?.name || "No Live Slide" }}
        </h5>
        <LiveSlideIndicator :visible="!!activeMember?.name" class="mr-4 mt-4" />
      </div>
    </template>

    <!-- Screen-wide layers, once over the whole pair rather than per member. -->
    <OverlaySlideView
      :size="fullScreen ? '' : 'sm'"
      :dynamic-background="
        slides.some((slide) => slide.backgroundType === backgroundTypes.video)
      "
    />
    <AlertView :size="fullScreen ? '' : 'sm'" />
    <FallingSnowView
      v-if="fullScreen && currentState.activeOverlay === 'falling-snow'"
    />
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Slide, SlidePairLayout, SlideStyle } from "~/types"
import {
  PAIR_LAYOUT_GEOMETRY,
  type PairRole,
  activeMemberOf,
  PAIR_CARD_COLOUR,
  pairAudioOwner,
  pairBackgroundOf,
  pairRoles,
} from "~/utils/slidePairs"
import { holdMediaPosition } from "~/composables/useMediaHandoff"
import {
  exitFullscreenSafely,
  requestFullscreenSafely,
} from "~/utils/browserSafety"

/**
 * A live slide pair, drawn to the four pair designs. One member is the
 * picture (`frame`), the other the words (`text`); see `pairRoles`. Each is a
 * whole LiveProjectionOnly with its own content, background and media. The
 * layout only places and decorates them, through props that exist for pairs
 * and are off for every single slide, so no member's own look is changed.
 *
 * Geometry is measured off the 1920×1080 designs and kept in % of the screen
 * (positions) and cqw (borders, lips, radii), so the operator thumbnail is the
 * projector in miniature.
 */
const ROLES: PairRole[] = ["text", "frame"]
type Role = PairRole

const props = withDefaults(
  defineProps<{
    slides: Slide[]
    fullScreen: boolean
    slideStyles: SlideStyle
    slideLabel?: boolean
    /** Mutes every member, e.g. the operator's thumbnail. */
    audioMuted?: boolean
    cameraMode?: "capture" | "preview" | "placeholder"
  }>(),
  { cameraMode: "placeholder", slideLabel: false, audioMuted: false }
)

const appStore = useAppStore()
const route = useRoute()
const { currentState } = storeToRefs(appStore)

const stamp = computed(() => props.slides[0]?.livePair)
const layout = computed<SlidePairLayout>(
  () => stamp.value?.layout || "side-by-side"
)
const members = computed(() => pairRoles(props.slides))
const activeMember = computed(() => activeMemberOf(props.slides))

/**
 * An unmuted media file is heard; a camera's microphone only when the operator
 * turned it on for the pair (`audioSlideId`, see pairAudioOwner). Everything
 * else is silent, as is a member off the screen or one muted in its own slide
 * settings.
 */
const audioOwner = computed(() =>
  pairAudioOwner(
    props.slides,
    stamp.value?.hiddenSlideId,
    stamp.value?.audioSlideId
  )
)
const isMemberMuted = (member: Slide) =>
  props.audioMuted ||
  audioOwner.value?.source !== "media" ||
  audioOwner.value.slideId !== member.id

// A camera slide's picture is opened without audio (see useCameraStream), so
// its microphone is played from here: only on the real output, only when the
// operator turned it on for this pair, and only while no media file is heard.
// The mic is the operator's chosen one; permission was asked for in the
// operator window when it was turned on, so no prompt reaches the projector.
const micEl = ref<HTMLAudioElement | null>(null)
let micStream: MediaStream | null = null
const stopMic = () => {
  micStream?.getTracks().forEach((track) => track.stop())
  micStream = null
  if (micEl.value) micEl.value.srcObject = null
}
const wantsMic = computed(
  () =>
    props.cameraMode === "capture" &&
    !props.audioMuted &&
    audioOwner.value?.source === "mic"
)
watch(
  [wantsMic, () => currentState.value.defaultMicrophoneId],
  async ([wanted, deviceId]) => {
    stopMic()
    if (!wanted || !navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
        },
      })
      // The pair moved on while the permission prompt was open.
      if (!wantsMic.value) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      micStream = stream
      if (micEl.value) {
        micEl.value.srcObject = stream
        void micEl.value.play().catch(() => {})
      }
    } catch {
      // No mic or permission refused: the camera just plays silent.
    }
  },
  { immediate: true }
)
onBeforeUnmount(stopMic)

// ── Geometry ────────────────────────────────────────────────────────────────
// One table, shared with the layout tiles in the Pair panel: see
// PAIR_LAYOUT_GEOMETRY in utils/slidePairs.

// With one member taken off the screen, the other fills it as a plain slide:
// full screen, no card. The hidden one fades out where it stands, so showing
// it again brings it back into its place in the layout.
const hiddenRole = computed<Role | null>(() => {
  const hiddenId = stamp.value?.hiddenSlideId
  if (!hiddenId) return null
  if (members.value.frame?.id === hiddenId) return "frame"
  if (members.value.text?.id === hiddenId) return "text"
  return null
})
const soloRole = computed<Role | null>(() =>
  hiddenRole.value ? (hiddenRole.value === "frame" ? "text" : "frame") : null
)

// Which members are mounted. A hidden one stays mounted for its fade, then
// goes (see the template). Its media position is held, so showing it again
// carries on from the same point rather than the start.
const roleMounted = reactive<Record<Role, boolean>>({ text: true, frame: true })
const unmountTimers: Partial<Record<Role, ReturnType<typeof setTimeout>>> = {}
watch(
  hiddenRole,
  (hidden, previous) => {
    ROLES.forEach((role) => {
      clearTimeout(unmountTimers[role])
      if (role !== hidden) {
        roleMounted[role] = true
        return
      }
      const memberId = members.value[role]?.id
      const unmount = () => {
        roleMounted[role] = false
        if (memberId) nextTick(() => holdMediaPosition(memberId))
      }
      // Hidden from the start: never mounted. Hidden now: after the fade.
      if (previous === undefined) unmount()
      else unmountTimers[role] = setTimeout(unmount, FADE_MS + 50)
    })
  },
  { immediate: true }
)
onBeforeUnmount(() => ROLES.forEach((role) => clearTimeout(unmountTimers[role])))

const placement = (role: Role) =>
  soloRole.value === role
    ? { box: { top: 0, left: 0, width: 100, height: 100 }, card: undefined, z: 1 }
    : PAIR_LAYOUT_GEOMETRY[layout.value][role]

const regionStyle = (role: Role) => {
  const { box, z } = placement(role)
  const hidden = hiddenRole.value === role
  return {
    top: `${box.top}%`,
    left: `${box.left}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
    zIndex: hidden ? 0 : z,
    opacity: hidden ? 0 : 1,
    pointerEvents: hidden ? ("none" as const) : undefined,
  }
}

// The card is the border: its own colour showing round the member, which
// sits inset by the border width. The lip is a hard, unblurred shadow of the
// same colour hanging below it, as in the designs. Always the pair purple,
// never taken from a member slide.
const cardStyle = (role: Role) => {
  const card = placement(role).card
  if (!card) return undefined
  // Read from the text slide, never written back.
  const colour = PAIR_CARD_COLOUR
  return {
    borderRadius: `${card.radius}cqw`,
    padding: card.border ? `${card.border}cqw` : undefined,
    backgroundColor: card.border ? colour : undefined,
    boxShadow: card.lip ? `0 ${card.lip}cqw 0 0 ${colour}` : undefined,
  }
}

// Rounds the member to the inside of the border.
const clipStyle = (role: Role) => {
  const card = placement(role).card
  if (!card) return undefined
  return { borderRadius: `max(0px, ${card.radius - card.border}cqw)` }
}

// ── Pair background ─────────────────────────────────────────────────────────
const backdrop = computed(() => pairBackgroundOf(stamp.value))

// Uploaded media resolves to a copy on this device, as the blank screen's
// background does. Plain colours, gradients and hosted URLs are used as given.
const { rehydrateSlideMedia } = useSlideMediaCache()
const localMedia = useLocalMediaStorage()
const resolvedBackdrop = ref<string | null>(null)

watch(
  () =>
    [
      backdrop.value.background,
      backdrop.value.backgroundType,
      backdrop.value.backgroundImageKey,
      backdrop.value.backgroundVideoKey,
      stamp.value?.pairId,
    ] as const,
  async ([background, backgroundType, imageKey, videoKey, pairId]) => {
    const previous = resolvedBackdrop.value
    if (!imageKey && !videoKey) {
      resolvedBackdrop.value = null
      localMedia.releasePlaybackUrl(previous)
      return
    }
    try {
      const resolved = await rehydrateSlideMedia(
        {
          id: `__pair-background__${pairId}`,
          type: slideTypes.text,
          backgroundType,
          background,
          backgroundImageKey: imageKey,
          backgroundVideoKey: videoKey,
        } as unknown as Slide,
        { allowDownload: true }
      )
      resolvedBackdrop.value = resolved.background || null
      if (previous && previous !== resolvedBackdrop.value) {
        localMedia.releasePlaybackUrl(previous)
      }
    } catch (error) {
      console.warn("Pair background could not be resolved:", error)
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => localMedia.releasePlaybackUrl(resolvedBackdrop.value))

// The backdrop shows only behind side by side with both members up. Its video
// is removed once the backdrop has faded out, and back the moment it shows.
const backdropVisible = computed(
  () => layout.value === "side-by-side" && !soloRole.value
)
const backdropVideoMounted = ref(backdropVisible.value)
let backdropTimer: ReturnType<typeof setTimeout> | undefined
watch(backdropVisible, (visible) => {
  clearTimeout(backdropTimer)
  if (visible) backdropVideoMounted.value = true
  else backdropTimer = setTimeout(() => (backdropVideoMounted.value = false), MOVE_MS + 50)
})
onBeforeUnmount(() => clearTimeout(backdropTimer))

const backdropUrl = computed(
  () => resolvedBackdrop.value || backdrop.value.background || ""
)
const backdropStyle = computed(() =>
  backdrop.value.backgroundType === backgroundTypes.video
    ? undefined
    : useSlideBackground({
        ...backdrop.value,
        background: backdropUrl.value,
      } as unknown as Slide)
)

// ── Animation ───────────────────────────────────────────────────────────────
// Transform and opacity only, through the Web Animations API, so the browser
// can run them on the compositor. Off with the animations setting or when the
// system asks for reduced motion.
//
// One set of curves, shared with the CSS below through custom properties on
// the root: a long, soft settle for moves and entrances, a quick ease-in for
// the exit, and a gentle standard curve for fades.
type Curve = readonly [number, number, number, number]
const MOVE_CURVE: Curve = [0.22, 1, 0.36, 1]
const ENTER_CURVE: Curve = [0.16, 1, 0.3, 1]
const EXIT_CURVE: Curve = [0.4, 0, 0.7, 0.2]
const FADE_CURVE: Curve = [0.4, 0, 0.2, 1]
const MOVE_MS = 620
const ENTER_MS = 560
const EXIT_MS = 280
const FADE_MS = 340

const cssCurve = (curve: Curve) => `cubic-bezier(${curve.join(", ")})`

// The curve as a function, for the moves, whose keyframes are worked out
// frame by frame (see below). Bisection on x, then y at that point.
const curveFn = ([x1, y1, x2, y2]: Curve) => {
  const at = (a1: number, a2: number, t: number) =>
    3 * a1 * (1 - t) ** 2 * t + 3 * a2 * (1 - t) * t ** 2 + t ** 3
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    let t = x
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2
      if (at(x1, x2, t) < x) lo = t
      else hi = t
    }
    return at(y1, y2, t)
  }
}
const moveEase = curveFn(MOVE_CURVE)

const animationsOn = computed(
  () => currentState.value.settings.animations !== false
)
const motionVars = computed(() => ({
  containerType: "inline-size",
  "--pair-move-ease": cssCurve(MOVE_CURVE),
  "--pair-move-ms": `${MOVE_MS}ms`,
  "--pair-exit-ease": cssCurve(EXIT_CURVE),
  "--pair-exit-ms": `${EXIT_MS}ms`,
  "--pair-fade-ease": cssCurve(FADE_CURVE),
  "--pair-fade-ms": `${FADE_MS}ms`,
}))

const regions = new Map<Role, HTMLElement>()
const contents = new Map<Role, HTMLElement>()
const root = ref<HTMLElement | null>(null)

const setRegion = (role: Role, el: HTMLElement | null) => {
  if (el) regions.set(role, el)
  else regions.delete(role)
}
const setContent = (role: Role, el: HTMLElement | null) => {
  if (el) contents.set(role, el)
  else contents.delete(role)
}

const motionAllowed = () =>
  animationsOn.value &&
  !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

// Only the animation this file started is replaced, never the region's own
// CSS opacity fade, and a cancelled run cannot clear the next one's hint.
const running = new WeakMap<HTMLElement, Animation>()
const play = (
  el: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
) => {
  running.get(el)?.cancel()
  el.style.willChange = "transform, opacity"
  // The last keyframe is the element's own style, so nothing needs holding
  // after the end; `backwards` covers a delayed start.
  const animation = el.animate(keyframes, { fill: "backwards", ...options })
  running.set(el, animation)
  const release = () => {
    if (running.get(el) !== animation) return
    running.delete(el)
    el.style.willChange = ""
  }
  animation.onfinish = release
  animation.oncancel = release
}

// Enter: the frame rises and settles in, the words follow a beat behind.
onMounted(() => {
  if (!motionAllowed()) return
  const frame = regions.get("frame")
  const text = regions.get("text")
  const easing = cssCurve(ENTER_CURVE)
  if (frame) {
    play(
      frame,
      [
        { opacity: 0, transform: "translateY(6%) scale(0.94)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: ENTER_MS, easing }
    )
  }
  if (text) {
    play(
      text,
      [
        { opacity: 0, transform: "scale(0.97)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: ENTER_MS, easing, delay: 70 }
    )
  }
})

// Layout change: FLIP. Each region's box is read before the new layout lands
// and again after; it then starts at the old box (as a transform) and plays
// back to its new one.
//
// A plain scale(sx, sy) would squash the words and the picture whenever the
// two boxes differ in shape (caption to side by side is 1.2 wide by 0.3
// tall). So the member inside is counter-scaled every frame to an even scale
// that covers the box, and the card's clip crops it: the box reshapes, its
// contents only grow or shrink. Both run as keyframes worked out from the
// move curve, played linearly in lockstep, so they stay on the compositor.
type Rect = { left: number; top: number; width: number; height: number }
let firstRects: Map<Role, Rect> | null = null

// The box as laid out, in the pair's own pixels.
const layoutRect = (el: HTMLElement): Rect => ({
  left: el.offsetLeft,
  top: el.offsetTop,
  width: el.offsetWidth,
  height: el.offsetHeight,
})

// The box as seen, including any move still running, so a layout change that
// lands mid-move carries on from where the region is rather than jumping.
// Measured against the pair and brought back to its pixels, which cancels the
// console's zoom and any scale on the thumbnail.
const visibleRect = (el: HTMLElement): Rect => {
  const pair = root.value
  if (!pair || !pair.offsetWidth) return layoutRect(el)
  const outer = pair.getBoundingClientRect()
  if (!outer.width) return layoutRect(el)
  const ratio = pair.offsetWidth / outer.width
  const box = el.getBoundingClientRect()
  return {
    left: (box.left - outer.left) * ratio,
    top: (box.top - outer.top) * ratio,
    width: box.width * ratio,
    height: box.height * ratio,
  }
}

const moveRegion = (role: Role, before: Rect, last: Rect) => {
  const el = regions.get(role)
  if (!el) return
  // Centre to centre, so the default transform origin can stay.
  const dx = before.left + before.width / 2 - (last.left + last.width / 2)
  const dy = before.top + before.height / 2 - (last.top + last.height / 2)
  const sx = before.width / last.width
  const sy = before.height / last.height
  if (
    Math.abs(dx) < 0.5 &&
    Math.abs(dy) < 0.5 &&
    Math.abs(sx - 1) < 0.002 &&
    Math.abs(sy - 1) < 0.002
  ) {
    return
  }

  // About one keyframe per display frame; linear between them.
  const steps = Math.max(2, Math.round(MOVE_MS / 16))
  const regionFrames: Keyframe[] = []
  const contentFrames: Keyframe[] = []
  for (let i = 0; i <= steps; i++) {
    const offset = i / steps
    const p = moveEase(offset)
    const scaleX = sx + (1 - sx) * p
    const scaleY = sy + (1 - sy) * p
    const cover = Math.max(scaleX, scaleY)
    regionFrames.push({
      offset,
      transform: `translate(${dx * (1 - p)}px, ${dy * (1 - p)}px) scale(${scaleX}, ${scaleY})`,
    })
    contentFrames.push({
      offset,
      transform: `scale(${cover / scaleX}, ${cover / scaleY})`,
    })
  }
  const timing = { duration: MOVE_MS, easing: "linear" }
  play(el, regionFrames, timing)
  const content = contents.get(role)
  if (content) play(content, contentFrames, timing)
}

const layoutKey = () =>
  [
    layout.value,
    members.value.frame?.id,
    members.value.text?.id,
    hiddenRole.value,
  ] as const

watch(
  layoutKey,
  () => {
    firstRects = motionAllowed()
      ? new Map([...regions].map(([role, el]) => [role, visibleRect(el)]))
      : null
  },
  { flush: "pre" }
)
watch(
  layoutKey,
  () => {
    const first = firstRects
    firstRects = null
    if (!first) return
    regions.forEach((el, role) => {
      const before = first.get(role)
      const last = layoutRect(el)
      if (!before?.width || !before.height || !last.width || !last.height) {
        return
      }
      moveRegion(role, before, last)
    })
  },
  { flush: "post" }
)

// The /live window's double-click full screen, which each member gives up
// while embedded here.
const activateFullScreen = () => {
  if (!props.fullScreen || route.name !== "live") return
  if (document.fullscreenElement) exitFullscreenSafely()
  else requestFullscreenSafely(document.documentElement)
}
</script>

<style scoped>
.pair-backdrop {
  transition: opacity var(--pair-move-ms) var(--pair-fade-ease);
}
.pair-backdrop--hidden {
  opacity: 0;
}
/* Hiding and showing a member fades it; moves are the FLIP animation's. */
.pair-region {
  transition: opacity var(--pair-fade-ms) var(--pair-fade-ease);
}
/* The card's colour, lip and corners ease in step with the move instead of
   switching at its start. Paint only; the border width (padding) still snaps,
   since animating it would lay the member out again every frame. */
.pair-card {
  transition-property: background-color, box-shadow, border-radius;
  transition-duration: var(--pair-move-ms);
  transition-timing-function: var(--pair-move-ease);
}
.pair-card__clip {
  transition: border-radius var(--pair-move-ms) var(--pair-move-ease);
}
.live-pair-projection--still .pair-backdrop,
.live-pair-projection--still .pair-region,
.live-pair-projection--still .pair-card,
.live-pair-projection--still .pair-card__clip {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .pair-backdrop,
  .pair-region,
  .pair-card,
  .pair-card__clip {
    transition: none;
  }
}
</style>

<style>
/* Exit. Pages mount the pair inside <Transition name="cow-pair">; the leaving
   pair lies over whatever replaced it and plays its enter in reverse. Global,
   because the leave classes land on this component's root from outside. The
   curve and length come from the root's custom properties. */
.cow-pair-leave-active {
  position: absolute !important;
  inset: 0;
  z-index: 5;
  transition: opacity var(--pair-exit-ms) var(--pair-exit-ease);
}
.cow-pair-leave-active .pair-region {
  transition:
    transform var(--pair-exit-ms) var(--pair-exit-ease),
    opacity var(--pair-exit-ms) var(--pair-exit-ease);
  will-change: transform, opacity;
}
.cow-pair-leave-to {
  opacity: 0;
}
.cow-pair-leave-to .pair-region--frame {
  transform: translateY(6%) scale(0.94);
  opacity: 0;
}
.cow-pair-leave-to .pair-region--text {
  transform: scale(0.97);
  opacity: 0;
}
.cow-pair-leave-active.live-pair-projection--still,
.cow-pair-leave-active.live-pair-projection--still .pair-region {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .cow-pair-leave-active,
  .cow-pair-leave-active .pair-region {
    transition: none;
  }
}
</style>
