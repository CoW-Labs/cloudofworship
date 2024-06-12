<template>
  <button
    class="action-card flex gap-3 p-2 py-4 border-t first:border-t-0 border-gray-100 dark:border-primary-950 hover:rounded-md hover:bg-primary-50 dark:hover:bg-primary-800 transition-all cursor-pointer text-left w-[100%]"
    @click="
      useGlobalEmit(
        `new-${type || slideTypes.song}`,
        type === slideTypes.hymn ? song?.number : { ...song, fromSaved: saved }
      )
    "
  >
    <IconWrapper name="i-bx-music" class="mt-1 text-primary" rounded-bg />
    <div class="texts">
      <h4 class="font-semibold break-all">
        {{ song?.title || "" }}
      </h4>
      <p class="font-light text-xs mt-1 break-all">
        {{ song?.artist || song?.author || "" }}
      </p>
      <p
        v-if="song?.author === 'me'"
        class="font-light text-primary-500 text-2xs mt-1"
      >
        compiled by <b class="font-bold">me</b>
      </p>
    </div>
    <div v-if="saved" class="actions flex absolute bottom-1 right-1">
      <UTooltip text="Edit song" :popper="{ arrow: true }">
        <UButton
          size="xs"
          variant="ghost"
          icon="i-bx-edit"
          @click.stop.prevent="$emit('edit-song', song)"
        ></UButton>
      </UTooltip>

      <ConfirmDialog
        button-icon="i-tabler-trash"
        button-styles="px-1 text-xs text-red-500 hover:bg-primary-white"
        button-size="xs"
        header="Delete song"
        label="Are you sure you want to delete this song from your library? This action is not reversible"
        @confirm="$emit('delete-song', song?.id)"
      >
      </ConfirmDialog>
    </div>
    <div
      class="song-excerpt text-xs absolute w-100 rounded-xl bg-white dark:bg-gray-800 bg-primary-100rounded-lg w-[300px] max-h-[200px] overflow-hidden shadow-lg truncate whitespace-pre-line text-ellipsis z-50"
    >
      <AppSection heading="Lyrics Preview">
        <p class="px-2">{{ song?.lyrics?.trim() }}</p>
      </AppSection>
      <IconWrapper
        name="i-bx-music"
        size="24"
        class="absolute -bottom-4 -right-4 text-primary-500 opacity-15"
      />
      <h3 class="font-semibold mb-1">Lyrics Preview</h3>
    </div>
  </button>
</template>
<script setup lang="ts">
import type { Hymn, Song } from "~/types"

const props = defineProps<{
  type: String
  saved: boolean
  song: Song | Hymn
}>()
</script>

<style scoped>
.action-card .actions {
  visibility: hidden;
  opacity: 0;
  transform: translateX(10px);
  transition: 0.3s;
}

.action-card:hover .actions {
  visibility: visible;
  opacity: 1;
  transform: translateX(0);
}
.action-card:hover .song-excerpt {
  visibility: visible;
  opacity: 1;
  transform: translateX(0px);
}
.song-excerpt {
  visibility: hidden;
  opacity: 0;
  transition: 0.2s;
  transform: translateX(-30px);
  left: 350px;
  top: 30vh;
}
</style>
