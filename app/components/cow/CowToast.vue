<template>
  <!-- The app's toaster, in the marketing site's glass. Everything still goes
       through useToast(): this reads the same notification list Nuxt UI's
       <UNotifications> did, and each toast's content is still a
       <UNotification>, so titles, descriptions, actions and close buttons
       behave as before. What changes is the pane around it and the stacking:
       toasts sit at the top right, newest in front, the older ones tucked
       behind it, and the stack fans out while the pointer is over it. -->
  <Teleport to="body">
    <ol
      class="cow-toaster"
      :class="{ 'is-expanded': expanded }"
      :style="{ height: `${stackHeight}px` }"
      aria-live="polite"
      @mouseenter="expanded = true"
      @mouseleave="expanded = false"
      @focusin="expanded = true"
      @focusout="onFocusOut"
    >
      <TransitionGroup name="cow-toast">
        <li
          v-for="(notification, index) in stack"
          :key="notification.id"
          :ref="(el) => observe(notification.id, el as HTMLElement | null)"
          class="cow-toast"
          :class="{
            'is-behind': index > 0 && !expanded,
            'is-hidden': index >= MAX_VISIBLE && !expanded,
            'cursor-pointer': notification.click,
          }"
          :style="toastStyle(notification, index)"
          @click="notification.click?.(notification)"
        >
          <!-- The purple smoke of the features panel, glowing up through the glass. -->
          <span class="cow-toast__smoke" aria-hidden="true" />
          <UNotification
            v-bind="notificationProps(notification)"
            @close="toast.remove(notification.id)"
          >
            <template v-for="(_, name) in $slots" #[name]="slotData">
              <slot :name="name" v-bind="slotData" />
            </template>
          </UNotification>
        </li>
      </TransitionGroup>
    </ol>
  </Teleport>
</template>

<script setup lang="ts">
import type { Avatar, Notification } from "#ui/types"

// Older toasts peek out this far below the one in front of them, and only
// this many show while the stack is folded.
const PEEK = 10
const GAP = 10
const MAX_VISIBLE = 3
// Every toast gets at least the default: the pane takes a moment to blur in,
// and with no progress bar a 3s toast is gone before it has been read.
const DEFAULT_TIMEOUT = 5000

// The glow behind each toast takes its colour, so an error still reads red.
// Purple is the marketing site's smoke.
const TINTS: Record<string, string> = {
  primary: "#8a41c9",
  purple: "#8a41c9",
  red: "#dc2626",
  orange: "#ea580c",
  amber: "#d97706",
  yellow: "#ca8a04",
  green: "#16a34a",
  blue: "#2563eb",
  gray: "#64748b",
  black: "#1f2937",
}

const toast = useToast()
const notifications = useState<Notification[]>("notifications", () => [])
const stack = computed(() => [...notifications.value].reverse())

const expanded = ref(false)
watch(
  () => notifications.value.length,
  (length) => {
    if (!length) expanded.value = false
  }
)

const onFocusOut = (event: FocusEvent) => {
  const list = event.currentTarget as HTMLElement
  if (!list.contains(event.relatedTarget as Node | null)) expanded.value = false
}

// Each toast's own height, read off its content rather than the pane, since
// a folded toast's pane is cut to the height of the one in front.
const heights = reactive<Record<string, number>>({})
const elements = new Map<string, HTMLElement>()
let resizeObserver: ResizeObserver | null = null

const observe = (id: string, el: HTMLElement | null) => {
  const body = el?.querySelector<HTMLElement>(".cow-toast__body")
  const previous = elements.get(id)
  if (previous === body) return
  if (previous) resizeObserver?.unobserve(previous)
  if (!body) {
    elements.delete(id)
    return
  }
  elements.set(id, body)
  body.dataset.toastId = id
  resizeObserver?.observe(body)
}

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset.toastId
      if (id) heights[id] = (entry.target as HTMLElement).offsetHeight
    }
  })
  for (const body of elements.values()) resizeObserver.observe(body)
})

const heightOf = (id: string) => heights[id] ?? 0
const frontHeight = computed(() => (stack.value[0] ? heightOf(stack.value[0].id) : 0))

const offsetOf = (index: number) => {
  let offset = 0
  for (let i = 0; i < index; i++) offset += heightOf(stack.value[i]!.id) + GAP
  return offset
}

const stackHeight = computed(() => {
  const count = stack.value.length
  if (!count) return 0
  if (expanded.value) return offsetOf(count - 1) + heightOf(stack.value[count - 1]!.id)
  return frontHeight.value + PEEK * (Math.min(count, MAX_VISIBLE) - 1)
})

