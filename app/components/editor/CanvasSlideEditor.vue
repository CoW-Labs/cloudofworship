<template>
  <div
    ref="root"
    class="canvas-editor absolute inset-0 z-20 outline-none"
    :class="passThrough ? 'pointer-events-none' : ''"
    tabindex="-1"
    @keydown="onKeydown"
    @pointerdown.self="selectedId = null"
  >
    <div
      v-for="box in shown"
      :key="box.id"
      class="canvas-box absolute"
      :class="{
        'is-selected': box.id === selectedId,
        'is-editing': box.id === editingId,
        // A text slide's own boxes hold a live editor, so only their edge and
        // corners take the pointer; a custom box has nothing to type into.
        'is-pass': passThrough && box.source !== 'custom',
      }"
      :style="boxFrameStyle(box)"
      @pointerdown="onBoxDown($event, box)"
      @dblclick="startEdit(box)"
    >
      <template v-if="passThrough && box.source !== 'custom'">
        <span
          v-for="edge in edges"
          :key="edge"
          class="canvas-edge absolute"
          :class="`edge-${edge}`"
          @pointerdown="onBoxDown($event, box)"
        ></span>
      </template>

      <template v-if="box.id === selectedId && box.id !== editingId">
        <span
          v-for="corner in corners"
          :key="corner"
          class="canvas-handle absolute"
          :class="`handle-${corner}`"
          @pointerdown="onHandleDown($event, box, corner)"
        ></span>
      </template>

      <!-- Typing into a custom box. It takes the look of the text it covers, so
           what is typed reads as it will on screen. -->
      <div
        v-if="box.id === editingId"
        :ref="setEditEl"
        class="canvas-edit"
        :style="editStyle"
        contenteditable="plaintext-only"
        spellcheck="false"
        @vue:mounted="seedEdit"
        @pointerdown.stop
        @blur="finishEdit(true)"
        @keydown.enter.exact.prevent="finishEdit(true)"
        @keydown.esc.stop.prevent="finishEdit(false)"
      ></div>
    </div>

    <!-- Guides while a box moves: the slide's centre, always, and any edge or
         centre the box has reached. -->
    <template v-if="gesture.active.value">
      <span
        v-for="x in guideLines.x"
        :key="`x${x}`"
        class="canvas-guide canvas-guide-v"
        :class="{ 'is-lit': gesture.guides.value.x.includes(x) }"
        :style="{ left: `${x * 100}%` }"
      ></span>
      <span
        v-for="y in guideLines.y"
        :key="`y${y}`"
        class="canvas-guide canvas-guide-h"
        :class="{ 'is-lit': gesture.guides.value.y.includes(y) }"
        :style="{ top: `${y * 100}%` }"
      ></span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core"
import type { Slide, SlideStyle, TextBox } from "~/types"
import { useBoxGesture, type BoxHandle } from "~/composables/useBoxGesture"
import {
  claimCanvasEditor,
  publishCanvasEditor,
  releaseCanvasEditor,
} from "~/composables/useCanvasEditor"
import { cancelLayoutJob, scheduleLayoutJob, type LayoutJob } from "~/utils/layoutBatch"
import {
  boxFrameStyle,
  boxesFromRects,
  canAddBox,
  clampBox,
  htmlToText,
  newCustomBox,
  roundBox,
  slotOfBlock,
  textBoxesOf,
  textToHtml,
} from "~/utils/textBoxes"

const props = defineProps<{
  slide: Slide
  /**
   * The slide's text is edited in place by an editor inside each box (a text
   * slide), so a click inside a box must reach it. Only the box's edge and
   * corners move it.
   */
  passThrough?: boolean
}>()

const emit = defineEmits<{
  (e: "update-style", style: SlideStyle): void
}>()

const corners: BoxHandle[] = ["nw", "ne", "sw", "se"]
const edges = ["top", "right", "bottom", "left"] as const

const root = ref<HTMLElement | null>(null)
const selectedId = ref<string | null>(null)

// A slide that still follows its layout has no boxes of its own. Its blocks
// are measured off the screen so they can be grabbed, and are saved only when
// one is first changed, so opening a schedule never writes anything.
const stored = computed(() => textBoxesOf(props.slide))
const measured = ref<TextBox[]>([])
const current = computed<TextBox[]>(() => stored.value ?? measured.value)

