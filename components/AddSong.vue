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
          placeholder="Hallelujah Eh! It's the sound of Victory"
          variant="none"
          rows="12"
          color="gray"
          resize="vertical"
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
  song: Song
}>()
const loading = ref<boolean>(false)
const artist = ref<string>(props.song?.artist || "")
const title = ref<string>(props.song?.title || "")
const lyrics = ref<string>(props.song?.lyrics || "")
const isSongPublic = ref<boolean>(props.song?.isPublic || true)
const toast = useToast()
const emit = defineEmits(["go-home"])
const authStore = useAuthStore()

const addSong = async () => {
  const db = useIndexedDB()
  const songId =
    props?.song?.id || useURLFriendlyString(`${title.value} ${artist.value}`)
  const song: Song = {
    id: songId,
    title: title.value,
    artist: artist.value,
    lyrics: lyrics.value,
    createdBy: "me",
  }
  try {
    loading.value = true
    await db.library.add(
      {
        id: songId,
        type: "song",
        content: song,
        createdAt: props.song?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      songId
    )
    toast.add({ icon: "i-bx-save", title: "Song saved to Library" })
  } catch (err: any) {
    if (err.name === "ConstraintError") {
      if (props.song) {
        await db.library.update(songId, {
          id: songId,
          type: "song",
          content: song,
          createdAt: props.song?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        toast.add({
          icon: "i-bx-save",
          title: "Song updated in library",
        })
      } else {
        toast.add({
          icon: "i-bx-error",
          title: "Can't add a song twice",
          color: "red",
        })
      }
    } else if (err.name === "DataCloneError") {
      // toast.add({ icon: 'i-bx-save', title: 'Item added to Library' })
    } else {
      // console.log(err)
    }
  } finally {
    loading.value = false
    if (props.song) {
      // updateSongInAPI()
    } else {
      uploadSongToAPI(song)
    }
    emit("go-home")
  }
}

const uploadSongToAPI = async (song: Song) => {
  try {
    // loading.value = true
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
      toast.add({ icon: "i-bx-error", title: error.value })
    } else {
      // console.log("data", data.value)
      loading.value = false
      toast.add({ icon: "i-bx-save", title: "Song uploaded" })
      emit("go-home")
    }
  } catch (err: any) {
  } finally {
    loading.value = false
  }
}

// const updateSongInAPI = async () => {
//   const songId = useURLFriendlyString(`${title.value} ${artist.value}`)
//   const song: Song = {
//     ...props.song,
//     id: songId,
//     title: title.value,
//     artist: artist.value,
//     lyrics: lyrics.value,
//     isPublic: isSongPublic.value,
//     createdBy: authStore.user?._id,
//     churchId: authStore.user?.churchId,
//   }
//   try {
//     // loading.value = true
//     const { data, error } = await useAPIFetch(
//       `/church/${authStore.user?.churchId}/songs/${props.song?._id}`,
//       {
//         method: "PUT",
//         body: song,
//       }
//     )

//     // If error occurred
//     if (error.value) {
//       toast.add({ icon: "i-bx-error", title: error.value })
//     } else {
//       // console.log("data", data.value)
//       loading.value = false
//       toast.add({ icon: "i-bx-save", title: "Song updated" })
//       emit("go-home")
//     }
//   } catch (err: any) {
//   } finally {
//     loading.value = false
//   }
// }
</script>