const toastStyle = (notification: Notification, index: number) => {
  const own = heightOf(notification.id)
  const folded = !expanded.value && index > 0
  // Folded, a toast takes the front one's height and sits a peek lower,
  // shrunk about its bottom edge so only that edge shows.
  const height = folded ? frontHeight.value : own
  const y = expanded.value ? offsetOf(index) : PEEK * Math.min(index, MAX_VISIBLE - 1)
  const scale = expanded.value ? 1 : 1 - 0.05 * Math.min(index, MAX_VISIBLE - 1)
  return {
    "--toast-tint": TINTS[notification.color ?? "primary"] ?? TINTS.primary,
    height: height ? `${height}px` : undefined,
    transform: `translateY(${y}px) scale(${scale})`,
    zIndex: stack.value.length - index,
  }
}

// Nuxt UI's own toast, restyled to sit inside the glass. The icon moves into
// a round chip like the marketing site's avatars, and the progress bar goes:
// the stack keeps time itself (below), so the timer is off here.
const notificationProps = (notification: Notification) => {
  const { click: _click, ui, ...rest } = notification
  return {
    ...rest,
    icon: undefined,
    // UAvatar takes an icon, though its Avatar type leaves it out.
    avatar: rest.avatar ?? (rest.icon ? ({ icon: rest.icon } as Avatar) : undefined),
    timeout: 0,
    closeButton: rest.closeButton ?? {
      icon: "i-tabler-x",
      color: "gray",
      variant: "link",
      padded: false,
      class: "cow-toast__close",
    },
    ui: { ...notificationUi(!!rest.description), ...ui },
  }
}

const notificationUi = (hasDescription: boolean) => ({
  strategy: "override",
  wrapper: "cow-toast__body w-full",
  container: "relative",
  background: "",
  shadow: "",
  ring: "",
  rounded: "",
  padding: "py-[15px] ps-3.5 pe-[18px]",
  gap: "gap-3",
  title: "text-sm font-semibold leading-5 text-[#1a1f2e] dark:text-white",
  description: "mt-0.5 text-[13px] leading-[1.4] text-[#30333f] dark:text-white/75",
  descriptionOnly: "mt-0 text-sm text-[#1a1f2e] dark:text-white",
  avatar: {
    base: `cow-toast__avatar ${hasDescription ? "self-start" : "self-center"}`,
    size: "md",
  },
  // The pane animates in and out (see the styles), so the content doesn't too.
  transition: {
    enterActiveClass: "",
    enterFromClass: "",
    enterToClass: "",
    leaveActiveClass: "",
    leaveFromClass: "",
    leaveToClass: "",
  },
  default: {
    actionButton: {
      size: "xs",
      color: "white",
      ui: { rounded: "rounded-full" },
    },
  },
})

// Timing lives here rather than in each toast so the whole stack can pause
// while it is fanned out: a toast vanishing from under the pointer would
// shift every one below it.
type Countdown = { timeout: number; remaining: number; startedAt: number; handle?: ReturnType<typeof setTimeout> }
const countdowns = new Map<string, Countdown>()

const expire = (id: string) => {
  countdowns.delete(id)
  const notification = notifications.value.find((n) => n.id === id)
  notification?.callback?.()
  toast.remove(id)
}

const run = (id: string, countdown: Countdown) => {
  countdown.startedAt = Date.now()
  countdown.handle = setTimeout(() => expire(id), countdown.remaining)
}

const hold = (countdown: Countdown) => {
  if (!countdown.handle) return
  clearTimeout(countdown.handle)
  countdown.handle = undefined
  countdown.remaining -= Date.now() - countdown.startedAt
}

watch(
  notifications,
  (list) => {
    const live = new Set(list.map((n) => n.id))
    for (const [id, countdown] of countdowns) {
      if (live.has(id)) continue
      hold(countdown)
      countdowns.delete(id)
    }
    for (const id of Object.keys(heights)) {
      if (!live.has(id)) delete heights[id]
    }
    for (const notification of list) {
      const timeout = notification.timeout === 0 ? 0 : Math.max(notification.timeout ?? 0, DEFAULT_TIMEOUT)
      const existing = countdowns.get(notification.id)
      if (existing?.timeout === timeout) continue
      if (existing) hold(existing)
      countdowns.delete(notification.id)
      // A timeout of 0 keeps the toast up until it is closed.
      if (!timeout) continue
      const countdown: Countdown = { timeout, remaining: timeout, startedAt: 0 }
      countdowns.set(notification.id, countdown)
      if (!expanded.value) run(notification.id, countdown)
    }
  },
  { deep: true, immediate: true }
)

