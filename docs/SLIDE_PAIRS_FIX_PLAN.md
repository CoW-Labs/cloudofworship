# Slide pairs: fix plan

**Status (2026-10-21):** everything below is implemented except C6, which is
parked as described. Not yet checked in a browser.

Fixes for the review of the uncommitted slide pair work (frontend in this repo,
API in `worshipcloud-api/src/modules/slidePair`). Each item has the problem,
the fix with the files it touches, the edge cases, and how to check it.

Frontend work lands on `staging`, API work on `develop`. There is no frontend
test suite, so checks are done in the browser preview with the dev login. The
API has tests (`src/modules/slidePair/*.test.js`), so every API change gets one.

New rule this plan is built around: **every pair holds at least one camera
slide.** A pair is two cameras, or a camera and one other slide.

---

## A. The camera rule

### A1. Validation, client and server

**Problem.** Any two slides can be paired today.

**Fix.**

- `app/utils/slidePairs.ts`
  - Add `isCameraSlide(slide)` and `pairHasCamera(slides)`.
  - In `pairRejection(target, source, pairForSlide)`, after the existing
    checks, return `"A slide pair needs a camera slide. Drop this onto a
    camera slide."` when neither slide is a camera.
  - Add `canBePairTarget(slide)`: a camera, not an overlay. Used by every drop
    target and by the menu entry (A4).
- API `slidePair/controller.js`, `createSlidePair`
  - Add `type` to the `.select("id pairId slideMode")` projection.
  - After the overlay check: if no slide has `type === "camera"`, return 400
    `"A slide pair needs a camera slide."`.
  - Test: two text slides gives 400; camera and text gives 201; two cameras
    give 201.
- API `updateSlidePair`: no change. Reordering cannot remove a camera.

**Edge cases.**

