<template>
  <div
    class="auth-collage"
    :class="{ 'auth-collage--locked': !!active || isTransitioning }"
  >
    <div class="auth-collage__stage">
      <div
        v-for="(col, i) in columns"
        :key="i"
        class="auth-collage__col"
        :class="{ 'auth-collage__col--reverse': col.reverse }"
        :style="{ '--dur': `${col.duration}s`, '--delay': `${col.delay}s` }"
      >
        <button
          v-for="(img, j) in col.loop"
          :key="`${i}-${j}`"
          type="button"
          class="auth-collage__tile"
          @click="open(img, $event)"
        >
          <img :src="img" alt="" loading="lazy" draggable="false" />
        </button>
      </div>
    </div>

    <!-- Pop-open modal -->
    <Teleport to="body">
      <div
        v-if="active"
        class="auth-collage__modal"
        :class="{ 'auth-collage__modal--closing': isClosingBackdrop }"
        @click="close"
      >
        <div class="auth-collage__card" @click.stop>
          <img :src="active" alt="" draggable="false" />
          <button
            type="button"
            class="auth-collage__close"
            aria-label="Close"
            @click="close"
          >
            <CloseIcon class="w-6 h-6" />
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const TILE_COUNT = 18
const COLS = 7
const PER_STRIP = 36

const images = Array.from(
  { length: TILE_COUNT },
  (_, i) => `/collage/collage-img-${i + 1}.webp`
)

interface Column {
  loop: string[]
  duration: number
  delay: number
  reverse: boolean
}

const columns: Column[] = Array.from({ length: COLS }, (_, c) => {
  const strip = Array.from(
    { length: PER_STRIP },
    (_, r) =>
      images[
        (c * 7 + r * 5 + Math.floor(r / images.length) * 2) % images.length
      ]!
  )
  const duration = 96 + ((c * 13) % 38)
  const scrollDuration = duration * 2 * 1.5

  return {
    loop: [...strip, ...strip],
    duration: scrollDuration,
    delay: c === Math.floor(COLS / 2) ? -scrollDuration / 2 : 0,
    reverse: c % 2 === 1,
  }
})

const SHARED = "collage-shared"
const active = ref<string | null>(null)
const isTransitioning = ref(false)
const isClosingBackdrop = ref(false)
let sharedEl: HTMLElement | null = null

const supportsVT = () =>
  typeof document !== "undefined" && "startViewTransition" in document

const open = (img: string, e: MouseEvent) => {
  if (isTransitioning.value) return

  const imgEl = (e.currentTarget as HTMLElement).querySelector(
    "img"
  ) as HTMLElement | null

  if (!supportsVT() || !imgEl) {
    active.value = img
    return
  }

  sharedEl = imgEl
  isTransitioning.value = true
  imgEl.style.viewTransitionName = SHARED

  // @ts-expect-error - View Transitions API
  const vt = document.startViewTransition(async () => {
    active.value = img
    await nextTick()
    // hand the shared name over to the modal image (clear it from the tile)
    imgEl.style.viewTransitionName = ""
  })
  vt.finished.catch(() => {}).finally(() => {
    imgEl.style.viewTransitionName = ""
    isTransitioning.value = false
  })
}

const close = async () => {
  if (isTransitioning.value) return

  if (!supportsVT()) {
    active.value = null
    return
  }

  isTransitioning.value = true
  isClosingBackdrop.value = true
  await nextTick()

  // @ts-expect-error - View Transitions API
  const vt = document.startViewTransition(async () => {
    active.value = null
    await nextTick()
    // morph back into the originating tile
    if (sharedEl) sharedEl.style.viewTransitionName = SHARED
  })
  vt.finished.catch(() => {}).finally(() => {
    if (sharedEl) sharedEl.style.viewTransitionName = ""
    sharedEl = null
    isClosingBackdrop.value = false
    isTransitioning.value = false
  })
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape" && active.value) close()
}

onMounted(() => window.addEventListener("keydown", onKey))
onBeforeUnmount(() => window.removeEventListener("keydown", onKey))
</script>

<style scoped>
.auth-collage {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 1rem;
  overflow: hidden;
  background: linear-gradient(135deg, #cbd5e1, #94a3b8 55%, #64748b);
  perspective: 1200px;
}

/* Isometric wall of columns — edges at exactly ±30° (matches the design frame).
   matrix(0.866025, -0.5, 0.866025, 0.5, 0, 0) maps the horizontal edge to -30°
   (cos30, -sin30) and the vertical edge to +30° (cos30, sin30). */
.auth-collage__stage {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #e2e8f0;
  transform: translate(-54%, -50%)
    matrix(0.866025, -0.5, 0.866025, 0.5, 0, 0) scale(1.95);
  transform-origin: center;
  will-change: transform;
}

.auth-collage__col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 220px;
  animation: collage-scroll var(--dur) linear infinite;
  animation-delay: var(--delay);
  will-change: transform;
}

.auth-collage__col--reverse {
  animation-direction: reverse;
}

@keyframes collage-scroll {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-50%);
  }
}

.auth-collage--locked .auth-collage__col {
  animation-play-state: paused;
}

.auth-collage__tile {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  padding: 0;
  border: none;
  border-radius: 0;
  overflow: hidden;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.2);
  transition: filter 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.auth-collage__tile:hover {
  filter: brightness(1.12);
  z-index: 2;
}

.auth-collage__tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Modal */
.auth-collage__modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: clamp(1.5rem, 5vw, 4rem);
  background: rgba(10, 12, 20, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  cursor: pointer;
}

.auth-collage__modal--closing {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.auth-collage__card {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  border-radius: 18px;
  overflow: hidden;
  cursor: default;
  box-shadow: 0 40px 90px -30px rgba(0, 0, 0, 0.8);
}

.auth-collage__card img {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 6rem);
  object-fit: contain;
  view-transition-name: collage-shared;
}

.auth-collage__close {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  color: #fff;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  transition: background 0.25s ease, transform 0.25s ease;
}

.auth-collage__close:hover {
  background: rgba(15, 23, 42, 0.85);
  transform: scale(1.08);
}

@media (prefers-reduced-motion: reduce) {
  .auth-collage__col {
    animation: none;
  }
}
</style>

<style>
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

::view-transition-group(collage-shared),
::view-transition-old(collage-shared),
::view-transition-new(collage-shared) {
  animation-duration: 0.5s;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

::view-transition-image-pair(collage-shared) {
  border-radius: 18px;
  overflow: hidden;
}
</style>
