# PricingTicket

The Teams price shown as an admission ticket: a white top with the price, a perforated tear line, and a stub with the giving pledge.

**Provide** a `.ds-ticket` with `.ds-ticket-top` (SegmentedToggle, `.ds-price`, `.ds-price-unit`, full-width PillButton), `.ds-ticket-perf`, and `.ds-ticket-stub` holding the pledge in `.ds-ticket-fine`.

**Rules** one plan, one price, in `display-stat`. State the full terms in a visually hidden sentence (“Teams plan: $10 a month, billed monthly, or $9 a month, billed annually at $108.”). The ticket straddles the light pricing section and the night testimonials below it.
**Don't** build a three-column plan table; the brand sells one plan.

**Group:** Cards

## Markup

```html
<div class="ds-ticket">
<div class="ds-ticket-top"><div class="ds-toggle" role="group" aria-label="Billing period"><button aria-pressed="true">Monthly</button><button aria-pressed="false">Annual <span class="ds-badge">10% off</span></button></div>
<p class="ds-price">$10</p><p class="ds-price-unit">Billed monthly</p><a class="ds-pill-btn" href="#" style="width:100%">Get started</a></div>
<div class="ds-ticket-perf"></div>
<div class="ds-ticket-stub"><p class="ds-ticket-fine">90% of profits from Teams plan sales go directly to efforts pushing the gospel forward in churches across Africa and other regions.</p></div>
</div>
```