- Deleting the camera dissolves the pair, which already happens on both sides
  (`detachSlidesFromPairs` and the API's removal hook).
- Neither side has shipped, so no stored pairs need migrating. If staging
  already holds camera-less test pairs, delete them by hand.

**Check.** Drag a text slide onto a text slide: refused. Call the API directly
with two text slide ids: 400.

### A2. Grid: only camera cards accept a drop

**Problem.** Every card is a drop target.

**Fix.** `app/components/slides/SlideCard.vue`

- `acceptsPairDrop` computed: grid card, not in bulk select, and the card is a
  camera (for a pair card, the pair holds a camera, see the B1 replace flow).
- `onSlideDragOver` only calls `preventDefault()` when `acceptsPairDrop` and
  `pairRejection` passes for the slide being dragged. Every other card gives
  the browser's "no drop" cursor.
- Show eligible targets while a drag is running, not only under the pointer:
  - Add a module-level `draggingSlideId` ref in `useSlidePairs.ts`, set in
    `onSlideDragStart`, cleared in a new `@dragend` handler on the source card
    (`dragend` fires on the source whether the drop landed or not).
  - Camera cards that would accept that slide show a soft ring and "Drop to
    pair". The card under the pointer keeps the stronger overlay it has now.
- Hint copy (`gridCardHint`):
  - Camera card: `Click to preview · Double-click to take live · Drop a slide
    here to pair it`
  - Other cards: `Click to preview · Double-click to take live · Drag onto a
    camera slide to pair`

**Edge cases.**

- The media file drop on the grid looks for `Files`, and this drag uses
  `application/x-cow-slide`, so they still never mix.
- Dragging a slide that is already in a pair, or an overlay: no camera card
  lights up.

**Check.** Start dragging a text card. Only camera cards light up, other cards
show no-drop, and dropping on a camera pairs the two.

### A3. Schedule list: only camera rows accept a drop

**Problem.** Every row calls `@dragover.prevent`, and `onScheduleSortMove`
counts the first row Sortable moves as a reorder, which happens on the first
hover. Pairing from the list almost never works.

**Fix.** `app/components/LiveOutput.vue`

- Replace `@dragover.prevent` with `@dragover="onRowDragOver($event, slide)"`,
  which only prevents default on camera rows (and setlist rows for a dragged
  song, as today).
- Tell "drop onto" apart from "drop between" in `onScheduleSortMove(evt,
  originalEvent)`. vuedraggable passes `evt.draggedContext.element` and
  `evt.relatedContext.element`.
  - If the related row is a camera that would accept the dragged slide, and the
    pointer (`originalEvent.clientY`) is in the middle half of the related
    row's `getBoundingClientRect()`, set `pairCandidateId` to that row and
    return `false`. Sortable then leaves the row in place and the native
    `drop` lands on it.
  - Otherwise clear `pairCandidateId`, set `reorderedDuringDrag = true` and
    return `true`.
  - So a slide can still be reordered past a camera row by crossing its top
    or bottom quarter.
- `handleDropOnScheduleSlide` pairs only when `pairCandidateId === target.id`.
- The row matching `pairCandidateId` shows the same ring and "Drop to pair" as
  the grid.
- Song onto setlist keeps working: run its check before the camera check, as
  now.

**Edge cases.**

- Touch: Sortable's touch drag is not native DnD, so pairing by drag stays a
  mouse feature. The menu entry (A4) covers touch and `/mobile`.
- `@end` must clear `pairCandidateId` as well as `draggingSlide`.

**Check.** Drag a scripture row slowly over a camera row. Through the middle
it highlights and pairs on release. Across the edges it reorders.

### A4. "Start a pair" in the ⋯ menu of a camera slide

**Problem.** Pairing is drag only, which is hard to find, and doesn't work on
touch.

**Fix.**

- `app/utils/constants.ts`: add `startSlidePair: 'start-slide-pair'` to
  `appWideActions`.
- `app/components/slides/SlideActionsMenu.vue`
  - New item `Start a pair` (icon `i-tabler-layout-columns`), shown when
    `slide.type === slideTypes.camera`, not an overlay, and not in a pair.
    Emits `useGlobalEmit(appWideActions.startSlidePair, { cameraId:
    slide.id })`.
  - When the camera is already in a pair, show `Change paired slide` instead
    (same picker, replace mode, see B1) next to the existing `Unpair Slides`.
  - The menu is used by both the grid card and the editor, so both get it.
- New `app/components/editor/SlidePairPicker.vue`, built from the design
  system, no new primitives:
  - `UModal` with the header `Pair with <camera name>`.
  - `CowTeamsPreviewNotice` for a free church, as on every previewable panel.
  - A search field (the input component the library panels use) that filters
    by name.
  - The active schedule's slides in schedule order, each row using
    `DeferredSlidePreview`, the name and `SlideChip`. The camera itself and
    overlays are left out. Slides already in a pair are shown disabled with
    "In a pair".
  - Picking a row emits `appWideActions.pairSlides` with `{ targetId:
    cameraId, sourceId }` (or calls `replaceMember` in replace mode), then
    closes.
  - At phone width it fills the screen, so `/mobile` can use it.
- `app/components/PreviewContent.vue`: mount the picker once and open it on
  `startSlidePair`. The existing `pairSlides` handler does the rest.

**Edge cases.**

- Building a pair is the free preview, so the picker needs no tier check.
  Taking it live is gated already (`teamsActionForSlide`).
- The camera is deleted by a teammate while the picker is open: close it with
  the "no longer in this schedule" toast.

**Check.** ⋯ on a camera, then Start a pair, then pick a scripture. The pair
card appears with both dots. ⋯ on a text slide has no such item.

### A5. Copy and roles

- `pairRoles` stays as it is. A camera with a non-visual slide is always the
  picture. Two cameras, or a camera with a video, image or PDF, follow pair
  order, and Swap flips them.
- `UpgradePlanModal.vue`: description `Put a camera beside the scripture, or
  over the lyrics.`
- `SlidePairPanel.vue` Swap label: `Swap picture and words` still fits. For
  two cameras use `Swap the cameras`.
- The pair tooltip in `LiveOutput.vue` stays.

---

## B. Bugs

### B1. Replacing a pair member is rejected by the API

**Problem.** `replaceMember` (`useSlidePairs.ts:337`) PUTs new `slideIds`. The
API only accepts a reorder there (`controller.js:200`), so it answers 400. The
client only handles 404, keeps the new membership locally, and has already
told teammates. After a reload the old member is back.

**Fix, API.**

- New route `POST /:pairId/replace` with body `{ outgoingId, incomingId }`,
  handler `replaceSlidePairMember`:
  1. Load the pair by `{_id, scheduleId, churchId}`. 404 if missing.
  2. 400 unless `outgoingId` is in `pair.slideIds` and `incomingId` is not.
  3. Load the incoming slide in the same schedule and church, not
     `libraryOnly`, not an overlay. 404 if missing, 409 if its `pairId` is
     set.
  4. Work out `nextIds` (outgoing swapped for incoming) and load the
     remaining member's type. 400 if `nextIds` would hold no camera.
  5. Claim the incoming slide: `Slide.updateOne({id: incomingId, scheduleId,
     churchId, pairId: null}, {$set: {pairId}})`. 409 if nothing was
     modified.
  6. Update the pair only if nobody else changed it meanwhile:
     `findOneAndUpdate({_id, churchId, slideIds: pair.slideIds}, {$set:
     {slideIds: nextIds, activeSlideId, hiddenSlideId, audioSlideId}})`, with
     each id swapped. `audioSlideId` survives only if it still names a camera
     member (see B2). If the update matched nothing, release the claim from
     step 5 and return 409.
  7. Release the outgoing slide: `Slide.updateOne({id: outgoingId, churchId,
     pairId}, {$set: {pairId: null}})`.
  8. Return 200 with the updated pair.
- Add the path to `doc/paths/slide-pairs.yaml` and `doc/openapi.yaml`.
- Tests: success; incoming already paired gives 409; leaving no camera gives
  400; the pair changing mid-request gives 409 and leaves the incoming slide
  unclaimed.

**Fix, client.** `useSlidePairs.ts`, `replaceMember`

- Not optimistic. Membership needs the server to claim slides, and the call
  is quick.
- Offline: refuse with `Reconnect to change a pair's slides`.
- POST `/replace`. On success: normalise the response, `upsertSlidePair`. If
  the pair is live and the outgoing slide was `liveSlideId`, move the live id
  (see B8 for which member that is), then `republishLivePair` and
  `sendSlidePairUpdated(saved)`.
- On failure: toast with the server's message. Nothing local has changed, so
  there's nothing to undo.

**Fix, which member a drop replaces.** `PreviewContent.vue`, `pairSlides`
handler

- Dropping onto a pair card that has one camera replaces the other member.
- A pair of two cameras: refuse with `This pair has two cameras. Use Change
  paired slide in the camera's ⋯ menu.` The picker (A4, replace mode) asks
  which one.
- `onGridPairDrop` passes the pair's id rather than `gridCardSlide(target).id`,
  so the handler doesn't depend on which member the card is previewing.

**Check.** Drop a hymn onto a camera and scripture pair. The hymn replaces the
scripture, and a reload still shows camera and hymn. In the API, the
scripture's `pairId` is null and the hymn's is set.

### B2. The camera mic plays through the projector automatically

**Problem.** `LivePairProjection.vue:174` opens the operator's mic and plays
it whenever a camera owns the pair's sound, which (with the camera rule) is
almost every pair. `useCameraStream.ts:302` deliberately never opens camera
audio because it would loop through the PA.

**Fix.**

- Model: reuse `audioSlideId`, documented as "the camera whose microphone
  plays; null is silent". It's created as null already.
  - Update the comments in `app/types/index.ts` and the API model.
  - API `updateSlidePair`: also require that `audioSlideId` names a camera
    slide (load its type). 400 otherwise.
- `slidePairs.ts`, `pairAudioOwner(slides, hiddenSlideId, micSlideId)`
  - An unmuted media file still wins.
  - The mic is chosen only when `micSlideId` names a visible camera member.
  - Pass `stamp.audioSlideId` from `LivePairProjection.vue`.
- `SlidePairPanel.vue`: new **Sound** section, shown when a member is a
  camera.
  - One camera: a toggle, `Play the camera's microphone`.
  - Two cameras: Off, Camera A or Camera B.
  - Helper text: `Leave this off if the projector's sound goes to the PA. A
    microphone played through speakers in the same room will howl.`
  - When a video member owns the sound, show `The video's sound plays
    instead` and disable the control.
  - Writes through `updatePair(pairId, { audioSlideId })`. The signature in
    `useOperatorSession` already includes it.
- Permission prompt: turning the toggle on calls `getUserMedia({ audio:
  true })` in the operator window first and stops it straight away. The
  origin's permission is then granted, so the projector window never shows a
  prompt mid-service.

**Edge cases.**

- Hiding the camera member silences the mic (the hidden member is not a
  candidate). Already handled by the watch in `LivePairProjection`.
- `defaultMicrophoneId` changing while live restarts the mic. Already handled.

**Check.** Camera and scripture pair live: silent. Toggle on: the mic plays in
`/live` with no prompt there. Hide the camera: silent again.

### B3. Pairing the slide that's live alone breaks navigation

**Problem.** A slide live on its own that gets paired stays on screen alone
(`keepShape`), but `isScheduleSlideLive` (`LiveOutput.vue:765`) checks only
`livePairId`. The row loses its live mark, `liveRowIndex` is -1, and Down goes
to the first slide (`nextSlide`, `LiveOutput.vue:825`).

**Fix.** `LiveOutput.vue`

- `isScheduleSlideLive`: for a pair row, `livePairId === pair.id ||
  pair.slideIds.includes(currentState.liveSlideId)`.
- `nextSlide`: return `undefined` when `liveRowIndex < 0`, never index 0.
  `previousSlide` already does this.

**Check.** Take a camera live, then pair it with a scripture. The row stays
marked live, and Down goes to the row after the pair.

### B4. Undo/redo changes pairs on this device only

**Problem.** `setCurrentState` (`app.ts:1060`) restores whole snapshots, which
now include `slidePairs` and `livePairId`, with no API call.

**Fix.** `app/store/app.ts`, `setCurrentState`

- Keep the current `slidePairs` and `livePairId` instead of the snapshot's:
  `{ ...state, activeSlides, slidePairs: this.allSlidePairs, livePairId:
  this.currentState.livePairId }`.
- Then call `this.syncPairMembership()`, so restored slides' `pairId` matches
  the current pairs.
- Snapshots can keep carrying the fields. They're ignored on restore.

**Edge cases.** Undoing a slide delete that dissolved a pair brings the slide
back as an ordinary slide, which matches the server: the API dissolved that
pair.

**Check.** Pair two slides, edit something, undo twice. The pair is still
there and still on the server.

### B5. Failed pair updates are ignored

**Problem.** `updatePair` notifies teammates before the PUT and ignores any
error except 404 (`useSlidePairs.ts:270`). An offline `createPair` queues a
POST that can replay before its slides are uploaded, 404s, and the pair
disappears silently on the next fetch.

**Fix, updates and deletes.** `useSlidePairs.ts`

- `updatePair`
  - Keep `previous`, update locally and re-send to the screen (layout and
    hide stay instant).
  - Number each request per pair (`latestSeq.set(pairId, seq)`).
  - Success: `sendSlidePairUpdated(next)` (moved after the PUT) and upsert
    the server's `updatedAt`.
  - 404: `removeSlidePair`, re-send the remaining slide if live, toast `This
    pair was unpaired on another device`.
  - Any other error while online: revert to `previous` only if
    `latestSeq.get(pairId) === seq`, so a later successful change isn't
    rolled back. Then re-send if live and toast `Couldn't change the pair`.
  - Offline: keep the local change. See pending pairs below.
- `deletePair`: on a non-404 failure, put the pair back and toast. Unpairing
  is harmless to retry.

**Fix, pairs made offline.**

- Add a client-only `pending?: boolean` to `SlidePair`, removed before any
  POST or PUT body is sent.
- `createPair` offline: upsert with `pending: true`. Don't call `useAPIFetch`,
  and don't notify teammates.
- `updatePair` on a pending pair: local only, no PUT. The eventual POST sends
  the whole pair, so later changes ride along.
- Flushing: `flushPendingPairs()` in `useSlidePairs`, run from
  `useOnlineStatus().onBackOnline` and at the start of `fetchSchedulePairs`.
  - For each pending pair: `postPair(pair, members)`, which already triggers
    `upload-offline-slides` and waits for the slides' `_id`.
  - Success: clear `pending` and notify teammates.
  - 404 or 409 after the retries: remove it and toast `A pair made offline
    couldn't be saved`.
- `fetchSchedulePairs` merges server pairs with pending local pairs for that
  schedule rather than replacing them.

**Check.** Offline: create a camera slide, pair it, change the layout.
Online: the pair is saved once with the new layout, and teammates see it. With
the API stopped and online: changing the layout reverts and shows a toast.

### B6. YouTube/Vimeo inside a pair

**Problem.**

- The mute watcher (`LiveProjectionOnly.vue:1103`) ignores `audioMuted`, so
  unmuting the member that shouldn't be heard plays two soundtracks.
- `getEmbedUrl` puts the mute state in the iframe `src`, so any change of
  sound owner reloads the video from the start.

**Fix.** `LiveProjectionOnly.vue`

- `embedSrc` ref, set only when the slide id or the video id changes, using
  the mute state at that moment. Nothing else rewrites the `src`.
- `effectiveMuted` computed: `audioMuted || !fullScreen ||
  slide.slideStyle?.isMediaMuted`.
- One watcher on `effectiveMuted` sends `mute`/`unMute` (YouTube) or
  `setVolume` (Vimeo). It replaces the external-video branch of the
  `isMediaMuted` watcher and keeps its `isSlideLive` check.
- Re-send the current mute state on the iframe's `load` event, since a
  command sent before the player is ready is dropped.

**Check.** Camera and YouTube pair: toggle the YouTube slide's mute. Only it
is heard, and the video doesn't restart. Hide and show the camera: no reload.

### B7. Switching between a single slide and a pair rebuilds the projection

**Problem.**

- `live.vue:56`, `LiveOutput.vue:18` and the livestream page swap
  `LiveProjectionOnly` and `LivePairProjection` with `v-if`, so a video
  already on screen restarts and a camera re-attaches.
- Going from a single slide to a pair cuts to black, because the single view
  has no leave transition.

**Fix, pair to one of its own members.**

- `slidePairs.ts`: `continueAsSolo(previousPair: Slide[], incoming: Slide):
  Slide[] | null`.
  - If `incoming.id` is a member of `previousPair`, return the pair with that
    member replaced by `incoming` (via `patchLivePayload`) and every stamp's
    `hiddenSlideId` set to the other member.
  - Otherwise return null.
- In `live.vue`, `LiveOutput.vue` and the livestream page, when a single
  slide arrives and `continueAsSolo` returns a pair, keep `LivePairProjection`
  on that pair. The member stays mounted, and the change is the existing
  "other member fades out, this one fills the screen" animation.
- Hand over to `LiveProjectionOnly` when a slide from outside that pair goes
  live.
- Covers: unpairing a live pair, deleting the other member
  (`dropFromLivePair`), and a teammate unpairing it.

**Fix, playback position across a rebuild.** For the cases that still rebuild,
such as a video live alone that is then taken live as part of a pair:

- Module-level `resumePositions: Map<string, { time: number; at: number }>`
  in a small `useMediaResume` composable, keyed by slide id and media source.
- `LiveProjectionOnly` saves the video or audio `currentTime` in
  `onBeforeUnmount`.
- A new instance for the same key seeks to that time on `loadedmetadata`,
  plus the time passed, if it was saved under 3 seconds ago.
- Cameras need nothing: `useCameraStream` keeps the stream for 20s after
  release, so re-attaching doesn't call `getUserMedia`.

**Fix, crossfade.** Put `LiveProjectionOnly` inside `<Transition
name="cow-pair">` too, so going from a single slide to a pair fades the
single slide out over the entering pair. Check that each page's container is
`position: relative`, since `.cow-pair-leave-active` is absolutely
positioned.

**Check.**

- Camera and video pair live, then unpair: the video keeps playing and
  enlarges to full screen.
- Video live, then the pair holding it taken live: it continues within a
  second of where it was, with no black frame.

### B8. Choosing a member to edit changes what's live

**Problem.**

- The card dots and Pair panel rows call `setActiveMember`, which moves
  `liveSlideId` (and with it Up/Down) on a live pair and re-sends the pair to
  the screen.
- A teammate's `slide-pair-updated` does the same on your projector
  (`useRealtimeSlides.ts:301`).

**Fix.** Work out which member is driven, and keep the member being edited as
local UI state.

- `slidePairs.ts`: `drivenMemberId(pair, slidesById)`. The one non-camera
  member; with two cameras, `slideIds[0]`. This is the slide with verses or
  playback, so Up/Down and the stage display follow it.
- `projectLiveSlide`, `stampPairForLive`, `dropFromLivePair`,
  `republishLivePair` and `deletePair` use `drivenMemberId` wherever they use
  `pair.activeSlideId` today.
  - The stamp's `activeSlideId` field carries the driven id, so receivers
    don't change.
  - `primaryLiveSlide` and `activeMemberOf` keep working as they are.
- Member being edited: a module-level `reactive(new Map<string, string>())`
  in `useSlidePairs`, per window, never persisted or shared.
  - `editingMemberOf(pair)` returns the map value, falling back to the driven
    member.
  - The grid card preview (`gridCardSlide`), the schedule row
    (`scheduleRowSlide`), the dots, the Pair panel and the editor use it.
- `setPairActiveMember` handler (`PreviewContent.vue`): set the map entry and
  `makeSlideActive(member)`. No `updatePair`, no `setLiveSlide`, nothing sent
  to the screen.
- Stop writing `activeSlideId` to the API after creation. The field stays in
  the model (create sets it to the driven id), so nothing breaks there.
- `useRealtimeSlides`, `slide-pair-updated`: compare the old and new pair, and
  re-send to the screen only when `layout`, `hiddenSlideId`, the order of
  `slideIds`, `audioSlideId` or the background changed.
- `useOperatorSession`: remove `activeSlideId` from `livePairSignature`.
- `live.vue`: the `isSwitchedPairMember` workaround goes. The driven member no
  longer changes while a pair is live, except through a replace.

**Edge cases.**

- Camera and video pair: the video is driven, and play, pause and seek reach
  it as before (`isSlideLive` covers both members anyway).
- A phone driving the host: its optimistic `setLiveSlide(slide.id)` may name
  the camera. The host's next announcement corrects it to the driven member,
  as it does today.

**Check.** Live camera and scripture pair: click the camera dot. The editor
shows the camera settings, the projector doesn't change, and Down still steps
through the verses. On a second console, clicking dots doesn't affect the
first console.

---

## C. Performance

### C1. Hidden things keep running

**Problem.**

- A hidden member is faded to opacity 0 but stays mounted, so its video keeps
  decoding, its camera keeps capturing and an interlude keeps drawing at
  60fps.
- The pair background video plays at opacity 0 in every layout except side by
  side.
- In the caption layout, the text member's own background video is
  `v-show`'d off, not removed, so it decodes too.

**Fix.**

- `LivePairProjection.vue`: a per-role `mounted` flag. A role being hidden
  stays mounted for the 350ms fade, then the inner `LiveProjectionOnly` is
  `v-if`'d off. Showing it again mounts it straight away (the region's fade-in
  covers the mount).
  - Playback resumes through `resumePositions` (B7). The camera re-attaches
    from the stream cache.