const gesture = useBoxGesture({
  frame: () => root.value,
  boxes: () => current.value,
  onCommit: (box, handle) => {
    commit(current.value.map((other) => (other.id === box.id ? box : other)))
    usePosthogCapture(
      handle === "move" ? "CANVAS_BOX_MOVED" : "CANVAS_BOX_RESIZED",
      { slideType: props.slide.type }
    )
  },
})

const shown = computed(() =>
  gesture.draft.value
    ? current.value.map((box) =>
        box.id === gesture.draft.value!.id ? gesture.draft.value! : box
      )
    : current.value
)

const selected = computed(
  () => current.value.find((box) => box.id === selectedId.value) ?? null
)

// The centre is always shown while a box moves; the rest appear as the box
// reaches them.
const guideLines = computed(() => ({
  x: [...new Set([0.5, ...gesture.guides.value.x])],
  y: [...new Set([0.5, ...gesture.guides.value.y])],
}))

const commit = (boxes: TextBox[]) =>
  emit("update-style", { ...props.slide.slideStyle, textBoxes: boxes })

// ── Measuring the layout the slide has today ────────────────────────────────
// The element each measured box was read from, so a box that has not been saved
// yet can still carry its text along while it moves.
const measuredBlocks = new Map<string, HTMLElement>()

const measureJob: LayoutJob = {
  read: () => {
    const frame = root.value
    const stage = frame?.parentElement
    // Not mid-drag: a block that is being carried reports its carried position.
    if (!frame || !stage || stored.value || gesture.active.value) return
    const frameRect = frame.getBoundingClientRect()
    const blocks = Array.from(
      stage.querySelectorAll(".slide-layout-ctn > *")
    ).filter(
      (block): block is HTMLElement =>
        block instanceof HTMLElement &&
        !block.classList.contains("bible-overlay-scrim")
    )
    const range = document.createRange()
    const read = blocks.map((block, index) => {
      range.selectNodeContents(block)
      const words = range.getBoundingClientRect()
      return {
        block,
        slot: slotOfBlock(block, index, props.slide.layout),
        rect: block.getBoundingClientRect(),
        text: { left: words.left, width: words.width },
      }
    })
    measuredBlocks.clear()
    read.forEach(({ slot, block }) => measuredBlocks.set(`slot-${slot}`, block))
    const next = boxesFromRects(frameRect, read)
    // Verse navigation re-measures on every step, and the blocks usually sit
    // where they were. Keep the old array then, so nothing re-renders.
    if (!sameBoxes(measured.value, next)) measured.value = next
  },
}

const sameBoxes = (a: TextBox[], b: TextBox[]) =>
  a.length === b.length &&
  a.every(
    (box, i) =>
      box.id === b[i]!.id &&
      box.x === b[i]!.x &&
      box.y === b[i]!.y &&
      box.w === b[i]!.w &&
      box.h === b[i]!.h
  )

const measureSoon = useDebounceFn(() => scheduleLayoutJob(measureJob), 120)

watch(
  () => [
    props.slide.id,
    props.slide.layout,
    props.slide.contents?.join("|"),
    props.slide.slideStyle?.fontSize,
    props.slide.slideStyle?.fontSizePercent,
    props.slide.slideStyle?.font,
    props.slide.slideStyle?.alignment,
    props.slide.slideStyle?.theme,
    props.slide.slideStyle?.autoFitLines,
    props.slide.slideStyle?.lineSpacing,
    props.slide.slideStyle?.windowPadding?.top,
    props.slide.slideStyle?.windowPadding?.right,
    props.slide.slideStyle?.windowPadding?.bottom,
    props.slide.slideStyle?.windowPadding?.left,
    !!stored.value,
  ],
  () => {
    if (!stored.value) measureSoon()
  },
  { flush: "post" }
)
watch(
  () => props.slide.id,
  () => {
    selectedId.value = null
    editingId.value = null
    measured.value = []
  }
)

// ── Interaction ─────────────────────────────────────────────────────────────
const claimFocus = () => root.value?.focus({ preventScroll: true })

const onBoxDown = (event: PointerEvent, box: TextBox) => {
  // A press on a text slide's own box that is not on its edge belongs to the
  // editor inside it. (The edge strips and custom boxes land here.)
  if (editingId.value === box.id) return
  selectedId.value = box.id
  claimFocus()
  gesture.begin(event, box, "move")
}
const onHandleDown = (event: PointerEvent, box: TextBox, corner: BoxHandle) =>
  gesture.begin(event, box, corner)

