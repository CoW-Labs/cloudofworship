# AppWindow

A frosted-glass desktop window that frames real product footage on the home page.

**Provide** a `.ds-window` with `.ds-window-dots` (three traffic-light dots) and a `.ds-window-screen` holding a screenshot or looping video of the actual app.

**Use** for the feature carousel (“Put scripture on screen in seconds”, “Find any song or hymn, typos and all”, “Keeps going when the Wi-Fi doesn't”). Show real scripture and hymn titles on screen, with a carousel progress pill and play/pause below.
**Don't** mock up features that do not exist, or crop the app so it looks like a different product.

**Group:** Product

## Markup

```html
<div class="ds-window" style="max-width:560px">
<div class="ds-window-dots"><span style="background:#ff5f57"></span><span style="background:#febc2e"></span><span style="background:#28c840"></span></div>
<div class="ds-window-screen" style="display:grid;grid-template-columns:1fr 2fr 1.2fr;gap:8px;padding:10px;height:150px;background:var(--ds-surface-wash)">
<div style="background:var(--ds-white);border-radius:8px"></div><div style="background:var(--ds-white);border-radius:8px;display:grid;place-items:center"><span class="ds-pill-btn" style="height:28px;font-size:12px;padding:0 12px">Create new slide</span></div><div style="background:var(--ds-night);border-radius:8px;color:var(--ds-white);font:700 13px/1.1 var(--ds-font-sans);display:grid;place-items:center;text-align:center;padding:8px">In the beginning God created the heavens and the earth.</div>
</div></div>
```