- Backdrop: `backdropVideoMounted` is true while the layout is side by side
  with nothing hidden, and stays true for 450ms after it turns false. Only
  `BackgroundVideo` is removed. The CSS colour or image is cheap and can
  stay.
- `LiveProjectionOnly.vue`: move `!hideBackground` from the background
  `<video>`'s `v-show` into its `v-if`.

**Check.** In `/live`, `document.querySelectorAll('video').length` counts only
visible videos. In the Performance panel, a hidden interlude's frames stop
after the fade.

### C2. Too many camera streams

**Problem.** Two-camera pairs open two 1080p30 streams, and the
picture-in-picture inset gets 1080p for a box 15% of the screen wide.

**Fix.**

- `useCameraStream.ts`: accept a `quality` of `"inset"` (1280×720) in
  `acquire`. The cache stays keyed by device, so a device already open in that
  window is reused at whatever it was opened at.
- When the frame grows (picture-in-picture to caption), call
  `track.applyConstraints({ width: 1920, height: 1080 })` on the existing
  track rather than reopening. When it shrinks, lower the constraints the same
  way.
- `LivePairProjection.vue` passes the quality down: the frame role in
  picture-in-picture gets `"inset"`, everything else stays as it is.
- `SlidePairPanel.vue`: with two different camera devices, a note `Two
  cameras at once is heavy on older computers, and two cameras on one USB hub
  may not both start.`
