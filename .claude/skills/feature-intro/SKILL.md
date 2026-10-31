---
name: feature-intro
description: Mark a new Quick Action as NEW and give it a one-time intro modal with a looping, on-brand animation of how the feature works. Use when a feature ships (or is about to) and the user says "add a NEW badge", "introduce this feature", "intro modal for X", "feature intro", or "/feature-intro <action>".
---

# New feature intro

A new Quick Action gets three things:

1. A **NEW badge** in the Quick Actions list, for 60 days after `newSince`. It stays for the whole window, even after the intro has been seen.
2. An **intro modal**, shown **once per device**, the first time the action is opened (click or Enter). "Try it" runs the action. Closing it any other way (X, Escape, overlay) also counts as seen, and the action is not run.
3. A **hero animation** in that modal: a short loop showing how the feature works, built from the app's own UI.

## How it is wired (read before changing anything)

| Piece | File |
|---|---|
| `newSince`, `intro` on a `QuickAction`; `QuickActionIntro` type | `app/types/index.ts` |
| The action entries with their copy | `quickActionsArr` in `app/utils/constants.ts` |
| Badge window, seen state, `introduceThen` | `app/composables/useFeatureIntros.ts` |
| NEW badge and click gate | `app/components/utils/ActionCard.vue` |
| Enter-key gate and the one modal host | `app/components/QuickActions.vue` |
| Modal shell (`hero` slot, `cta` event) | `app/components/modals/FeatureIntroductionModal.vue` |
| Animation registry | `app/utils/introAnimations.ts` |
| Animations | `app/components/intros/*IntroAnimation.vue` |
| Beat timer with reduced-motion rest | `app/composables/useIntroLoop.ts` |
| Shared parts: drawn camera feed, mouse pointer, Live Output screen | `app/components/intros/IntroCameraFeed.vue`, `IntroPointer.vue`, `IntroLiveOutput.vue` |
| Panel intros (no Quick Action gate) | `AddPresentation.vue` (PDF), `TranscriptsPanel.vue` (Transcribe) |

An intro can also live in a feature's own panel, shown when the panel opens: render `<FeatureIntroductionModal>` there with `feature-key`, `title`, `description`, `:points` and a `#hero` template holding the animation, and call `show()` on mount. Use that when the feature isn't new but needs explaining, or isn't reached through one Quick Action.

Seen keys live in localStorage `cow_seen_feature_intros` as `quick-action:<action>`. The same store backs the panel intros (Import Slides, Transcripts), so never rename the key.

## Steps

### 1. Mark the action new and write the intro

On the action's entry in `quickActionsArr`:

```ts
newSince: "YYYY-MM-DD", // the day it ships to churches, not the day the code was written
intro: {
  title: "Slide pairs",          // the feature's plain name, plural or noun phrase
  animation: "slide-pair",       // key in INTRO_ANIMATIONS
  description: "Show a camera and another slide on screen together.",
  points: [                      // exactly two, each a step or a rule the operator needs
    { title: "Start with a camera", body: "Pair it with a verse, lyrics or another camera." },
    { title: "Pick a layout", body: "Side by side, picture in picture, caption or lower third." },
  ],
  // cta defaults to "Try it"
},
```

