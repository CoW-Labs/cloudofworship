<template>
  <div class="easyworship-import-main flex h-full min-h-0 flex-col">
    <div
      class="relative flex min-h-0 flex-1 flex-col rounded-xl bg-white p-1.5 dark:bg-[#222938]"
    >
      <!-- Scrolls under the floating CTA below. -->
      <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <div class="flex h-full flex-col gap-3">
          <!-- File picker (nothing parsed yet) -->
          <button
            v-if="!parsedSongs"
            type="button"
            :disabled="isParsing"
            class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 dark:border-gray-600 px-4 py-8 text-center hover:border-primary-400 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            @click="pickFile"
          >
            <IconWrapper name="i-ph-file-zip" size="6" class="text-gray-400" />
            <span class="text-sm font-medium">Choose EasyWorship backup (.zip)</span>
          </button>

          <!-- Status -->
          <div
            v-if="statusMessage"
            class="flex items-center gap-2 px-1 text-[13px] text-gray-500 dark:text-[#9BA3B2]"
          >
            <UIcon name="i-bx-loader-alt" class="animate-spin text-base" />
            <span>{{ statusMessage }}</span>
          </div>

          <!-- Error -->
          <Transition name="fade-sm">
            <div
              v-if="errorMessage"
              class="flex gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-sm text-red-700 dark:text-red-300"
            >
              <IconWrapper
                name="i-bx-error"
                size="4"
                class="text-red-500 shrink-0 mt-0.5"
              />
              <span>{{ errorMessage }}</span>
            </div>
          </Transition>

          <!-- Review step: pick which songs to keep -->
          <template v-if="parsedSongs">
            <div class="flex items-center justify-between gap-2 px-1 pt-2">
              <span class="text-[13px] font-medium text-gray-600 dark:text-[#cfd5e1]">
                {{ selectedCount }} of {{ parsedSongs.length }} selected
              </span>
              <button
                type="button"
                class="text-[12px] text-primary-500 hover:text-primary-600 dark:text-primary-400"
                @click="toggleSelectAll"
              >
                {{ allSelected ? "Deselect all" : "Select all" }}
              </button>
            </div>

            <div
              class="flex-1 min-h-0 rounded-md bg-[#f1f3f6] dark:bg-[#1b2130] p-1.5"
            >
              <!-- Hover a row for a preview of its lyrics (ActionCard's own
              teleported preview — same as the saved-songs list). -->
              <RecycleScroller
                class="h-full"
                :items="listItems"
                :item-size="64"
                key-field="id"
                v-slot="{ item }"
              >
                <ActionCard
                  :key="item.id"
                  :action="toPreviewAction(item)"
                  compact
                  show-subtext
                  :class="{ 'opacity-50': !selected[item.id] }"
                >
                  <template #actions>
                    <UCheckbox
                      :model-value="selected[item.id]"
                      @update:model-value="toggleOne(item.id)"
                    />
                  </template>
                </ActionCard>
              </RecycleScroller>
            </div>
          </template>
        </div>
      </div>

      <!-- FLOATING CTA — content scrolls underneath it -->
      <Transition name="fade-sm">
        <div
          v-if="parsedSongs"
          class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white to-transparent p-3 pt-10 dark:from-[#222938] dark:via-[#222938]"
        >
          <CowButton
            variant="primary"
            class="pointer-events-auto"
            block
            size="lg"
            :disabled="selectedCount === 0 || isImporting"
            :loading="isImporting"
            @click="handleImport"
          >
            Import {{ selectedCount }} Song{{ selectedCount === 1 ? "" : "s" }}
          </CowButton>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOnline } from "@vueuse/core"
import type { QuickAction, Song } from "~/types"
import {
  parseEasyWorshipFile,
  importSelectedEasyWorshipSongs,
  type ParsedEasyWorshipSong,
} from "~/composables/useEasyWorshipImport"

const emit = defineEmits<{ close: []; imported: [] }>()
const isOnline = useOnline()

const selectedPath = ref<string | null>(null)
const isParsing = ref(false)
const isImporting = ref(false)
const statusMessage = ref("")
const errorMessage = ref("")

const parsedSongs = ref<ParsedEasyWorshipSong[] | null>(null)
const selected = ref<boolean[]>([])