- Make sure `CameraFeed` shows `cameraErrorMessage` for `NotReadableError`,
  so a second camera that can't start says why.

**Check.** In picture-in-picture,
`track.getSettings().height` on the inset camera is 720. Switching to caption
raises it to 1080 without a black frame.

### C3. Text-fitting cost

**Problem.** `measureFit` (`LiveProjectionOnly.vue:682`) forces up to 9 layout
passes per run. It runs on resize, on text change and on font load, in both
`/live` and the operator thumbnail, and every second for a countdown or clock.

**Fix.** `LiveProjectionOnly.vue`

- `scheduleFit()`: a single animation-frame flag. The ResizeObserver, the
  MutationObserver and `document.fonts.ready` all call it instead of
  `measureFit` directly.
- Skip when nothing that matters changed. `fitKey` = the text with every
  digit replaced by `0`, plus the box width and height, plus
  `document.fonts.status`. Return early when it matches the last key. A
  countdown going from 4:59 to 4:58 then costs nothing.
- Narrow the search. Try `[lastScale × 0.85, min(1, lastScale × 1.2)]` first,
  and fall back to the full range only if the answer is at one of its ends.
  That's about 5 layout passes instead of 9.
- In the MutationObserver, call `observeWords()` again only when the records
  include a `childList` change.

