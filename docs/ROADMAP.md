# Cloud of Worship roadmap

Updated 16 Nov 2026. Built from PostHog (last 30 days, counts are people not churches), the production DB, the code, and your pipeline and customer notes. Priorities are my read of the data. Edit freely.

## Where we are

| Signal | Number | Source |
|---|---|---|
| Churches in the DB | 4,085 (2,721 free, 39 Teams, 1,325 with no plan set) | DB |
| Churches editing schedules | 316 in 30 days, 765 in 90 days | DB |
| New churches | 263 in the last 30 days, 232 in the 30 before | DB |
| Teams churches | 39 now, 38 in September, so flat | DB, win-back notes |
| People who clicked Upgrade | 36 | PostHog |
| People who paid | 10 (18 cancelled a payment) | PostHog |
| People who opened the upgrade modal | 368, and 277 of them chose to continue free | PostHog |
| Sign-up page to completed sign-up | about 40 percent each week | PostHog |
| People who went live | 324 | PostHog |
| Slides made in 30 days | Bible 4.4k, song 4.1k, media 2.8k, text 2.2k, hymn 1.1k | DB |
| Desktop updates | 62 people had an update fail, 59 had one staged | PostHog |
| Sunday | about 55 percent of the week's slides, 8 to 11am WAT | DB (October) |

What this says:
- The core loop works. Churches build Bible, song, media and text slides and go live.
- The gap is paying. Plenty of people hit the paywall, few finish, and more people cancel a payment than complete one. Teams has not grown since September.
- Media is the third most used slide type, so media polish reaches many people.

## Priority check

Score each item 1 to 5 for Reach and Impact, then note effort (S under a week, M one to three weeks, L longer). Rank is my judgment, not a formula.

| Rank | Item | Reach | Impact | Effort | Why |
|---|---|---|---|---|---|
| 1 | Bachs payment beta | 4 | 5 | S, ships today | 36 upgrade clicks led to 10 payments and 18 cancels. Payment friction is the clearest leak. Providers are split across Paystack (75), Dodo (53) and admin (57) records. |
| 2 | Media polish: upload progress and state, seek bar with time, volume | 4 | 4 | M | Four of your customer asks. Media is 2.8k slides a month. The upload progress callback already exists in `useUploadFile`, so much of it is wiring. |
| 3 | Sermon Transcribe: name, activation, paid path | 3 | 4 | M | 92 opened the panel, 50 started, only 12 used a verse suggestion. 10 clicked upgrade from the preview, among the most of any feature. |
| 4 | Desktop update reliability | 3 | 4 | S to M | 62 people hit a failed update. A broken updater leaves churches on old builds. |
| 5 | PowerPoint upload | 3 | 3 | M | Customer ask. The code exists but is behind the `ppt-conversion` flag, with a notice that it is "being refined". Only 36 people made presentation slides, and PDF is the only path today. |
| 6 | Credits section | 2 | 3 | S | Customer ask, and the app bundles FFmpeg under the LGPL, which I believe needs a notice. Check this with the licence terms. |
| 7 | YouTube streaming: finish and release to a small group | 2 | 3 | M | One person started a stream in 30 days, but it is behind a flag, so the data cannot judge it yet. The real gap is that the full path was never run in the real app. |
| 8 | Sign-up and email verification | 4 | 3 | S to M | Of 261 accounts created, 181 completed. Resend requests (79) equal code sends (79), which looks odd and is worth checking. |
| 9 | Pin library items | 2 | 2 | S | Customer ask. 211 people saved library slides, so reach is moderate. |
| 10 | Pillar (AI agent) | unknown | unknown | L | No Pillar code in this repo, and I don't know what it does. Needs a one-page PRD before it can be ranked. |

## Now

1. **Bachs payments, beta today.**
   Outcome: more of the 36 upgrade clicks end in a payment.
   Check before and after launch: every Bachs step has a PostHog event with a `provider` property, so we can compare it with Paystack and Dodo. Nothing in the `churches` collection shows a Bachs flag yet, so confirm how it is switched on per church.

2. **Media polish.**
   Outcome: fewer "did it upload?" moments and more control during a service.
   Scope: upload progress and an uploaded or waiting state on each slide, a seek bar with elapsed and total time (it is a seconds box today), and a volume slider (it is a mute toggle today). Apply to YouTube and Vimeo slides as well.

3. **Sermon Transcribe.**
   Outcome: more people reach a verse suggestion, and more upgrade.
   Scope: pick the name, then fix the step between "started" and "used a suggestion". Name ideas that say what it does: **Sermon Verses**, **Verse Follow**, **Pulpit Assist**.

4. **Desktop updates.**
   Outcome: desktop churches stay current.
   Scope: find why updates fail for 62 people, and confirm the release pipeline (still unverified from the August notes).

5. **PowerPoint upload.**
   Outcome: churches stop being asked to export a PDF first.
   Scope: finish the refinement, test with real church files, then turn on the flag.

## Next

- **Credits section** and **pin library items.** Both are small, so slot them in between larger items.
- **YouTube streaming.** Run the full path in the real app on macOS and Windows, release to a handful of Teams churches, and judge it by `STREAM_STARTED` against `STREAM_FAILED`. Do not build more quality tiers until people use the ones we have.
- **Monthly song-use email for licensing.** Email each church the songs it used in the last month, so it can report them to its licence body (CCLI, OneLicense). Scope: build the list from songs that went live, not songs that were only added or searched. Open points: who gets it (church admins only), whether to send automatically or offer it in the app too, and how it fits the existing email rules (one sender, contact-history check, short and plain). It also supports the licensing answer on `/content-licenses`.
- **Pillar.** Write the one-page PRD first (see the template below), including cost per use and what happens if it fails mid-service.
- **Sign-up funnel.** Look at the drop between account created and verified, and the resend pattern.
- **Paywall review.** Countdown is the most blocked feature (126 blocks, 51 previews). Song search has the best preview-to-upgrade rate (15 of 177). Decide whether the current split is right.
- **Mobile route and remote control.** 125 people connected remote control, so there is demand. Decide between PWA polish and a Capacitor wrapper.

## Later

- Windows GPU encode for streaming
- Template and theme sharing
- More catalogue languages
- Stream to destinations other than YouTube

## Open questions

1. What does Pillar do, and who is it for? Is it for churches inside the app, or for support?
2. Does Bachs replace Paystack and Dodo, or sit beside them?
3. Is countdown meant to be a paid feature? It is the most blocked one.
4. Are you happy with Teams staying flat at about 39 for now, or is growing it the goal this quarter?

## Caveats

- PostHog counts people, and one church can be several people.
- Events do not fire on localhost, and the YouTube, camera and transcription flags limit who can generate those events.
- The September win-back baseline is from my notes. The DB figures are from today.
- Effort sizes are estimates from reading the code, not a plan.

## One-page PRD template

Use it only for features that cost real money, touch the paywall, or are hard to undo.

- **Problem:** who has it, and what they do today instead
- **Outcome:** the one number that should move
- **In scope / out of scope:** short lists
- **Tier and limits:** Starter or Teams, any metered allowance, what the API enforces
- **Live-service safety:** what must never happen during a service
- **PostHog events:** opened, committed, outcome, failure, using the existing names
- **Done when:** how we know it worked, and when we look
