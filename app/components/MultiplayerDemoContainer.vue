<template>
  <section class="mp-demo" aria-hidden="true">
    <div class="mp-demo__window">
      <header class="mp-demo__topbar">
        <div class="mp-demo__live">
          <span class="mp-demo__live-dot" />
          LIVE
        </div>
        <p v-if="scheduleTitle" class="mp-demo__title">{{ scheduleTitle }}</p>
        <div class="mp-demo__avatar">{{ avatarInitial }}</div>
      </header>

      <div class="mp-demo__stage">
        <div class="mp-demo__search">
          <SearchIcon class="mp-demo__search-icon" />
          <span class="mp-demo__search-text">Search</span>
        </div>

        <div class="mp-demo__menu">
          <div
            v-for="(item, index) in menuItems"
            :key="item.label"
            class="mp-demo__menu-item"
            :class="{ 'is-active': index === 0 }"
            :style="{ '--item-delay': `${index * 80 + 320}ms` }"
          >
            <IconWrapper :name="item.icon" size="6" />
            <span>{{ item.label }}</span>
          </div>
        </div>
      </div>

      <div
        v-for="cursor in collaboratorCursors"
        :key="cursor.key"
        class="mp-demo__cursor"
        :class="`mp-demo__cursor--${cursor.position}`"
        :style="cursor.style"
      >
        <svg
          class="mp-demo__cursor-arrow"
          viewBox="404 359 26 26"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M406.084 362.491L413.359 381.891C413.432 382.082 413.561 382.247 413.729 382.362C413.897 382.477 414.097 382.539 414.301 382.537C414.505 382.536 414.704 382.472 414.871 382.354C415.038 382.237 415.165 382.071 415.234 381.879L418.147 373.866C418.198 373.729 418.277 373.604 418.381 373.501C418.485 373.397 418.609 373.317 418.747 373.266L426.759 370.354C426.951 370.284 427.117 370.157 427.235 369.991C427.353 369.824 427.416 369.625 427.418 369.421C427.419 369.217 427.358 369.017 427.243 368.849C427.127 368.68 426.963 368.551 426.772 368.479L407.372 361.204C407.192 361.137 406.997 361.122 406.809 361.163C406.621 361.204 406.449 361.297 406.314 361.433C406.178 361.569 406.084 361.741 406.043 361.929C406.003 362.116 406.017 362.312 406.084 362.491Z"
            fill="none"
            stroke="var(--mp-cursor-stroke)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="mp-demo__cursor-label">{{ cursor.label }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  step?: number
  fullName?: string
  churchName?: string
  churchType?: string
  churchPastor?: string
  creatingForChurch?: boolean
  invitedEmails?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  step: 3,
  fullName: "",
  churchName: "",
  churchType: "",
  churchPastor: "",
  creatingForChurch: true,
  invitedEmails: () => [],
})

const clean = (value?: string) => value?.trim() || ""