// Clicking into a text slide's box puts the caret in its editor, which never
// touches the canvas, so selection follows focus instead.
const onFocusIn = (event: FocusEvent) => {
  const id = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-box]")
    ?.dataset.box
  if (id && current.value.some((box) => box.id === id)) selectedId.value = id
}

const addBox = () => {
  if (!canAddBox(current.value)) return
  const box = newCustomBox(current.value)
  commit([...current.value, box])
  selectedId.value = box.id
  pendingEdit.value = box.id
  usePosthogCapture("CANVAS_BOX_ADDED", { slideType: props.slide.type })
}

const removeBox = () => {
  const box = selected.value
  if (!box || box.source !== "custom") return
  commit(current.value.filter((other) => other.id !== box.id))
  selectedId.value = null
  usePosthogCapture("CANVAS_BOX_DELETED", { slideType: props.slide.type })
}

const resetLayout = () => {
  const { textBoxes: _boxes, ...rest } = props.slide.slideStyle ?? {}
  selectedId.value = null
  editingId.value = null
  emit("update-style", rest)
  usePosthogCapture("CANVAS_LAYOUT_RESET", { slideType: props.slide.type })
}

// Size and alignment of the selected box come from the toolbars.
const patchSelected = (patch: Partial<TextBox>) => {
  const box = selected.value
  if (!box) return
  commit(
    current.value.map((other) =>
      other.id === box.id ? roundBox(clampBox({ ...other, ...patch })) : other
    )
  )
  usePosthogCapture("CANVAS_BOX_STYLED", {
    slideType: props.slide.type,
    property: Object.keys(patch)[0],
  })
}

const NUDGE = 0.005

// Moves the selected box one step, the same way a drag does. Returns whether
// the key was an arrow.
const nudge = (event: KeyboardEvent) => {
  const box = selected.value
  if (!box) return false
  const step = event.shiftKey ? NUDGE * 4 : NUDGE
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const move = moves[event.key]
  if (!move) return false
  event.preventDefault()
  commit(
    current.value.map((other) =>
      other.id === box.id
        ? roundBox(clampBox({ ...other, x: box.x + move[0], y: box.y + move[1] }))
        : other
    )
  )
  usePosthogCapture("CANVAS_BOX_MOVED", { slideType: props.slide.type, method: "keyboard" })
  return true
}

const onKeydown = (event: KeyboardEvent) => {
  const box = selected.value
  if (!box || editingId.value) return
  if (nudge(event)) return
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault()
    removeBox()
  } else if (event.key === "Escape") {
    selectedId.value = null
  } else if (event.key === "Enter") {
    event.preventDefault()
    startEdit(box)
  }
}

// While a box is selected the arrows belong to it wherever the focus is (after
// a toolbar click, say), not to verse navigation, which steps aside. Typing
// keeps its arrows, and the other keys stay with the canvas itself.
const onWindowKeydown = (event: KeyboardEvent) => {
  if (!selected.value || editingId.value || event.defaultPrevented) return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (root.value?.contains(target)) return
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  )
    return
  nudge(event)
}

// A press anywhere outside this slide's editor (the schedule, the Live Output,
// another panel) lets go of the box, so the arrow keys go back to moving
// verses and slides. The toolbars sit inside the editor, so using them to style
// the box keeps it selected.
const onWindowPointerDown = (event: PointerEvent) => {
  if (!selectedId.value || editingId.value) return
  const editor = root.value?.closest("[data-cow-popover-boundary]") ?? root.value
  const target = event.target as Node | null
  if (target && editor?.contains(target)) return
  selectedId.value = null
}

// ── Moving the text with the box ────────────────────────────────────────────
// While a box moves, the text itself follows the pointer. It is moved with the
// `translate` property, which the browser does on the compositor with no layout
// and no re-wrapping, and which composes with any transform the text already
// has (a rotated Bible label). Nothing is saved until the drop, so no other
// window, teammate or store hears about it. Resizing re-wraps the text, so that
// stays an outline until release.
let dragBlock: HTMLElement | null = null
let dragOrigin: TextBox | null = null
let dragFrame = { width: 1, height: 1 }
let releaseTimer: ReturnType<typeof setTimeout> | undefined

