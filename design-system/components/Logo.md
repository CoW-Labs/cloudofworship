# Logo

The cloud mark beside the name set in Bricolage Grotesque Bold: the lockup used in the nav and footer.

**Provide** an `<a class="ds-logo">` holding the mark as `<img>` (44px) and a `.ds-logo-name` span reading exactly “Cloud of Worship”.

**Pick the ink by ground**
- White, lavender-wash: `.cow-mark.svg` (gradient), name in `night`.
- `stage`, `night`, `black`: `.cow-mark-white.svg`, name in `white` (`.on-dark`).
- `surface-poster` purple: `.cow-mark-ink.svg`, name in `night` (`.on-poster`). Never put the gradient mark on purple: it disappears.

**Do** keep at least half the mark's width clear on every side. Let the mark stand alone as the app icon and favicon.
**Don't** recolour the gradient, stretch the mark, add shadows, set the name in Geist or the condensed face, or write “CoW” in the lockup.

**Group:** Brand

## Markup

```html
<div class="row" style="gap:0">
  <div style="padding:20px 24px;background:var(--ds-white)"><a class="ds-logo" href="#" style="color:var(--ds-night)"><img src="../assets/logos/cow-mark.svg" alt=""><span class="ds-logo-name">Cloud of Worship</span></a></div>
  <div style="padding:20px 24px;background:var(--ds-stage)"><a class="ds-logo on-dark" href="#"><img src="../assets/logos/cow-mark-white.svg" alt=""><span class="ds-logo-name">Cloud of Worship</span></a></div>
  <div style="padding:20px 24px;background:var(--ds-purple-500)"><a class="ds-logo on-poster" href="#"><img src="../assets/logos/cow-mark-ink.svg" alt=""><span class="ds-logo-name">Cloud of Worship</span></a></div>
</div>
```
