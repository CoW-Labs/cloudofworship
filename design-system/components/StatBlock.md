# StatBlock

A stack of big condensed numbers with a caption and hairline under each.

**Provide** a `.ds-stats` with an optional `.ds-stat-label`, then `.ds-stat` items of `.ds-stat-number`, `.ds-stat-caption` and `.ds-stat-divider`.

**Use** real, current figures only: 3500+ churches served, 99% uptime during service hours, 63+ countries. Numbers rise and fade in on scroll (600ms).
**Don't** invent numbers, add units in a smaller size, or show more than three.

**Group:** Data

## Markup

```html
<div class="ds-stats">
<p class="ds-stat-label">The result</p>
<div class="ds-stat"><p class="ds-stat-number">3500+</p><p class="ds-stat-caption">Churches served</p><div class="ds-stat-divider"></div></div>
<div class="ds-stat"><p class="ds-stat-number">99%</p><p class="ds-stat-caption">Uptime during service hours</p><div class="ds-stat-divider"></div></div>
</div>
```