const titleCaseFromEmail = (email?: string) => {
  const localPart = email?.split("@")[0]?.replace(/[._-]+/g, " ") || ""
  return localPart
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const scheduleTitle = computed(() =>
  clean(props.churchName) ? `${clean(props.churchName)} New schedule` : ""
)

const avatarInitial = computed(() => {
  const source = clean(props.fullName) || clean(props.churchName) || "C"
  return source.charAt(0).toUpperCase()
})

const menuItems = [
  { icon: "i-bx-bell", label: "Banners and Alert" },
  { icon: "i-bx-music", label: "Display song lyrics" },
  { icon: "i-bx-image", label: "Add media" },
  { icon: "i-bx-book-open", label: "Display scripture" },
  { icon: "i-bx-stopwatch", label: "Countdown timer" },
  { icon: "i-bx-folder-open", label: "Favourite library" },
]

const primaryCollaborator = computed(() => clean(props.fullName) || "You")

const invitedCollaborators = computed(() =>
  props.invitedEmails
    .map((email) => titleCaseFromEmail(email) || email)
    .filter(Boolean)
)

const cursorPositions = ["one", "two", "three", "four", "five"] as const
const cursorColors = [
  { background: "#5b8def", color: "#ffffff" },
  { background: "#bd7aea", color: "#ffffff" },
  { background: "#ecc676", color: "#1a1f2e" },
  { background: "#fb80dc", color: "#1a1f2e" },
  { background: "#a855f7", color: "#ffffff" },
]

const collaboratorCursors = computed(() => {
  const labels = [primaryCollaborator.value]

  if (clean(props.churchPastor)) {
    labels.push(clean(props.churchPastor))
  }

  if (props.step >= 4) {
    labels.push(...invitedCollaborators.value)
  }

  return labels.slice(0, cursorPositions.length).map((label, index) => {
    const colors = cursorColors[index]!

    return {
      key: `${index}-${label}`,
      label,
      position: cursorPositions[index],
      style: {
        "--cursor-delay": `${720 + index * 180}ms`,
        "--cursor-hover-delay": `${1200 + index * 160}ms`,
        "--cursor-bg": colors.background,
        "--cursor-color": colors.color,
      },
    }
  })
})
</script>

<style scoped>
.mp-demo {
  /* Light theme (default) */
  --mp-shell-bg: #eef1f6;
  --mp-window-bg: #ffffff;
  --mp-grid-dot: rgba(15, 23, 42, 0.08);
  --mp-grid-line: rgba(15, 23, 42, 0.035);
  --mp-muted: #64748b;
  --mp-border: rgba(15, 23, 42, 0.07);
  --mp-surface-strong: rgba(15, 23, 42, 0.05);
  --mp-menu-bg: #f3f5f9;
  --mp-menu-text: #5b6473;
  --mp-menu-text-active: #0f172a;
  --mp-search-bg: #ffffff;
  --mp-search-text: #334155;
  --mp-search-icon: #64748b;
  --mp-glass-bg: rgba(255, 255, 255, 0.55);
  --mp-glass-border: rgba(15, 23, 42, 0.08);
  --mp-glass-highlight: rgba(255, 255, 255, 0.85);
  --mp-cursor-stroke: #1e2536;
  --mp-pink: #fb80dc;
  --mp-shadow: 0 26px 80px rgba(15, 23, 42, 0.14);

  position: relative;
  width: 100%;
  height: 100%;
  min-height: 620px;
  overflow: hidden;
  border-radius: 1rem;
  background: var(--mp-shell-bg);
  color: var(--mp-muted);
  isolation: isolate;

  /* Decorative, non-interactive preview */
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}

.mp-demo__window {
  position: absolute;
  inset: 1.25rem;
  overflow: hidden;
  border: 1px solid var(--mp-border);
  border-radius: 1.6rem;
  background-color: var(--mp-window-bg);
  background-image: radial-gradient(
      circle,
      var(--mp-grid-dot) 1.1px,
      transparent 1.6px
    ),
    linear-gradient(0deg, var(--mp-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--mp-grid-line) 1px, transparent 1px);
  background-size: 24px 24px, 24px 24px, 24px 24px;
  box-shadow: var(--mp-shadow);
  animation: demo-window-in 0.78s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Top bar */
.mp-demo__topbar {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  padding: 1.6rem 2rem;
}

.mp-demo__title {
  overflow: hidden;
  color: var(--mp-muted);
  font-size: 1.05rem;
  font-weight: 500;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Glass LIVE pill */
.mp-demo__live {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  justify-self: start;
  padding: 0.5rem 0.95rem 0.5rem 0.8rem;
  border: 1px solid var(--mp-glass-border);
  border-radius: 999px;
  color: #ff5a52;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  background: var(--mp-glass-bg);
  box-shadow: inset 0 1px 0 var(--mp-glass-highlight),
    0 8px 24px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
}

.mp-demo__live-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
  background: #f04438;
  box-shadow: 0 0 0 0 rgba(240, 68, 56, 0.4);
  animation: demo-pulse 1.8s ease-out infinite;
}

.mp-demo__avatar {
  display: grid;
  width: 3.3rem;
  height: 3.3rem;
  place-items: center;
  justify-self: end;
  border-radius: 999px;
  background: rgba(82, 139, 255, 0.2);
  color: #4f86ff;
  font-size: 1.25rem;
  font-weight: 600;
}

/* Search + menu stage */
.mp-demo__stage {
  position: absolute;
  top: 42%;
  left: 50%;
  width: min(66%, 680px);
  transform: translate(-50%, -50%);
}

.mp-demo__search {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 1.15rem;
  width: 100%;
  min-height: 5.2rem;
  padding: 0 1.8rem;
  border-radius: 1.1rem;
  color: var(--mp-search-text);
  font-size: 1.3rem;
  font-weight: 500;
  /* Solid interior fill */
  background: var(--mp-search-bg);
  /* Surrounding gradient glow — rendered behind the solid fill */
  box-shadow: -16px 2px 48px -10px rgba(214, 69, 176, 0.65),
    16px 2px 48px -10px rgba(143, 125, 247, 0.65),
    0 12px 60px -14px rgba(168, 85, 247, 0.45);
  animation: demo-float-in 0.72s 0.16s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Crisp gradient border ring — interior stays solid */
.mp-demo__search::after {
  position: absolute;
  inset: 0;
  content: "";
  padding: 2px;
  border-radius: inherit;
  background: linear-gradient(
    115deg,
    #d445b0 0%,
    #acbcdb 38%,
    #a7b2e0 70%,
    #8f7df7 100%
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.mp-demo__search-icon {
  flex: 0 0 auto;
  width: 1.9rem;
  height: 1.9rem;
  color: var(--mp-search-icon);
}

.mp-demo__search-text {
  background: linear-gradient(100deg, #ec5fc0 0%, #c79bea 45%, #9d8cf6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.mp-demo__menu {
  position: absolute;
  top: calc(100% + 1.6rem);
  left: 0;
  width: 62%;
  overflow: hidden;
  border-radius: 1rem 1rem 0 0;
  background: var(--mp-menu-bg);
  -webkit-mask-image: linear-gradient(180deg, #000 58%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 58%, transparent 100%);
}

.mp-demo__menu-item {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  padding: 1.15rem 1.45rem;
  border-bottom: 1px solid var(--mp-border);
  color: var(--mp-menu-text);
  font-size: 1.05rem;
  font-weight: 400;
  opacity: 0;
  transform: translateY(8px);
  animation: demo-row-in 0.5s var(--item-delay) cubic-bezier(0.16, 1, 0.3, 1)
    forwards;
}

.mp-demo__menu-item.is-active {
  color: var(--mp-menu-text-active);
  background: var(--mp-surface-strong);
}

.mp-demo__menu-item :deep(.iconify) {
  flex: 0 0 auto;
  color: currentColor;
}

/* Collaborator cursors */
.mp-demo__cursor {
  position: absolute;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  opacity: 0;
  transform: translateY(16px);
  filter: drop-shadow(0 16px 26px rgba(2, 6, 23, 0.4));
  animation: demo-cursor-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards,
    demo-cursor-hover 3.6s ease-in-out infinite;
  animation-delay: var(--cursor-delay), var(--cursor-hover-delay);
}

.mp-demo__cursor-arrow {
  width: 2.05rem;
  height: 2.05rem;
}

.mp-demo__cursor-label {
  max-width: 14rem;
  margin-top: -0.45rem;
  margin-left: 1.15rem;
  overflow: hidden;
  padding: 0.78rem 1.5rem;
  border-radius: 999px;
  color: var(--cursor-color);
  font-size: 1.05rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--cursor-bg);
}

.mp-demo__cursor--one {
  top: 47%;
  left: 52%;
}

.mp-demo__cursor--two {
  top: 70%;
  left: 58%;
}

.mp-demo__cursor--three {
  top: 61%;
  left: 75%;
}

.mp-demo__cursor--four {
  top: 33%;
  left: 42%;
}

.mp-demo__cursor--five {
  top: 82%;
  left: 64%;
}

/* Dark theme */
html.dark .mp-demo {
  --mp-shell-bg: #12151f;
  --mp-window-bg: #1a1f2e;
  --mp-grid-dot: rgba(255, 255, 255, 0.05);
  --mp-grid-line: rgba(255, 255, 255, 0.018);
  --mp-muted: #9aa3b2;
  --mp-border: rgba(255, 255, 255, 0.06);
  --mp-surface-strong: rgba(255, 255, 255, 0.05);
  --mp-menu-bg: #222838;
  --mp-menu-text: #8b93a4;
  --mp-menu-text-active: #f4f6fb;
  --mp-search-bg: #131724;
  --mp-search-text: #d4d7df;
  --mp-search-icon: #e7e9ee;
  --mp-glass-bg: rgba(255, 255, 255, 0.08);
  --mp-glass-border: rgba(255, 255, 255, 0.16);
  --mp-glass-highlight: rgba(255, 255, 255, 0.25);
  --mp-cursor-stroke: #ffffff;
  --mp-shadow: 0 28px 90px rgba(0, 0, 0, 0.4);
}

@keyframes demo-window-in {
  from {
    opacity: 0;
    transform: translateY(26px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes demo-float-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes demo-row-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes demo-cursor-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes demo-cursor-hover {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 -7px;
  }
}

@keyframes demo-pulse {
  70% {
    box-shadow: 0 0 0 10px rgba(240, 68, 56, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(240, 68, 56, 0);
  }
}

@media (max-width: 1280px) {
  .mp-demo__window {
    inset: 1rem;
  }

  .mp-demo__stage {
    width: min(80%, 560px);
  }

  .mp-demo__menu {
    width: 72%;
  }
}

@media (max-height: 760px) {
  .mp-demo {
    min-height: 560px;
  }

  .mp-demo__stage {
    top: 44%;
  }
}
</style>
