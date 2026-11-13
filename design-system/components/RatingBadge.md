# RatingBadge

The trust chip above the hero headline: a star, a claim and a real rating, on the dark stage.

**Provide** a `<span class="ds-rating">` with a `.ds-rating-star` and one line: what we are, then the score and its source.

**Use** once, above the H1 on `surface-stage`. Keep the score current; it reads “4.4 on Trustpilot” today.
**Don't** round the score up or show a rating without its source. Its border and fill are recreated from a screenshot (white at 24% and 6%); the star is Trustpilot green.

**Group:** Labels

## Markup

```html
<span class="ds-rating"><span class="ds-rating-star" aria-hidden="true">★</span>Top-rated open source tool · 4.4 on Trustpilot</span>
```
