# SegmentedToggle

A pill track with two or three segments; the chosen one fills with `night`.

**Provide** a `<div class="ds-toggle" role="group">` with `<button aria-pressed>` children. Keep labels to one word plus an optional Badge.

**Use** for the billing period on pricing. Animate the price between values with a short blur (200ms) when it changes.
**Don't** use it for navigation between pages or for more than three options.

**Group:** Controls

## Markup

```html
<div class="ds-toggle" role="group" aria-label="Billing period"><button aria-pressed="true">Monthly</button><button aria-pressed="false">Annual <span class="ds-badge">10% off</span></button></div>
```
