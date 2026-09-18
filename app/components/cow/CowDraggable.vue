<script lang="ts">
import { defineComponent } from "vue"
import draggable from "vuedraggable"
import { resolveDragContext, restoreDraggedRow } from "~/utils/dragContext"

/**
 * `vuedraggable` with its drop handlers hardened. Renders and behaves exactly
 * like the original — every prop, slot and event is inherited.
 *
 * vuedraggable captures the dragged row as `this.context` (`{ element, index }`)
 * in its drag-start handler, then reads `context.index` again on drop to know
 * where the row came from. Two things can break that pair:
 *
 * - drag start is wrapped in a guard that skips it whenever the bound list
 *   reads as `null` at that instant, so `context` stays `undefined` while the
 *   drop handler still runs. Production reported exactly this from the schedule
 *   list: `Cannot read properties of undefined (reading 'index')` inside
 *   `onDragUpdate`. Sortable had already moved the row in the DOM by then, so
 *   the operator was left looking at an order the model never received.
 * - `getUnderlyingVm` returns `null` for a row it cannot map back to the list,
 *   which drag start dereferences without checking.
 *
 * The row carries its own context. Recover it only when it still matches the
 * current list. If no valid context exists, restore Sortable's DOM move so the
 * visible order stays aligned with the model.
 */
const base = draggable as any

export default defineComponent({
  name: "CowDraggable",

  extends: base,

  methods: {
    recoverDragContext(item: HTMLElement, starting = false) {
      const self = this as any
      self.context = resolveDragContext(
        starting || self.draggedItem !== item ? null : self.context,
        self.getUnderlyingVm(item),
        self.realList,
      )
      return self.context !== null
    },

    onDragStart(evt: any) {
      const self = this as any
      // A previous drag's context must never authorize a different row.
      if (!this.recoverDragContext(evt.item, true)) {
        self.draggedItem = null
        delete evt.item._underlying_vm_
        return
      }
      self.draggedItem = evt.item
      base.methods.onDragStart.call(this, evt)
    },

    onDragUpdate(evt: any) {
      if (!this.recoverDragContext(evt.item)) {
        restoreDraggedRow(evt.item, evt.from, evt.oldIndex)
        return
      }
      base.methods.onDragUpdate.call(this, evt)
    },

    onDragRemove(evt: any) {
      if (!this.recoverDragContext(evt.item)) {
        restoreDraggedRow(evt.item, evt.from, evt.oldIndex)
        return
      }
      base.methods.onDragRemove.call(this, evt)
    },

    onDragAdd(evt: any) {
      if (evt.item._underlying_vm_ === undefined) {
        // The source may already have restored the row. Remove it only while
        // it is still sitting in the destination without a matching model item.
        if (evt.item.parentNode === evt.to) evt.to.removeChild(evt.item)
        return
      }
      base.methods.onDragAdd.call(this, evt)
    },

    onDragEnd(evt: any) {
      base.methods.onDragEnd.call(this, evt)
      const self = this as any
      self.context = null
      self.draggedItem = null
      if (evt?.item) delete evt.item._underlying_vm_
    },
  },
})
</script>