watch(expanded, (isExpanded) => {
  for (const [id, countdown] of countdowns) {
    if (isExpanded) hold(countdown)
    else if (!countdown.handle) run(id, countdown)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  for (const countdown of countdowns.values()) hold(countdown)
})
</script>

<style scoped>
/* Below the navbar (50px, 42px on short screens), so it stays in view. */
.cow-toaster {
  position: fixed;
  top: 62px;
  right: 16px;
  z-index: 55;
  width: 360px;
  max-width: calc(100vw - 32px);
  pointer-events: none;
  transition: height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
/* Fanned out, the gaps between toasts keep the stack open too. */
.cow-toaster.is-expanded {
  pointer-events: auto;
}

/* A pane of glass: the page blurred and brightened behind a light lilac
   wash. The text sits on the clearer top half, so it stays dark on light,
   above 4.5:1 against any backdrop, black included. The tint itself stays
   below the text. */
.cow-toast {
  --toast-deep: color-mix(in srgb, var(--toast-tint) 55%, #1e0b3a);
  --toast-soft: color-mix(in srgb, var(--toast-tint) 10%, #fff);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  border-radius: 24px;
  overflow: hidden;
  transform-origin: bottom center;
  background: rgba(250, 247, 255, 0.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.8) brightness(1.04);
  backdrop-filter: blur(16px) saturate(1.8) brightness(1.04);
  box-shadow:
    0 0 0 0.5px color-mix(in srgb, var(--toast-deep) 10%, transparent),
    0 2px 6px -2px rgba(26, 31, 46, 0.12),
    0 16px 36px -12px color-mix(in srgb, var(--toast-deep) 38%, transparent);
  color: #1a1f2e;
  -webkit-font-smoothing: antialiased;
  pointer-events: auto;
  transition:
    transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1),
    height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.3s ease;
}
.cow-toast.is-hidden {
  opacity: 0;
  pointer-events: none;
}
/* Tucked behind, only the glowing bottom edge shows. */
.cow-toast :deep(.cow-toast__body) {
  transition: opacity 0.25s ease;
}
.cow-toast.is-behind :deep(.cow-toast__body) {
  opacity: 0;
}

/* Tint pooling in the bottom corners, each drifting its own way, over a
   band that runs from the tint at the rim to a pale wash and then clear. */
.cow-toast__smoke,
.cow-toast__smoke::before,
.cow-toast__smoke::after {
  position: absolute;
  pointer-events: none;
}
.cow-toast__smoke {
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--toast-tint) 55%, transparent) 0,
    color-mix(in srgb, var(--toast-soft) 80%, transparent) 18px,
    transparent 44px
  );
}
.cow-toast__smoke::before,
.cow-toast__smoke::after {
  content: "";
  inset: 0 -12px;
  animation: cow-toast-smoke 7s ease-in-out infinite alternate;
}
.cow-toast__smoke::before {
  background: radial-gradient(
    96px 44px at 12px 100%,
    color-mix(in srgb, var(--toast-tint) 85%, transparent),
    transparent
  );
}
.cow-toast__smoke::after {
  background: radial-gradient(
    130px 46px at calc(100% - 12px) 100%,
    color-mix(in srgb, var(--toast-tint) 80%, transparent),
    transparent
  );
  animation-duration: 9s;
  animation-direction: alternate-reverse;
}
@keyframes cow-toast-smoke {
  from {
    transform: translateX(-12px);
  }
  to {
    transform: translateX(12px);
  }
}

/* The pane's thickness: a curved sheen from the light at the top left,
   bright hairlines where the top and bottom edges catch it, a soft glow
   just inside the edge, and the tint deepening at the bottom. */
.cow-toast::before,
.cow-toast::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
.cow-toast::after {
  z-index: 1;
  background: radial-gradient(130% 100% at 18% -40%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 60%);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.9),
    inset 0 -1px 1px rgba(255, 255, 255, 0.5),
    inset 0 0 16px rgba(255, 255, 255, 0.3),
    inset 0 -10px 18px -12px color-mix(in srgb, var(--toast-deep) 45%, transparent);
}
/* The specular rim: brightest at the top-left and bottom-right corners,
   tinged along the bottom by the smoke. */