const listItems = computed(
  () =>
    parsedSongs.value?.map((song, id) => ({ id, ...song })) || []
)
const selectedCount = computed(
  () => selected.value.filter(Boolean).length
)
const allSelected = computed(
  () => selected.value.length > 0 && selected.value.every(Boolean)
)

// Gives each row to ActionCard so hovering it shows the same lyrics-preview
// tooltip the saved-songs list uses — the action name is never dispatched
// anywhere (no listener in appWideActions), it only unlocks that preview.
const toPreviewAction = (song: ParsedEasyWorshipSong & { id: number }): QuickAction => ({
  icon: "i-bx-music",
  name: song.title,
  desc: song.artist,
  action: "easyworship-import-preview",
  type: slideTypes.song,
  songData: {
    id: String(song.id),
    title: song.title,
    artist: song.artist,
    lyrics: song.lyrics,
  } as Song,
})

const toggleSelectAll = () => {
  const next = !allSelected.value
  selected.value = selected.value.map(() => next)
}

const toggleOne = (index: number) => {
  selected.value[index] = !selected.value[index]
}

const pickFile = async () => {
  errorMessage.value = ""
  statusMessage.value = ""
  parsedSongs.value = null

  try {
    const { open } = await import("@tauri-apps/plugin-dialog")
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "EasyWorship Backup", extensions: ["zip"] }],
    })
    if (typeof path !== "string") return
    selectedPath.value = path
  } catch (err) {
    console.error("EasyWorship import: file picker failed", err)
    errorMessage.value = "Couldn't open the file picker."
    return
  }

  await parseFile()
}

const parseFile = async () => {
  if (!selectedPath.value) return

  isParsing.value = true
  errorMessage.value = ""
  statusMessage.value = "Reading your song library…"
  usePosthogCapture("EASYWORSHIP_IMPORT_ATTEMPTED")

  try {
    const parsed = await parseEasyWorshipFile(selectedPath.value)
    parsedSongs.value = parsed.songs
    selected.value = parsed.songs.map(() => true)
  } catch (err: any) {
    console.error("EasyWorship import: parse failed", err)
    // A Tauri command's Err(String) rejects with the bare string.
    const message =
      (typeof err === "string" ? err : err?.message) ||
      "Something went wrong reading that file."
    errorMessage.value = message
    usePosthogCapture("EASYWORSHIP_IMPORT_FAILED", { error: message })
  } finally {
    isParsing.value = false
    statusMessage.value = ""
  }
}

const handleImport = async () => {
  if (!parsedSongs.value) return
  const songsToImport = parsedSongs.value.filter((_, i) => selected.value[i])
  if (songsToImport.length === 0) return

  // Offline, every song would be queued and replayed later while this
  // panel reports none added.
  if (!isOnline.value) {
    errorMessage.value = "You're offline. Connect to the internet to import."
    return
  }

  isImporting.value = true
  errorMessage.value = ""

  try {
    const importResult = await importSelectedEasyWorshipSongs(
      songsToImport,
      (done, total) => {
        statusMessage.value = `Importing song ${done} of ${total}…`
      }
    )
    usePosthogCapture("EASYWORSHIP_IMPORT_COMPLETED", {
      importedCount: importResult.importedCount,
      skippedDuplicates: importResult.skippedDuplicates,
      failedCount: importResult.failedCount,
      totalParsed: importResult.totalParsed,
    })
    // The library tab reads from its own synced copy, not this response.
    await useLibrary().refreshLibrary()

    const { importedCount, skippedDuplicates, failedCount } = importResult
    const notes = [
      skippedDuplicates && `${skippedDuplicates} already in your library`,
      failedCount && `${failedCount} couldn't be added. Try importing again.`,
    ].filter(Boolean)
    useToast().add({
      icon: failedCount ? "i-bx-error" : "i-bx-check-circle",
      title: `Added ${importedCount} song${importedCount === 1 ? "" : "s"} to your library`,
      description: notes.length ? notes.join(". ") : undefined,
      color: failedCount ? "amber" : "green",
    })
    emit("imported")
  } catch (err: any) {
    console.error("EasyWorship import error:", err)
    const message = err?.message || "Something went wrong during import."
    errorMessage.value = message
    usePosthogCapture("EASYWORSHIP_IMPORT_FAILED", { error: message })
  } finally {
    isImporting.value = false
    statusMessage.value = ""
  }
}

onMounted(() => {
  usePosthogCapture("EASYWORSHIP_IMPORT_OPENED")
})
</script>