const blockFor = (id: string) =>
  (stored.value ? realBlock(id) : measuredBlocks.get(id)) ?? null

const releaseDragBlock = () => {
  clearTimeout(releaseTimer)
  if (dragBlock) {
    dragBlock.style.translate = ""
    dragBlock.style.willChange = ""
  }
  dragBlock = null
  dragOrigin = null
}

watch(
  () => gesture.draft.value,
  (draft) => {
    if (draft && gesture.handle.value === "move") {
      if (!dragBlock) {
        dragBlock = blockFor(draft.id)
        dragOrigin = current.value.find((box) => box.id === draft.id) ?? null
        const rect = root.value?.getBoundingClientRect()
        dragFrame = { width: rect?.width || 1, height: rect?.height || 1 }
        if (dragBlock) dragBlock.style.willChange = "translate"
      }
      if (dragBlock && dragOrigin) {
        dragBlock.style.translate = `${(draft.x - dragOrigin.x) * dragFrame.width}px ${
          (draft.y - dragOrigin.y) * dragFrame.height
        }px`
      }
      return
    }
    if (draft || !dragBlock) return
    // A click or a cancelled drag changes nothing, so the text goes straight
    // back. A drop is saved a moment later; the text stays where it was dropped
    // until the slide has drawn the new position, so it never jumps back first.
    if (!gesture.committed.value) releaseDragBlock()
    else releaseTimer = setTimeout(releaseDragBlock, 400)
  },
  { flush: "sync" }
)
watch(
  current,
  () => {
    if (!gesture.active.value) releaseDragBlock()
  },
  { flush: "post" }
)

// ── Typing into a custom box ────────────────────────────────────────────────
// The real text is hidden while it is edited and a plain editable element
// takes its place, dressed in the text's own computed style (read once, when
// editing starts). What is typed is plain text; size, alignment and the rest
// come from the toolbars like any other box.
const editingId = ref<string | null>(null)
const editStyle = ref<Record<string, string>>({})
const pendingEdit = ref<string | null>(null)
let editEl: HTMLElement | null = null
let hidden: HTMLElement | null = null
const setEditEl = (el: unknown) => {
  editEl = el instanceof HTMLElement ? el : null
}

const realBlock = (id: string) =>
  root.value?.parentElement?.querySelector<HTMLElement>(`[data-box="${CSS.escape(id)}"]`) ?? null

const startEdit = (box: TextBox) => {
  if (box.source !== "custom" || editingId.value) return
  const block = realBlock(box.id)
  if (!block) return
  const style = getComputedStyle(block)
  editStyle.value = {
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    color: style.color,
    textAlign: style.textAlign,
    textTransform: style.textTransform,
    textShadow: style.textShadow,
  }
  hidden = block
  block.style.visibility = "hidden"
  selectedId.value = box.id
  editingId.value = box.id
}

const seedEdit = () => {
  const el = editEl
  const box = current.value.find((other) => other.id === editingId.value)
  if (!el || !box) return
  el.innerText = htmlToText(box.html)
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

const finishEdit = (save: boolean) => {
  const id = editingId.value
  if (!id) return
  const text = (editEl?.innerText ?? "").replace(/\n+$/, "")
  editingId.value = null
  if (hidden) hidden.style.visibility = ""
  hidden = null
  const box = current.value.find((other) => other.id === id)
  if (save && box && text.trim() && textToHtml(text) !== box.html) {
    commit(
      current.value.map((other) =>
        other.id === id ? { ...other, html: textToHtml(text) } : other
      )
    )
  }
  claimFocus()
}

// A new box starts out being typed into, once the slide has drawn it.
watch(
  current,
  () => {
    const id = pendingEdit.value
    if (!id) return
    nextTick(() => {
      const box = current.value.find((other) => other.id === id)
      if (!box || !realBlock(id)) return
      pendingEdit.value = null
      startEdit(box)
    })
  },
  { flush: "post" }
)

// ── What the toolbars see ───────────────────────────────────────────────────
watch(
  () => [
    selected.value?.id,
    selected.value?.alignment,
    selected.value?.fontSizePercent,
    selected.value?.color,
    selected.value?.bold,
    selected.value?.uppercase,
    selected.value?.outlined,
    selected.value?.linesBackground,
    selected.value?.font,
    current.value.length,
    !!stored.value,
  ],
  () =>
    publishCanvasEditor({
      selected: selected.value
        ? {
            id: selected.value.id,
            alignment: selected.value.alignment,
            fontSizePercent: selected.value.fontSizePercent,
            color: selected.value.color,
            bold: selected.value.bold,
            uppercase: selected.value.uppercase,
            outlined: selected.value.outlined,
            linesBackground: selected.value.linesBackground,
            font: selected.value.font,
          }
        : null,
      canAdd: canAddBox(current.value),
      hasLayout: !!stored.value,
    }),
  { immediate: true }
)

let observer: ResizeObserver | null = null
let focusStage: HTMLElement | null = null
onMounted(() => {
  claimCanvasEditor(props.slide.id, {
    add: addBox,
    reset: resetLayout,
    patchSelected,
  })
  scheduleLayoutJob(measureJob)
  document.fonts?.ready.then(() => measureSoon())
  if (root.value && typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => !stored.value && measureSoon())
    observer.observe(root.value)
  }
  focusStage = root.value?.parentElement ?? null
  focusStage?.addEventListener("focusin", onFocusIn)
  window.addEventListener("keydown", onWindowKeydown)
  window.addEventListener("pointerdown", onWindowPointerDown, true)
})

