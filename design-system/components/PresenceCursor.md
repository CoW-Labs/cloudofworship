# PresenceCursor

Named cursors and stacked avatars that show several volunteers working on one service at once.

**Provide** a `.ds-presence blue|gold|violet` with the cursor SVG and a `.ds-presence-label` first name; or a `.ds-avatars` row of `.ds-avatar` initials.

**Use** around statements about teamwork (“Your service should not depend on one person…”). Cursors drift slowly; avatars ring in `lavender-wash` (`shadow-avatar-ring`).
**Contrast** white on `cursor-violet` (2.9:1) and `cursor-blue` (3.2:1) only passes as large/bold text, so keep labels 14px semibold or larger and never use these fills for body text.

**Group:** Collaboration

## Markup

```html
<div class="row" style="gap:28px">
<span class="ds-presence blue"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 2 L18 8 L10.5 10.5 L8 18 Z" fill="#0c0f19" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="ds-presence-label">Lanre O.</span></span>
<span class="ds-presence gold"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 2 L18 8 L10.5 10.5 L8 18 Z" fill="#0c0f19" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="ds-presence-label">Inioluwa</span></span>
<span class="ds-presence violet"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 2 L18 8 L10.5 10.5 L8 18 Z" fill="#0c0f19" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="ds-presence-label">Favour</span></span>
<span class="ds-avatars"><span class="ds-avatar" style="background:var(--ds-cursor-violet)">FF</span><span class="ds-avatar" style="background:var(--ds-cursor-blue)">LO</span><span class="ds-avatar" style="background:var(--ds-cursor-gold);color:var(--ds-ink-900)">IA</span></span>
</div>
```
