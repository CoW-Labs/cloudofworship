<template>
  <div
    class="min-h-[100vh] w-[100%] bg-[radial-gradient(circle,#cd99ff,white,white)] dark:bg-[radial-gradient(circle,#31005f,rgb(17,24,39),rgb(17,24,39))] grid place-items-center"
  >
    <h2
      class="text-[6vw] text-center font-black stroke-current w-[100%] text-transparent absolute bottom-[5%]"
      :class="
        $colorMode.value === 'dark' ? 'outlined-text-dark' : 'outlined-text'
      "
    >
      Your church's power point.
    </h2>
    <div
      class="auth-box bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-gray-950 p-[3rem] py-[5%] max-w-[450px] w-[100%] shadow-primary-200 relative"
    >
      <slot />
    </div>
  </div>
</template>

<script setup>
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"
useHead({
  title: "Cloud of Worship",
})

const handleGoogleSignIn = async () => {
  const provider = new GoogleAuthProvider()
  return await signInWithPopup(useFirebaseAuth(), provider)
}

provide("handleGoogleSignIn", handleGoogleSignIn)
</script>

<style scoped>
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
</style>
