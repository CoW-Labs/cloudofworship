<template>
  <div class="add-song-main my-4">
    <form class="flex flex-col gap-3">
      <UFormGroup label="Title" size="lg">
        <UInput placeholder="Hallelujah Eh" v-model="title" />
      </UFormGroup>
      <UFormGroup label="Artist" size="lg">
        <UInput placeholder="Nathaniel Bassey" v-model="artist" />
      </UFormGroup>

      <div
        class="active-alert rounded-md bg-primary-100 dark:bg-primary-900 p-4"
      >
        <div
          class="text-sm text-primary-500 font-semibold flex items-center gap-2"
        >
          <IconWrapper name="i-bx-bulb" size="4"></IconWrapper>
          Hint
        </div>
        <p class="mt-2 text-sm">
          Add an
          <span class="font-bold">empty line</span> if you wish to forcefully
          break your lyrics into verses. This feature is especially useful for
          adding a worship lineup.
        </p>
      </div>
      <UFormGroup label="Lyrics" size="lg">
        <UTextarea
          autoresize
          placeholder="Hallelujah Eh! It's the sound of Victory"
          variant="none"
          :rows="12"
          color="gray"
          v-model="lyrics"
        />
      </UFormGroup>
      <UFormGroup size="lg">
        <div class="flex gap-2 items-center">
          <span>Share this song with other users?</span>
          <UToggle size="lg" v-model="isSongPublic" />
        </div>
      </UFormGroup>

      <UButton
        block
        :icon="song ? 'i-bx-edit' : 'i-bx-plus'"
        size="lg"
        class="mt-4"
        :disabled="!(artist && title && lyrics)"
        :loading="loading"
        @click="addSong"
      >
        {{ song ? "Edit Song" : "Add Song" }}
      </UButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useAuthStore } from "~/store/auth"
import type { Song } from "~/types"

const props = defineProps<{
  song?: Song
}>()

const { saveSong } = useLibrary()
const loading = ref<boolean>(false)
const artist = ref<string>(props.song?.artist || "")
const title = ref<string>(props.song?.title || "")
const lyrics = ref<string>(props.song?.lyrics || "")
const isSongPublic = ref<boolean>(props.song?.isPublic || true)
const toast = useToast()
const emit = defineEmits(["go-home"])
const authStore = useAuthStore()

const addSong = async () => {
  const songId =
    props?.song?.id || useURLFriendlyString(`${title.value} ${artist.value}`)
  const song: Song = {
    id: songId,
    title: title.value,
    artist: artist.value,
    lyrics: lyrics.value,
    createdBy: "me",
    createdAt: props.song?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  try {
    loading.value = true

    // Save song to library using composable
    await saveSong(song)

    // Upload to API if it's a new song
    if (!props.song) {
      await uploadSongToAPI(song)
    } else {
      // For editing, just emit go-home
      emit("go-home")
    }
  } catch (err: any) {
    console.error("Error adding song:", err)
  } finally {
    loading.value = false
  }
}

const uploadSongToAPI = async (song: Song) => {
  try {
    const { data, error } = await useAPIFetch(
      `/church/${authStore.user?.churchId}/songs`,
      {
        method: "POST",
        body: {
          ...song,
          isPublic: isSongPublic.value,
          createdBy: authStore.user?._id,
          churchId: authStore.user?.churchId,
        },
      }
    )

    // If error occurred
    if (error.value) {
      toast.add({
        icon: "i-bx-error",
        title: error.value.data?.message || "Failed to upload song",
        color: "red",
      })
    } else {
      emit("go-home")
    }
  } catch (err: any) {
    console.error("Error uploading song to API:", err)
    toast.add({
      icon: "i-bx-error",
      title: "Failed to upload song",
      color: "red",
    })
  } finally {
    loading.value = false
  }
}
</script>
