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
          Add an empty line in between verses containing
          <span class="font-bold">[force-verse-break]</span> if you wish to
          force the lyrics to broken into verses. This feature is especially
          useful for adding worship lineup.
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
import type { Song } from "~/types"
const props = defineProps<{
  song: Song
}>()
const loading = ref<boolean>(false)
const artist = ref<string>(props.song?.artist || "")
const title = ref<string>(props.song?.title || "")
const lyrics = ref<string>(props.song?.lyrics || "")
const toast = useToast()
const emit = defineEmits(["go-home"])

const addSong = async () => {
  const db = useIndexedDB()
  const songId = useURLFriendlyString(`${artist.value} ${title.value}`)
  const song: Song = {
    id: songId,
    title: title.value,
    artist: artist.value,
    lyrics: lyrics.value,
    author: "me",
    createdAt: props.song?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  try {
    loading.value = true
    await db.library.add({ id: songId, type: "song", content: song }, songId)
    toast.add({ icon: "i-bx-save", title: "Song saved to Library" })
  } catch (err: any) {
    if (err.name === "ConstraintError") {
      if (props.song) {
        await db.library.update(songId, {
          id: songId,
          type: "song",
          content: song,
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
      console.log(err)
    }
  } finally {
    loading.value = false
    emit("go-home")
  }
}
</script>
