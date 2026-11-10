# Cloud of Worship design system

Source: the cloudofworship.com home page and /open-source page, read November 2026. Values are taken from the live stylesheets; anything recreated from a screenshot is labelled where it appears.

Cloud of Worship is free, open-source church presentation software that runs in the browser. This system describes how the marketing site at cloudofworship.com looks and sounds, so every new page, ad, deck and email feels like the same calm, capable volunteer helping a church get ready for Sunday.

The site moves between three grounds: a dark **stage** where projected slides glow, quiet **white and lavender** reading sections, and loud **purple posters** that carry the big statements. Type is a tall, tight condensed grotesque for headlines and Geist for everything you read. Every action is a pill you can press.

## What's in this folder

| File | What it is |
|---|---|
| `README.md` | This brand book: the rules for colour, type, layout, imagery, icons and motion. |
| `brand-guidelines.md` | Who we are, personality, naming, voice, and logo use. |
| `tokens.json` | The source of truth for every colour (light and dark), type style, spacing step, radius and shadow, each with a usage note. |
| `tokens.css` | The tokens as CSS variables (`--ds-<name>`) plus one class per type style (`.ds-display-hero`). Generated from `tokens.json` by `npm run tokens:build`. |
| `fonts.css` | `@font-face` rules for Bricolage Grotesque Condensed, Bricolage Grotesque and Geist (files in `public/fonts`). |
| `components.css` | Styles for the 22 marketing components, prefixed `ds-`. |
| `components/*.md` | One guideline per component: when to use it, what to provide, do and don't, and its markup. |
| `assets/` | The cloud mark in three inks and the Phosphor icons used on the site. |
| `showcase.html` | Every component rendered live, with a dark-mode toggle. Open it in a browser. |

## Using this system

- Make design decisions from this folder: pick colours, type, spacing and components by their token names before inventing anything new. If something is missing, add it to `tokens.json` with a usage note rather than hard-coding a value.
- Load `fonts.css`, `tokens.css`, then `components.css`. Wrap pages in `.ds-root`.
- Reference tokens as CSS variables with the `--ds-` prefix: the `brand` token is `var(--ds-brand)`, `space-6` is `var(--ds-space-6)`. Never paste hex values.
- Use semantic colour tokens (`surface`, `ink`, `brand`, `ink-on-poster`) in components. Reach for primitives (`purple-500`, `sky`) only for brand moments the semantics don't cover.
- Dark values switch on under `.dark` (what Nuxt color mode sets) or `[data-theme="dark"]`.
- The components are plain HTML + CSS taken from the marketing site; port the markup into Vue as needed.
- The product app's own UI keeps Nuxt UI and its `cow-` classes. Where the app speaks for the brand (onboarding, upgrade and feature-intro modals, emails, social posts and print), follow this system, and keep the app's purple aligned with the `purple-*` tokens, which are the same scale as `tailwind.config.ts`.

## Colour

**Purple is the brand; violet is the action.** Two purples do different jobs and must not be swapped.