// The bridge follows the open slide.
watch(
  () => props.slide.id,
  (id, previous) => {
    if (previous) releaseCanvasEditor(previous)
    claimCanvasEditor(id, { add: addBox, reset: resetLayout, patchSelected })
  }
)

onBeforeUnmount(() => {
  releaseDragBlock()
  if (hidden) hidden.style.visibility = ""
  cancelLayoutJob(measureJob)
  observer?.disconnect()
  focusStage?.removeEventListener("focusin", onFocusIn)
  window.removeEventListener("keydown", onWindowKeydown)
  window.removeEventListener("pointerdown", onWindowPointerDown, true)
  releaseCanvasEditor(props.slide.id)
})
</script>

<style scoped>
.canvas-box {
  /* The root passes pointers through on a text slide, and this property is
     inherited, so a box has to take them back. */
  pointer-events: auto;
  border: 1px dashed rgba(255, 255, 255, 0.45);
  border-radius: 4px;
  cursor: move;
  touch-action: none;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.canvas-box:hover {
  border-color: rgba(255, 255, 255, 0.85);
  background-color: rgba(255, 255, 255, 0.05);
}
.canvas-box.is-selected {
  border: 2px solid rgb(168, 85, 247); /* purple-500 */
  background-color: rgba(168, 85, 247, 0.08);
}
/* Clicks go through to the editor inside; the edge strips and corners remain. */
.canvas-box.is-pass {
  pointer-events: none;
  cursor: text;
}
.canvas-box.is-editing {
  display: flex;
  flex-direction: column;
  justify-content: center;
  cursor: text;
}

.canvas-edge {
  pointer-events: auto;
  cursor: move;
  touch-action: none;
}
.edge-top { left: 0; right: 0; top: -5px; height: 10px; }
.edge-bottom { left: 0; right: 0; bottom: -5px; height: 10px; }
.edge-left { top: 0; bottom: 0; left: -5px; width: 10px; }
.edge-right { top: 0; bottom: 0; right: -5px; width: 10px; }

.canvas-handle {
  pointer-events: auto;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #fff;
  border: 2px solid rgb(168, 85, 247);
  touch-action: none;
}
.handle-nw { left: -6px; top: -6px; cursor: nwse-resize; }
.handle-ne { right: -6px; top: -6px; cursor: nesw-resize; }
.handle-sw { left: -6px; bottom: -6px; cursor: nesw-resize; }
.handle-se { right: -6px; bottom: -6px; cursor: nwse-resize; }

.canvas-edit {
  outline: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: text;
}

/* One line each way: faint until the box reaches it, then lit. */
.canvas-guide {
  position: absolute;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.35);
}
.canvas-guide-v { top: 0; bottom: 0; width: 1px; }
.canvas-guide-h { left: 0; right: 0; height: 1px; }
.canvas-guide.is-lit {
  background: rgb(216, 180, 254); /* purple-300 */
  box-shadow: 0 0 0 0.5px rgba(168, 85, 247, 0.9);
}
</style>