**Check.** Countdown in the lower third for a minute: the Performance panel
shows no `measureFit` after the first. A verse change runs it once per window.

### C4. Every pair change redraws every card

**Problem.** Each pair mutation rebuilds both lookup maps, and the grid
re-renders. Paired cards search the whole slide list several times per
render (`gridCardSlide`, `memberName`, `pairMembers`, the Pair panel).

**Fix.**

- Add an `activeSlidesById` getter to `app/store/app.ts`, the same shape as
  the one already in `LiveOutput.vue`, and use it in all four places. Have
  `LiveOutput` use the store's too.
- `upsertSlidePair`: return early when the incoming pair matches the stored
  one field by field. Socket echoes and no-op saves then cause no work.
- `syncPairMembership(changedSlideIds?)`: when given ids, only remap those
  slides instead of the whole schedule.
- After B8, switching which member to edit doesn't touch the store at all,
  which removes the most frequent cause.

**Check.** With Vue DevTools' render highlighting, clicking a pair dot only
re-renders that card and the editor.

### C5. Taking a pair live waits for downloads one after another

**Problem.** `handleTakeLiveAction` (`PreviewContent.vue:921`) waits for the
main slide's media, then the partner's. The partner's media isn't checked, so
it can show up broken.

**Fix.** `PreviewContent.vue`

