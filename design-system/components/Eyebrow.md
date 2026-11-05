# Eyebrow

An 11px uppercase label set above a display heading to name the section.

**Provide** a `<p class="ds-eyebrow">` with one or two words in sentence case; CSS uppercases it.

**Contrast** the site ships it in `violet-mist`, which is 2.5:1 on `lavender-wash` and fails WCAG for 11px text. For new work add `.accessible` to switch to `brand-text` (5.4:1 light, 7.2:1 dark).
**Don't** use more than one eyebrow per section or put sentences in it.

**Group:** Labels

## Markup

```html
<div class="stack" style="gap:12px"><p class="ds-eyebrow">Pricing</p><p class="ds-eyebrow accessible">Featured testimonials</p></div>
```
