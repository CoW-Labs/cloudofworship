<template>
  <div class="min-h-[100vh] w-[100%] flex overflow-hidden">
    <div class="hidden lg:grid lg:w-3/5 place-items-center text-white">
      <div
        class="h-[92.5%] w-[95%] rounded-2xl lg:flex bg-gradient-to-br from-[#FF6F65] via-primary-800 to-primary-900 p-16 flex-col justify-between text-white"
      >
        <div>
          <div class="flex items-center gap-3 mb-16">
            <CoWLogo class="w-80 blur-in-0 opacity-0" />
          </div>

          <div class="space-y-4 blur-in-1 opacity-0">
            <h1 class="text-6xl font-light leading-tight">
              <div class="font-semibold">Join 1,200+ churches</div>
              delivering great on-screen experiences to their congregations.
            </h1>
          </div>
        </div>

        <div class="text-xs opacity-0 blur-in-2">
          <p class="opacity-80">
            &copy; {{ new Date().getFullYear() }} Cloud of Worship (CoW Labs).
            All rights reserved.
          </p>
        </div>
      </div>
    </div>

    <!-- Right Side - Auth Form -->
    <!-- <div
      class="w-full lg:w-2/5 bg-[radial-gradient(circle,#cd99ff,white,white)] dark:bg-[radial-gradient(circle,#31005f,rgb(17,24,39),rgb(17,24,39))] grid place-items-center lg:p-8"
    > -->
    <div class="w-full lg:w-2/5 grid place-items-center lg:p-8">
      <div
        class="auth-box bg-white dark:bg-gray-900 rounded-2xl p-[3rem] py-[5%] max-w-[450px] w-[100%] relative"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UserCredential } from "firebase/auth"

useHead({
  title: "Cloud of Worship",
})

const { handleGoogleSignIn: tauriGoogleSignIn } = useTauriGoogleAuth()

const handleGoogleSignIn = async (): Promise<UserCredential> => {
  return await tauriGoogleSignIn()
}

provide("handleGoogleSignIn", handleGoogleSignIn)
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap");

h1 {
  font-family: "Bricolage Grotesque", system-ui, -apple-system, "Segoe UI",
    Roboto, "Helvetica Neue", Arial;
}

.bg-radial-gradient {
  background: radial-gradient(circle, #31005f, white, white);
}
.dark-bg-radial-gradient {
  background: radial-gradient(circle, #cd99ff, black, black);
}
.outlined-text {
  -webkit-text-stroke: 1px #a855f760;
}
.outlined-text-dark {
  -webkit-text-stroke: 1px #a855f7;
}

@keyframes blurIn {
  0% {
    filter: blur(10px);
    transform: translateY(20px);
    opacity: 0;
  }
  100% {
    filter: blur(0px);
    transform: translate(0px);
    opacity: 1;
  }
}

.blur-in-0 {
  animation: blurIn 0.5s ease-out 0s forwards;
}

.blur-in-1 {
  animation: blurIn 0.5s ease-out 0.2s forwards;
}

.blur-in-2 {
  animation: blurIn 0.5s ease-out 0.4s forwards;
}
</style>
