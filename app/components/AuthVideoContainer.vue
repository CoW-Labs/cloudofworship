<template>
  <div class="auth-video" :class="{ 'auth-video--playing': playing }">
    <iframe
      v-if="playing"
      class="auth-video__player"
      :src="embedSrc"
      title="Cloud of Worship in 45 seconds"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    />

    <template v-else>
      <img
        class="auth-video__poster"
        :src="POSTER_SRC"
        alt=""
        draggable="false"
      />
      <div class="auth-video__scrim" />

      <button
        type="button"
        class="auth-video__play"
        aria-label="Play the Cloud of Worship tour video"
        @click="playing = true"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l10-6.4c.6-.4.6-1.4 0-1.8l-10-6.4c-.7-.4-1.6.1-1.6.9Z"
          />
        </svg>
      </button>

      <div class="auth-video__caption">
        <p class="auth-video__quote">45 seconds to help you make a decision</p>
        <p class="auth-video__meta">
          Okay 48...but I promise it will be worth your while
        </p>
      </div>
    </template>

    <button
      v-if="playing"
      type="button"
      class="auth-video__close"
      aria-label="Close video"
      @click="playing = false"
    >
      <CloseIcon class="w-5 h-5" />
    </button>
  </div>
</template>

<script setup lang="ts">
const VIDEO_ID = "uXHuISXJ7yE"
const POSTER_SRC = "/images/auth-video-poster.webp"

/* Nothing from YouTube loads until the play button is pressed: the poster is a
   local still, and the iframe (with its cookies and player JS) mounts on click. */
const embedSrc = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&playsinline=1&modestbranding=1`

const playing = ref(false)

const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape" && playing.value) playing.value = false
}

onMounted(() => window.addEventListener("keydown", onKey))
onBeforeUnmount(() => window.removeEventListener("keydown", onKey))
</script>

<style scoped>
.auth-video {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 1rem;
  overflow: hidden;
  background: #0b1120;
  isolation: isolate;
}

.auth-video__poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* keep the speaker in frame and push the burned-in captions off the left */
  object-position: 95% center;
  user-select: none;
}

.auth-video__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.72) 0%,
    rgba(0, 0, 0, 0.35) 28%,
    rgba(0, 0, 0, 0) 55%
  );
  pointer-events: none;
}

.auth-video__play {
  position: absolute;
  top: clamp(1rem, 2.5vw, 1.5rem);
  right: clamp(1rem, 2.5vw, 1.5rem);
  display: grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 999px;
  color: #fff;
  background: rgba(120, 120, 120, 0.45);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease;
}

.auth-video__play svg {
  width: 2rem;
  height: 2rem;
  margin-left: 0.2rem;
  fill: currentColor;
}

.auth-video__play:hover {
  transform: scale(1.06);
  background: rgba(120, 120, 120, 0.6);
}

.auth-video__play:focus-visible,
.auth-video__close:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}

.auth-video__caption {
  position: absolute;
  left: clamp(1.5rem, 4vw, 2.75rem);
  right: clamp(1.5rem, 4vw, 2.75rem);
  bottom: clamp(1.5rem, 4vw, 2.75rem);
  color: #fff;
  pointer-events: none;
}

.auth-video__quote {
  max-width: 20ch;
  font-size: clamp(1.6rem, 2.3vw, 2.25rem);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.025em;
  text-wrap: balance;
}

.auth-video__meta {
  max-width: 36ch;
  margin-top: 0.75rem;
  font-size: clamp(0.95rem, 1.1vw, 1.05rem);
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.72);
}

.auth-video__player {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #000;
}

.auth-video--playing {
  background: #000;
}

.auth-video__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  color: #fff;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: background 0.25s ease;
}

.auth-video__close:hover {
  background: rgba(15, 23, 42, 0.85);
}
</style>