- Prepare the main slide and its partners together with `Promise.all`. A
  camera partner needs nothing.
- Move the "required media" block into `missingRequiredMedia(slide)` and run
  it for each member.
- Main slide missing: refuse as today.
- Partner missing, or still downloading after 2 seconds: go live with that
  partner hidden for this projection only. Add a `hideSlideId` option to
  `projectLiveSlide` that sets the stamp's `hiddenSlideId` without saving it.
  - Toast: `The video isn't on this computer yet, so the camera is showing
    alone.`
  - When the download finishes and the pair is still live, re-send it without
    the override.

**Check.** On a throttled network, a camera and new video pair goes live
straight away with the camera alone, then the video slots in.

### C6. Two IndexedDB writes per verse change

**Problem.** Each Up/Down in a live pair copies and stores both members.

**Fix.** With the camera rule, the second member is nearly always a camera
slide, whose copy is a few hundred bytes. Leave this alone unless profiling a
camera and presentation pair shows `putCurrent` mattering. If it does, cache
each member's prepared copy in `useLiveProjectionRepository` by `id` +
`updatedAt` + `mediaSignature`, and only copy a member whose key changed.

---

## D. Smaller issues

### D1. Reordering moves a pair's second member

**Problem.** The schedule list's setter (`LiveOutput.vue:786`) puts the
second member straight after the first, so members that weren't next to each
other get moved.