.cow-toast::before {
  z-index: 3;
  padding: 1px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.35) 22%,
    rgba(255, 255, 255, 0.08) 50%,
    color-mix(in srgb, color-mix(in srgb, var(--toast-tint) 40%, #fff) 45%, transparent) 78%,
    rgba(255, 255, 255, 0.85) 100%
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
.cow-toast > :not(.cow-toast__smoke) {
  position: relative;
  z-index: 2;
}

/* The icon in a round chip, where the marketing site puts an avatar. */
.cow-toast :deep(.cow-toast__avatar) {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  background: color-mix(in srgb, var(--toast-tint) 14%, #fff);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.75),
    0 4px 10px -4px color-mix(in srgb, var(--toast-deep) 45%, transparent);
}
.cow-toast :deep(.cow-toast__avatar > span) {
  width: 18px;
  height: 18px;
  color: var(--toast-tint);
}
.cow-toast :deep(.cow-toast__close) {
  color: #30333f;
  /* Room for the hover chip, pulled back so the X sits where it did. */
  margin: -4px;
  padding: 4px;
  border-radius: 9999px;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.cow-toast :deep(.cow-toast__close:hover) {
  color: #0f1117;
  background: rgba(15, 17, 23, 0.08);
}

.dark .cow-toast {
  background: rgba(28, 22, 42, 0.62);
  color: #fff;
  box-shadow:
    0 0 0 0.5px rgba(255, 255, 255, 0.08),
    0 2px 6px -2px rgba(0, 0, 0, 0.4),
    0 16px 36px -12px color-mix(in srgb, var(--toast-deep) 60%, transparent);
}
.dark .cow-toast__smoke {
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--toast-tint) 55%, transparent) 0,
    color-mix(in srgb, var(--toast-tint) 18%, transparent) 18px,
    transparent 44px
  );
}
.dark .cow-toast::after {
  background: radial-gradient(130% 100% at 18% -40%, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0) 60%);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.22),
    inset 0 -1px 1px rgba(255, 255, 255, 0.08),
    inset 0 -10px 18px -12px color-mix(in srgb, var(--toast-deep) 60%, transparent);
}
.dark .cow-toast::before {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0.08) 22%,
    rgba(255, 255, 255, 0.02) 50%,
    color-mix(in srgb, var(--toast-tint) 45%, transparent) 78%,
    rgba(255, 255, 255, 0.25) 100%
  );
}
.dark .cow-toast :deep(.cow-toast__avatar) {
  background: color-mix(in srgb, var(--toast-tint) 30%, #1c162a);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.12),
    0 4px 10px -4px rgba(0, 0, 0, 0.5);
}
.dark .cow-toast :deep(.cow-toast__avatar > span) {
  color: color-mix(in srgb, var(--toast-tint) 55%, #fff);
}
.dark .cow-toast :deep(.cow-toast__close) {
  color: rgba(255, 255, 255, 0.7);
}
.dark .cow-toast :deep(.cow-toast__close:hover) {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

@media (max-height: 760px) {
  .cow-toaster {
    top: 52px;
  }
}

@media (max-width: 639px) {
  .cow-toaster {
    left: 16px;
    right: 16px;
    width: auto;
    max-width: none;
  }
}

/* Without transparency, a solid pane in the same colours. */
@media (prefers-reduced-transparency: reduce) {
  .cow-toast {
    background: #f7f2fd;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  .dark .cow-toast {
    background: #1c162a;
  }
}

/* Arrives out of a blur, dropping in a little; leaves the same way, drifting
   right. These use translate and scale on their own, so they add to the
   transform that places the toast in the stack. */
.cow-toast-enter-active {
  transition:
    opacity 0.5s ease,
    filter 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
    translate 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
    scale 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1),
    height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.cow-toast-leave-active {
  transition:
    opacity 0.35s ease,
    filter 0.35s ease,
    translate 0.35s ease,
    scale 0.35s ease;
}
.cow-toast-enter-from {
  opacity: 0;
  filter: blur(14px);
  translate: 0 -14px;
  scale: 0.96;
}
.cow-toast-leave-to {
  opacity: 0;
  filter: blur(8px);
  translate: 16px 0;
  scale: 0.98;
}

@media (prefers-reduced-motion: reduce) {
  .cow-toast-enter-from,
  .cow-toast-leave-to {
    filter: none;
    translate: none;
    scale: none;
  }
  .cow-toast__smoke::before,
  .cow-toast__smoke::after {
    animation: none;
  }
}
</style>
