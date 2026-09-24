<template>
  <div class="w-full">
    <div class="flex flex-col items-center text-center mb-8 come-up-1">
      <Logo class="w-32 h-32 mb-12" />
      <h1
        class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
      >
        Finish in your browser
      </h1>
      <p
        class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[22rem]"
      >
        We opened Cloud of Worship in your browser. Sign in there and it will
        bring you straight back here.
      </p>
    </div>

    <form
      class="flex flex-col gap-3.5 come-up-2"
      @submit.prevent="redeem(code)"
    >
      <CowInput
        label="Or paste the code from your browser"
        v-model="code"
        :error="redeemError"
        autocomplete="off"
        spellcheck="false"
      />

      <CowButton
        block
        type="submit"
        class="mt-3"
        :disabled="!code.trim()"
        :loading="redeeming"
      >
        Continue
      </CowButton>

      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        Browser didn't open?
        <button
          type="button"
          class="text-primary-500 dark:text-primary-400 font-medium hover:underline"
          @click="openBrowser"
        >
          Open it again
        </button>
        or
        <button
          type="button"
          class="text-primary-500 dark:text-primary-400 font-medium hover:underline"
          @click="cancel"
        >
          go back.
        </button>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
const { redeem, redeeming, redeemError, openBrowser, cancel } =
  useDesktopSignin()

const code = ref("")

watch(code, () => {
  redeemError.value = ""
})
</script>
