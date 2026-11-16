<template>
  <img
    v-if="flagUrl"
    :src="flagUrl"
    :alt="countryName"
    :title="countryName"
    class="shrink-0 rounded-[6px] object-cover"
    style="width: 24px; height: 18px"
    draggable="false"
  />
</template>

<script setup lang="ts">
import { bibleVersionObjects } from "~/utils/constants"
import { bibleVersionCountries, countryFlags } from "~/utils/flags"

// Flag for a Bible version's country, from the bundled flag map. The country comes from the
// API; the built-in catalogue covers versions saved before the API sent it.
const props = defineProps<{ versionId: string }>()

const { bibleVersionOptions } = useBibleVersionManager()

const version = computed(
  () =>
    bibleVersionOptions.value.find((v) => v.id === props.versionId) ||
    bibleVersionObjects.find((v) => v.id === props.versionId)
)
const fallback = computed(() => bibleVersionCountries[props.versionId])
const country = computed(() =>
  (version.value?.country || fallback.value?.country || "").toLowerCase()
)
const countryName = computed(
  () => version.value?.countryName || fallback.value?.countryName || ""
)
const flagUrl = computed(() => countryFlags[country.value] || "")
</script>