- `purple-500` (#A855F7) is the poster colour. Fill whole sections with `surface-poster` for manifesto moments: the open-source hero, “To the ends of the earth”, and the closing “Sunday's coming” band. Text on it is always `ink-on-poster` (night, 4.8:1). White on it fails (4.0:1).
- `brand` (#8A41C9, `violet-press`) fills buttons and marks links and active states. `brand-ledge` sits under it. White text on it is 5.4:1.
- `purple-600` (#9333EA) is the app's primary and the site's `--primary-color`; keep it for large fills that need to match the product UI.

**Grounds, in the order a page usually runs:**

| Ground | Token | Use |
|---|---|---|
| Stage | `surface-stage` | Hero only. Dark like a sanctuary with the lights down; projected slide imagery glows on it. |
| Paper | `surface` | Product footage, statements, principles. |
| Lavender wash | `surface-wash` | Pricing, stats, the license section. |
| Night | `night` | Testimonials and the church-logo wall. |
| Poster | `surface-poster` | One or two manifesto sections per page. |
| Footer | `surface-footer` | Black, always last. |

**Pastels** (`sky`, `butter`, `coral-wash`, `mint`) appear only as card fills, in that order, with `ink-on-pastel` text. They are the warm, human counterweight to the purple.

**Coral** (`accent`, #FF8980) is a warm accent fill. It is 2.3:1 on white, so never use it for text on light grounds.

**Presence colours** (`cursor-blue`, `cursor-gold`, `cursor-violet`) belong to collaboration visuals only.

**Contrast notes.** Three pairs the site ships fall short of WCAG and are kept exact here, each flagged in its token note: `violet-mist` eyebrows on lavender (2.5:1), white labels on `cursor-violet`/`cursor-blue` (2.9 and 3.2:1), and `focus-ring` on white (2.6:1). For new work use `brand-text` for small brand-coloured text and rely on the ring's 3px offset gap on light grounds; on the poster draw focus in `ink-on-poster`.

The dark theme maps the semantic tokens onto the site's own dark sections (night, night-raised, ink-900, snow). Poster, stage and pastel tokens keep their values in both themes.

## Typography

Three families, each with one job:

- **Bricolage Grotesque Condensed** (`--font-display`) for every headline, number and price. Weights 700 and 800 do the work; 200 appears only as the thin word in a poster headline. Set it tight: line-height 0.82 to 1, letter-spacing -0.01 to -0.02em.
- **Geist** (`--font-sans`) for all reading text, buttons, labels and nav at 400, 500 and 600.
- **Bricolage Grotesque** (normal width, `--font-wordmark`) for the name in the logo lockup only.

Use the type styles by name: `display-hero` for the H1, `display-section` or `display-section-xl` for H2s, `display-stat` for numbers, `text-lede` and `text-intro` under headings, `text-body` everywhere else. Headlines are sentence case and usually break onto two balanced lines. Uppercase is reserved for `text-eyebrow`, `text-badge`, `text-meta` and `text-fineprint`, always letter-spaced.

The signature move is the **heavy/thin poster headline**: `display-poster` (800) with one or two words in `display-poster-thin` (200) at the turn of the sentence: “Open to *every* church.” Use it on `surface-poster` only.

## Spacing and layout

- Page gutters: `space-5` (mobile), `space-10` (tablet), `space-16` (desktop). Content maxes out at 1600px.
- Section padding: `space-20` / `space-28` / `space-36` top and bottom by breakpoint. Sections are full-bleed bands; the ground colour change is the divider.
- Inside a section: heading block, then `space-14` to the content grid, grid gap `space-4` to `space-5`.
- Layouts are asymmetric: a big heading on the left with a short `text-intro` paragraph bottom-aligned on the right; stats in a narrow right column; posters with the headline bleeding wide and the lede pinned to the bottom.
- Feature carousels centre a two-line heading over a framed app window.

## Shape, depth and borders

- Actions, badges, toggles, nav hovers, presence labels and icon discs are all pills (`radius-pill`).
- Cards are soft rectangles: `radius-card` (20px) for pastel cards, notes and quotes; `radius-card-lg` (28px) for night cards; `radius-ticket` (24px) for the pricing ticket.
- Depth comes from the **pill ledge**: a solid 5px shadow in a darker shade under each button (`shadow-pill`, `shadow-pill-dark`). Hover lifts to 9px, press sinks to 1px. Everything else is flat or carries one soft drop (`shadow-menu`, `shadow-window`, `shadow-quote`).
- Borders are rare: hairline `line` dividers above numbered points and under stats, and the 2px outline on poster tags.

## Imagery

- **Projected slides** are the hero image: real lyrics, scripture and sermon titles (“Let us pray — Philippians 4:6”, “But God demonstrates his own love toward us… Romans 5:8 NKJV”) on purple, sunset and dark photographic backgrounds, curved into a ribbon on the stage.
- **Product footage** of the real app in a glass `AppWindow`, showing real scripture and hymn titles.
- **People photography**: warm, daylight, candid; ordinary people (a child on the grass with a tablet) rather than staged worship crowds. Crop generously.
- **Church logos** of real denominations served (RCCG, Anglican, Assemblies of God, Winners Chapel, Watoto…) in a greyscale wall on night that colours on hover.
- Never use stock “hands raised in a concert” imagery, lens flares, or AI-generated churches.

## Iconography

- Use **Phosphor Icons, fill weight**, set at 20-22px in `ink-900` (#1B1F2E in the files) inside a 46px white `ds-icon-disc`. The icons in `assets/icons` are copied from the site.
- Inline UI glyphs (arrows, chevrons, play/pause) are simple 1.8px strokes in `currentColor`.
- The product app also bundles mdi, bx, tabler, lucide and others; on marketing pages stick to Phosphor.
- No emoji as icons or decoration. The one emoticon in the voice is a typed “:)” at the end of a joke.

## Motion

- Ease almost everything on `cubic-bezier(.2,.7,.2,1)`: quick out, soft landing.
- **Blur into focus** is the signature reveal: headline letters or words fade from 4-18px blur to sharp over 0.75-0.9s, staggered 22-100ms, the colour passing from `purple-400` to `violet-press` on the way.
- Buttons respond in 80ms (lift on hover, sink on press). Menus fade and drop 6px in 250ms. Prices swap with a 200ms blur.
- Respect `prefers-reduced-motion`: show everything at rest, no transforms.

## Accessibility

- Text must meet 4.5:1 (3:1 at 24px+). The token notes list each colour's safe grounds.
- Focus: 2px `focus-ring` outline at 3px offset on every control.
- Visually rotating or split headlines keep the full sentence in a visually hidden span; the visible pieces are `aria-hidden`.
- Price and plan terms are stated in full text for screen readers.