Copy rules. **As simple and short as possible**, written short the first time:
- Description: one short sentence, about 10 words. Point titles: 2 to 4 words. Point bodies: one short line, about 8 words.
- Keep only what the operator needs to try it. Cut asides, reasons ("so nothing slows down"), "like any other" comparisons, and long example lists (one example, or none).
- Plain words a church volunteer would use.
- No em dashes. No hype ("powerful", "seamless"). No explaining the reader to themselves.
- Facts only from the code and commits: real option names (read the feature's labels, e.g. `SLIDE_PAIR_LAYOUTS`), real limits (tier, required pieces). Read the feature's memory file if there is one.
- Show the user the copy in your summary so they can check it.

`constants.ts` is often being edited by other sessions. Make small, exact edits and check your strings landed. Never rewrite the file.

### 2. Build the hero animation

Create `app/components/intros/<Feature>IntroAnimation.vue`, then register it in `app/utils/introAnimations.ts` with an explicit import. A dynamic `<component>` can't resolve auto-imported components by name.

**What to show: a simplification, not a replica.** Draw only the two or three elements that carry the idea, and leave out everything else. As long as the viewer gets it, less is better.
- Start from the one thing the feature does, and show it happening in 2 to 4 beats. Examples in this repo: a camera card is clicked and the Live Output cuts to the feed; a PDF opens out into slides; a highlighted verse is clicked and goes live; one screen moves through the layouts.
- Leave out panel headers, tabs, labels, chips, file names, sizes, buttons, timers and other rows unless the idea fails without them. No text beyond a word or two the real UI shows.
- One screen is often enough (Interlude and Slide Pair are just the screen).

**Borrow the real UI. Don't invent a parallel one:**
- Render the real component when it can draw itself safely. `InterludeView` with `mode="preview"` runs the real engine. Never open a real camera, mic, network call or store write from an intro.
- Use the feature's own constants for layout and colour (`PAIR_LAYOUT_GEOMETRY`, `PAIR_CARD_COLOUR`, `SLIDE_PAIR_LAYOUTS`, interlude variants), so the intro cannot drift from the product.
- Take colours and shapes from the real UI for the few elements you keep: the selected ring (`ring-primary-300`, dark `ring-[#E8D1F8]`), the live red `#f04438`, the pair purple `#46215F`, the Bible reference style, the camera placeholder's dark gradient.
- Reuse the shared parts: `IntroCameraFeed` for any camera picture, `IntroLiveOutput` for the projector screen (labelled, with the LIVE pill; slot in what is on air), and `IntroPointer` for clicks (`state`: `hidden` / `over` / `press`, placed inside the element it clicks).

**Shell and sizing:**
- The modal renders the `hero` slot as a full-width band under its header, outside the padded body. The band is `inert`, `pointer-events-none` and `select-none`: nothing in an animation can be clicked, hovered or selected, so real controls (e.g. `CowButton`) are safe to borrow for their look. Never undo that on an element inside. Don't wrap the animation in a box: no background, rounding or padding on the root, just `aria-hidden="true"` (the modal text carries the meaning).
- A lone screen (the main 16:9 picture) runs edge to edge with no rounding. A composition of a few pieces (e.g. a camera card beside the Live Output) takes `px-5` as a whole, the header's inset.
- Give the root `overflow-hidden` when anything moves in from off-element, or the modal's scroll area picks up a sideways scrollbar.
- The band is about 600px wide. Use Tailwind px sizes for chrome and `cqw` for anything inside a screen (set `containerType: 'inline-size'` on the screen).
- 16:9 boxes use an inline `style="aspect-ratio: 16 / 9"`. Tailwind's `aspect-video` emits no CSS in this project.
- Position moving parts relative to the element they point at (e.g. a pointer inside the card it clicks), not with absolute coordinates across the panel.
- Light and dark mode both. Every colour gets a `dark:` pair or is a fixed brand colour.

**Motion:**
- Drive beats with `const { step, reduceMotion } = useIntroLoop([ms, ms, ...], restStep)`. `restStep` is the one still frame that explains the feature best, and it is what reduced-motion users see.
- Use CSS transitions between beats (about 0.3s for state, about 0.7s for movement, `cubic-bezier(0.65, 0, 0.35, 1)`), and a `@media (prefers-reduced-motion: reduce)` override for any keyframe loop.
- Whole loop 5 to 10 seconds. Give each beat time to be read.
- Build objects passed to real components once (outside the render), so a beat change doesn't hand them fresh props.

### 3. Check

- Type-check and filter to your files (the project has older errors elsewhere):
  ```bash
  npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json 2>&1 | grep -E "intros/|introAnimations|constants.ts|<your files>"
  ```
- Only open a browser preview if the user asks for one in that turn. To test the modal again, clear `cow_seen_feature_intros` in localStorage.
- Don't commit unless asked. When asked, commit to `staging` with a `chore:` subject, authored as felixfavour.

## Retiring a feature's intro

Nothing to do: the badge ends 60 days after `newSince` and the intro stops gating then too. Leave `intro` in place (it is harmless), or remove `newSince`, `intro` and the animation together in a later cleanup.
