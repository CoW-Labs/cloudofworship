# TextLink

Two link treatments: a thick underline beside buttons, and a dotted violet underline inside headlines.

**Provide** an `<a>` with `.ds-text-link` (16px medium, 2px underline offset 5px; turns white on hover on the poster) or `.ds-dotted-link` inside display type (a dotted `violet-press` rule; hover adds an 8% violet wash).

**Use** `.ds-text-link` as the secondary action next to a PillButton. Use `.ds-dotted-link` on a phrase in a heading that opens an explanation (“pay *only if* your church needs it”).
**Don't** colour link text violet on purple, or use dotted links in body copy.

**Group:** Actions

## Markup

```html
<div class="stack">
<div style="background:var(--ds-surface-poster);color:var(--ds-night);padding:16px 20px;border-radius:12px"><a class="ds-text-link" href="#">How the license works</a></div>
<p class="ds-display" style="margin:0;font-weight:700;font-size:44px;line-height:1;color:var(--ds-ink-strong)">and pay <a class="ds-dotted-link" href="#">only if</a></p>
</div>
```
