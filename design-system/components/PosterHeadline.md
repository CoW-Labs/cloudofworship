# PosterHeadline

A full-bleed `surface-poster` section with a giant condensed headline that mixes ExtraBold and ExtraLight words.

**Provide** an `<h1 class="ds-poster-head">` made of `.line` spans; wrap words in `.heavy` (800) or `.thin` (200). Follow it with a `.ds-poster-lede` and a dark PillButton plus a TextLink. Put the full sentence in a visually hidden span for screen readers when the visible words rotate.

**Rules** one or two thin words per headline, at the turn of the thought (“Open to *every* / church.”, “To the ends / *of the* earth.”). Text is `ink-on-poster`. Faint globe linework (`night` at 16%) may sit behind the type.
**Motion** words arrive one by one, each blurring into focus (900ms, `cubic-bezier(.2,.7,.2,1)`, 100ms apart). The last word may cycle (church, fellowship, ministry, event, person, country).
**Don't** use white text on purple, use the poster more than twice per page, or add photography to it.

**Group:** Sections

## Markup

```html
<section class="ds-poster" style="padding:24px 28px 28px">
<svg class="ds-globe" style="right:-180px;top:-200px;width:620px" viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="200" cy="200" r="190"/><ellipse cx="200" cy="200" rx="90" ry="190"/><ellipse cx="200" cy="200" rx="190" ry="70"/></svg>
<h1 class="ds-poster-head" style="font-size:132px"><span class="line"><span class="heavy">Open to</span> <span class="thin">every</span></span><span class="line heavy">church.</span></h1>
<p class="ds-poster-lede" style="font-size:20px;margin-top:20px">Cloud of Worship is open source. Read the code, change it and run it, free.</p>
</section>
```
