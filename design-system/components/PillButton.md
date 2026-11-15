# PillButton

The only button shape on the site: a 44px pill sitting on a solid ledge, so it reads as a physical key you press.

**Provide** an `<a>` or `<button>` with `class="ds-pill-btn"` and a short verb-first label. Add `.dark` for the graphite variant.

**Variants**
- Violet (`brand`, `shadow-pill`): the primary action. “Get started for free”, “Get started”, “That's Okay”.
- Dark (`graphite`, `shadow-pill-dark`): on the purple poster, where violet would vanish, and for secondary actions on light cards (“Contact us →”).

**States** hover lifts 4px and deepens the ledge (`shadow-pill-hover`); press sinks 4px (`shadow-pill-pressed`); focus draws a 2px `focus-ring` 3px out. Transitions are 80ms. Reduced motion drops the movement.

**Do** keep one violet pill per view. Write “Get started for free” for sign-up everywhere.
**Don't** use square or outlined buttons for actions, put a violet pill on `surface-poster`, or add icons other than a trailing arrow.

**Group:** Actions

## Markup

```html
<div class="stack">
<div class="row"><a class="ds-pill-btn" href="#">Get started for free</a><a class="ds-pill-btn is-hover" href="#">Hover</a><a class="ds-pill-btn is-pressed" href="#">Pressed</a></div>
<div class="row"><a class="ds-pill-btn dark" href="#">See the code on GitHub</a><a class="ds-pill-btn dark" href="#">Contact us <svg class="ds-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 8h11M9 4l4 4-4 4"/></svg></a></div>
</div>
```
