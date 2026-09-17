<script lang="ts">
import { defineComponent } from "vue"
import draggable from "vuedraggable"

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
 * The same context is also parked on the row element itself and survives both
 * cases, so recover it from there first. When even that is gone there is no
 * honest index to reorder by, and skipping the reorder leaves the model intact
 * and self-corrects on the next render — which beats throwing mid-service.
 */
const base = draggable as any

export default defineComponent({
  name: "CowDraggable",

  extends: base,

  methods: {
    /** True once `this.context` is usable for the row being dragged. */
    recoverDragContext(item: HTMLElement) {
      const self = this as any
      if (!self.context) self.context = self.getUnderlyingVm(item)
      return Boolean(self.context)
    },

    onDragStart(evt: any) {
      if (!this.recoverDragContext(evt.item)) return
      base.methods.onDragStart.call(this, evt)
    },

    onDragUpdate(evt: any) {
      if (!this.recoverDragContext(evt.item)) return
      base.methods.onDragUpdate.call(this, evt)
    },

    onDragRemove(evt: any) {
      if (!this.recoverDragContext(evt.item)) return
      base.methods.onDragRemove.call(this, evt)
    },
  },
})
</script>
