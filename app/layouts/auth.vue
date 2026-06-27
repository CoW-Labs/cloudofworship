<template>
  <div class="auth-layout" :class="`auth-layout--${variant}`">
    <!-- Left collage (split variant only) -->
    <div class="auth-layout__collage" :aria-hidden="variant !== 'split'">
      <Transition name="auth-visual" mode="out-in">
        <MultiplayerDemoContainer
          v-if="showMultiplayerDemo"
          key="multiplayer-demo"
          v-bind="signupVisualState"
        />
        <AuthCollageContainer v-else key="auth-collage" />
      </Transition>
    </div>

    <!-- Form column -->
    <div class="auth-layout__main">
      <div class="auth-layout__slot">
        <slot />
      </div>
      <p class="auth-layout__footer">
        &copy; {{ new Date().getFullYear() }} Cloud of Worship (CoW Labs). All
        rights reserved.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UserCredential } from "firebase/auth"

useHead({
  title: "Cloud of Worship",
})

const route = useRoute()
const signupVisualState = useSignupVisualState()
const variant = computed(
  () => (route.meta.authVariant as "split" | "centered") || "split"
)
const showMultiplayerDemo = computed(
  () => route.path.startsWith("/signup") && signupVisualState.value.step >= 3
)

const { handleGoogleSignIn: tauriGoogleSignIn } = useTauriGoogleAuth()

const handleGoogleSignIn = async (): Promise<UserCredential> => {
  return await tauriGoogleSignIn()
}

provide("handleGoogleSignIn", handleGoogleSignIn)
</script>

<style scoped>
.auth-layout {
  position: relative;
  display: flex;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
  background-color: #ffffff;
  color: #0f172a;
}

.auth-layout__collage {
  display: none;
  padding: 0.75rem;
  overflow: hidden;
  opacity: 0;
  transform: scale(0.985);
  transition: width 0.72s cubic-bezier(0.16, 1, 0.3, 1),
    padding 0.72s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.42s ease,
    transform 0.72s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (min-width: 1024px) {
  .auth-layout__collage {
    display: block;
    width: 0;
    padding: 0;
  }

  .auth-layout--split .auth-layout__collage {
    width: 55%;
    padding: 0.75rem;
    opacity: 1;
    transform: scale(1);
  }
}

.auth-visual-enter-active,
.auth-visual-leave-active {
  transition: opacity 0.58s ease, transform 0.72s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.58s ease;
}

.auth-visual-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.975);
  filter: blur(10px);
}

.auth-visual-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(1.012);
  filter: blur(8px);
}

.auth-layout__main {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  transition: flex-basis 0.72s cubic-bezier(0.16, 1, 0.3, 1);
}

.auth-layout__slot {
  display: grid;
  flex: 1;
  place-items: center;
  padding: 3rem 1.5rem;
}

.auth-layout__slot > :deep(*) {
  width: 100%;
  max-width: 420px;
}

.auth-layout__footer {
  padding-bottom: 1.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: #94a3b8;
}
</style>

<style>
html.dark .auth-layout {
  background-color: #0b1120;
  color: #f8fafc;
}

html.dark .auth-layout__footer {
  color: #64748b;
}
</style>
