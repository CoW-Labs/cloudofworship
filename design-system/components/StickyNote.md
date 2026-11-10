# StickyNote

A tilted pastel note with a heart disc, pinned beside the pricing ticket to answer an objection in a friendly voice.

**Provide** a `.ds-note sky|butter` with a `.ds-icon-disc` (heart icon), a `.ds-note-text` of one or two sentences, and optionally a dark PillButton. Tilt with `.tilt-l` (-4°) or `.tilt-r` (5°).

**Use** at most two, overlapping the edges of the PricingTicket. The copy speaks plainly and may joke (“or 8.5 hours if we're asleep :)”).
**Don't** put feature lists or prices on notes.

**Group:** Cards

## Markup

```html
<div class="row" style="gap:40px;padding:12px 8px">
<div class="ds-note sky tilt-l"><span class="ds-icon-disc"><img src="../assets/icons/heart.svg" alt=""></span><p class="ds-note-text">Save at least 10 minutes every Sunday with Teams by reusing songs added by nearby churches.</p></div>
<div class="ds-note butter tilt-r"><span class="ds-icon-disc"><img src="../assets/icons/heart.svg" alt=""></span><p class="ds-note-text">Monthly cost too high? Tell us what your church can afford. We’ll reply in about 30 minutes—or 8.5 hours if we’re asleep :)</p><span><a class="ds-pill-btn dark" href="#">Contact us</a></span></div>
</div>
```