**Fix.**

- When a pair is created (and after a replace), move the non-camera member to
  directly after the camera, through the same path the drag reorder uses
  (`batchUpdateSlides` with new indexes, plus the `reorder-slides` socket
  event).
- From then on, "members sit together" is always true, and the setter's
  grouping never moves anything unexpectedly.

**Check.** Pair the first and fifth slides. The fifth moves to second place
once. Reordering later never shuffles anything else.

### D2. Stored pairs are never cleared

**Problem.** `currentState.slidePairs` keeps pairs for every schedule the
device has seen until sign-out. It's saved to localStorage and synced between
windows on every state change.

**Fix.**

- `setSlidePairs(scheduleId, pairs)` keeps only that schedule's pairs, plus
  any `pending` pairs (B5).
- Cache each schedule's pairs in the IndexedDB `cached` table under
  `slide-pairs:<scheduleId>`. On a schedule switch, load that cache straight
  away (for offline use) and then fetch.

**Check.** Switch between three schedules: `currentState.slidePairs` only ever
holds the active one's.

### D3. The live window can clear the pair

**Problem.** `live.vue` calls `setLiveSlide` (lines 298 and 396), which clears
`livePairId` when the id isn't in the pair it knows. If shared state reaches
`/live` after the broadcast, it clears the pair and syncs that back to the
operator window.

**Fix.**

- Add a store action `mirrorLiveSlideId(id)` that sets `liveSlideId` only.
- Use it in `live.vue` for both calls. The blank case
  (`setLiveSlide("")`) stays as it is, since blank does end the pair.

**Check.** Take a pair live many times in a row with `/live` open. The
operator window never drops to a single slide.

### D4. Schedule list drag

Covered by A3.

---

## Order of work

1. **A1, A2, A3, A4, A5 and B1.** The camera rule, and the replace endpoint
   that the "drop onto a paired camera" and "Change paired slide" flows need.
   Includes the API changes on `develop`.
2. **B2 to B5.** Mic opt-in, live row fix, undo, error handling. B2 and B5
   need small API changes.
3. **B7 and C1.** Both change how `LivePairProjection` mounts its members, so
   do them together.
4. **B8 and C4.** The driven member and the per-window editing member. They
   touch the same code.
5. **B6, C2, C3, C5**, then **D1 to D3**. C6 only if profiling asks for it.

API changes in steps 1 and 2 should be on `develop` before the frontend that
calls them reaches staging.
