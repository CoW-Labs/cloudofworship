# Footer

A black footer with link columns, a one-line description, the copyright and the lockup on the right.

**Provide** columns titled Support, Resources, Unique Features and Legal, a blurb, social icons (Facebook, Instagram, YouTube) and “© CoW Labs, All Rights Reserved, <year>”.

**Colour** headings `white`, links `slate-400` (8.3:1 on black), current page `white`. The lockup uses the gradient mark on black.
**Don't** add a newsletter form or CTA here; the purple CTA band above it does that job.

**Group:** Navigation

## Markup

```html
<footer class="ds-footer">
<div class="stack" style="gap:28px"><div><h2>Support</h2><ul><li><a href="#">Contact COW</a></li><li><a href="#">Help Center</a></li><li><a href="#">Join Our Community</a></li><li><a href="#">Pricing</a></li></ul></div></div>
<div><h2>Resources</h2><ul><li><a href="#">Blogs &amp; Guides</a></li><li><a href="#">Roadmap</a></li><li><a href="#">What's New!</a></li><li><a class="is-current" href="#">Open Source</a></li></ul></div>
<div><p class="ds-footer-blurb">Cloud of Worship is a browser-based worship support system built for growing churches that want simple, reliable media setup</p><p class="ds-footer-blurb" style="margin-top:14px">© CoW Labs, All Rights Reserved, 2026</p></div>
<a class="ds-logo on-dark" href="#"><img src="../assets/logos/cow-mark.svg" alt="" style="width:28px;height:28px"><span class="ds-logo-name" style="font-size:16px">Cloud of Worship</span></a>
</footer>
```
