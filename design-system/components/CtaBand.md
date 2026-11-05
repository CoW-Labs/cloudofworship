# CtaBand

The closing poster before the footer: one question in huge type and a black disc that follows the cursor.

**Provide** a `.ds-cta` section with a `.ds-cta-head`, a `.ds-cta-disc` link (“Get Started”) and a two-line `.ds-cta-foot`.

**Behaviour** the disc tracks the pointer inside the band (it uses `mix-blend-mode: difference` over a purple-500 disc and scales 1.15 near the target); the whole band is the link. With reduced motion or touch, the disc rests bottom-right.
**Don't** add a second action or a form.

**Group:** Sections

## Markup

```html
<section class="ds-cta" style="padding:40px 32px">
<h2 class="ds-cta-head" style="font-size:80px">Sunday’s coming. Are you ready?</h2>
<a class="ds-cta-disc" href="#" style="right:80px;top:150px">Get Started</a>
<p class="ds-cta-foot" style="left:32px;bottom:24px">Prepare once,<br>use everywhere.</p>
</section>
```
