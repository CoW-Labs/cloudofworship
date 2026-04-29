# PostHog Tracking Events Documentation

This document outlines all PostHog events tracked in Cloud of Worship presentation software.

## 🎯 Core User Journey Events

### Authentication & Onboarding
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `SIGNUP_PAGE_VIEWED` | `source`, `planId` | User lands on signup page | ✅ Exists |
| `OPENED_SIGNUP_FROM_LYRICS` | - | User clicked signup from lyrics search page | ✅ Exists |
| `SIGNUP_STEP1_ATTEMPTED` | `signupMethod` | User submits email/password or initiates Google OAuth | ✅ Exists |
| `SIGNUP_STEP1_COMPLETED` | `signupMethod` | Step 1 (user creation) succeeds | ✅ Exists |
| `SIGNUP_STEP1_FAILED` | `signupMethod`, `error` | Step 1 fails | ✅ Exists |
| `SIGNUP_STEP2_ATTEMPTED` | `churchName`, `churchType` | User creates church profile | ✅ Exists |
| `SIGNUP_STEP2_COMPLETED` | `churchName`, `churchType` | Church profile created | ✅ Exists |
| `SIGNUP_STEP2_FAILED` | `error` | Church creation fails | ✅ Exists |
| `SIGNUP_COMPLETE` | `signupMethod`, `hasVerifiedEmail` | Full signup completed | ✅ Exists |
| `SIGNUP_COMPLETE_WITH_PLAN_ID` | `planId` | Signup with subscription intent | ✅ Exists |
| `SIGNUP_COMPLETE_UNVERIFIED` | - | Signup redirects to verification | ✅ Exists |
| `LOGIN_PAGE_VIEWED` | - | User views login page | ✅ Exists |
| `LOGIN_ATTEMPTED` | `loginMethod` | User attempts login | ✅ Exists |
| `LOGIN_SUCCESSFUL` | `loginMethod` | Login succeeds | ✅ Exists |
| `LOGIN_FAILED` | `loginMethod`, `error` | Login fails | ✅ Exists |
| `EMAIL_VERIFICATION_PAGE_VIEWED` | - | User lands on verification page | ✅ Exists |
| `EMAIL_VERIFICATION_ATTEMPTED` | `code` | User submits verification code | ✅ Exists |
| `EMAIL_VERIFICATION_SUCCESSFUL` | - | Email verified | ✅ Exists |
| `EMAIL_VERIFICATION_FAILED` | `error` | Verification fails | ✅ Exists |
| `EMAIL_VERIFICATION_CODE_RESEND_REQUESTED` | - | User requests new code | ✅ Exists |
| `EMAIL_VERIFICATION_CODE_SENT` | - | New code sent successfully | ✅ Exists |
| `EMAIL_VERIFICATION_CODE_SEND_FAILED` | `error` | Code resend fails | ✅ Exists |

---

## 📅 Schedule Management
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `SCHEDULE_CREATED` | `scheduleName`, `hasSlides` | New schedule created | ✅ Added |
| `SCHEDULE_SELECTED` | `scheduleName`, `scheduleId` | User switches to a schedule | ✅ Added |
| `SCHEDULE_DELETED` | `scheduleId` | Schedule deleted | ⚠️ Missing |
| `SCHEDULE_RENAMED` | `oldName`, `newName`, `scheduleId` | Schedule renamed | ⚠️ Missing |
| `SCHEDULE_DUPLICATED` | `scheduleId` | Schedule duplicated | ⚠️ Missing |

---

## 🎬 Slide Creation & Editing
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `NEW_TEXT_SLIDE_CREATED` | - | Plain text slide created | ✅ Exists |
| `NEW_BIBLE_SLIDE_CREATED` | - | Bible verse slide created | ✅ Exists |
| `NEW_HYMN_SLIDE_CREATED` | - | Hymn slide created | ✅ Exists |
| `NEW_SONG_SLIDE_CREATED` | - | Song slide created | ✅ Exists |
| `NEW_MEDIA_SLIDE_CREATED` | `mediaType` | Media slide created (image/video) | ✅ Exists |
| `NEW_COUNTDOWN_SLIDE_CREATED` | - | Countdown slide created | ✅ Exists |
| `SLIDE_DUPLICATED` | - | Slide duplicated | ✅ Exists |
| `DELETE_SLIDE` | - | Single slide deleted | ✅ Exists |
| `REMOVE_ALL_SELECTED_SLIDES_BTN_CLICKED` | - | Bulk slide deletion | ✅ Exists |
| `SLIDE_EDITED` | `slideType`, `slideId` | Slide content modified | ⚠️ Missing |
| `SLIDE_BACKGROUND_CHANGED` | `backgroundType`, `slideType` | Slide background updated | ⚠️ Missing |
| `SLIDE_LAYOUT_CHANGED` | `oldLayout`, `newLayout`, `slideType` | Slide layout changed | ⚠️ Missing |

---

## 📖 Bible & Content Search
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `SEARCH_BIBLE_PAGE_OPENED` | - | Bible search modal opened | ✅ Exists |
| `BIBLE_SEARCH_PERFORMED` | `searchQuery`, `bibleVersion` | User searches for scripture | ✅ Added |
| `GOTO_SCRIPTURE_TOOLBAR_USED` | - | Quick navigation to scripture | ✅ Exists |
| `GOTO_CHORUS_TOOLBAR_USED` | - | Quick nav to chorus | ✅ Exists |
| `GOTO_HYMN_TOOLBAR_USED` | - | Quick nav to hymn | ✅ Exists |
| `GOTO_SONG_TOOLBAR_USED` | - | Quick nav to song | ✅ Exists |
| `HYMN_SEARCH_PERFORMED` | `searchQuery` | User searches for hymn | ⚠️ Missing |
| `SONG_LYRICS_SEARCH_PERFORMED` | `searchQuery`, `artist` | User searches online lyrics | ⚠️ Missing |

---

## 🎥 Live Presentation & Projection
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `GO_LIVE_BUTTON_CLICKED` | - | User opens live projection window | ✅ Exists |
| `CLOSE_LIVE_WINDOW_BUTTON_CLICKED` | - | Live window closed | ✅ Exists |
| `SLIDE_PRESENTED_LIVE` | `slideType`, `slideLayout`, `slideId` | Slide broadcasted to live output | ✅ Added |
| `SLIDES_REORDERED` | `slideCount` | User reorders slides in live output | ✅ Added |
| `LIVE_SESSION_STARTED` | `scheduleId`, `slideCount` | First slide goes live in a session | ⚠️ Missing |
| `LIVE_SESSION_ENDED` | `scheduleId`, `sessionDuration`, `totalSlides` | Live window closed after session | ⚠️ Missing |
| `LIVE_PRESENTATION_PAUSED` | `slideId` | Presentation paused (blank screen) | ⚠️ Missing |

---

## 📱 Remote Control & Collaboration
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `REMOTE_CONTROL_CONNECTED` | `scheduleId` | Remote device connected via WebSocket | ✅ Added |
| `REMOTE_CONTROL_DISCONNECTED` | `scheduleId` | Remote disconnected | ✅ Added |
| `REMOTE_CONTROL_RECONNECTED` | `scheduleId`, `retryCount` | Remote reconnected after failure | ⚠️ Missing |
| `REMOTE_SLIDE_CHANGED` | `slideId`, `slideType` | Slide changed via remote control | ⚠️ Missing |
| `TEAM_MEMBER_INVITED` | `role` | Invitation sent to team member | ✅ Exists |
| `INVITED_USERS_EMAIL_SENT` | - | Invitation email sent | ✅ Exists |
| `SLIDE_LOCKED_BY_USER` | `slideId`, `userId` | Real-time collaborative lock acquired | ⚠️ Missing |
| `SLIDE_EDITING_CONFLICT` | `slideId` | User tried to edit locked slide | ⚠️ Missing |

---

## 🗂️ Library & Saved Content
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `LIBRARY_SAVE_SLIDE` | - | Slide saved to library | ✅ Exists |
| `LIBRARY_SLIDE_LOADED` | `slideType` | Slide loaded from library | ⚠️ Missing |
| `LIBRARY_SONG_SAVED` | `songTitle`, `artist` | Song saved to personal library | ⚠️ Missing |
| `LIBRARY_SONG_LOADED` | `songTitle` | Song loaded from library | ⚠️ Missing |
| `LIBRARY_ITEM_DELETED` | `itemType` | Library item deleted | ⚠️ Missing |

---

## ⚙️ Settings & Customization
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `OPEN_SETTINGS_MODAL` | - | Settings panel opened | ✅ Exists |
| `BIBLE_VERSIONS_SETTINGS_CHANGED` | - | Bible version preferences updated | ✅ Exists |
| `LIVE_WINDOW_FULLSCREEN_SETTINGS_CHANGED` | - | Fullscreen setting toggled | ✅ Exists |
| `LINES_PER_SLIDE_SETTINGS_CHANGED` | - | Lines per slide updated | ✅ Exists |
| `ANIMATIONS_SETTINGS_CHANGED` | - | Animation preferences changed | ✅ Exists |
| `FOOTNOTES_SETTINGS_CHANGED` | - | Footnote display toggled | ✅ Exists |
| `SONG_AND_HYMN_LABELS_SETTINGS_CHANGED` | - | Label display preferences changed | ✅ Exists |
| `TRANSITION_INTERVAL_SETTINGS_CHANGED` | - | Slide transition timing updated | ✅ Exists |
| `WINDOW_PADDING_SETTINGS_CHANGED` | - | Display padding adjusted | ✅ Exists |
| `DEFAULT_BACKGROUND_SETTINGS_CHANGED` | - | Default slide background set | ✅ Exists |
| `TOGGLE_DARK_MODE` | `darkMode` | Theme toggled | ✅ Exists |
| `DEFAULT_FONT_CHANGED` | `fontFamily` | Default font updated | ⚠️ Missing |
| `SLIDE_THEME_APPLIED` | `themeName` | Pre-built theme applied | ⚠️ Missing |

---

## 💳 Monetization & Subscription
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `UPGRADE_MODAL_OPENED` | `source`, `feature` | Upgrade modal displayed | ✅ Exists |
| `UPGRADE_MODAL_OPENED_AFTER_VERIFICATION` | `source` | Upgrade prompt post-verification | ✅ Exists |
| `UPGRADE_PROMPT_SHOWN` | `feature`, `location`, `currentCount`, `limit` | Feature limit hit | ✅ Exists |
| `UPGRADE_INITIATED` | `plan` | User clicks upgrade button | ✅ Exists |
| `UPGRADE_BUTTON_CLICKED` | `plan`, `price` | Checkout initiated | ✅ Exists |
| `PAYMENT_CANCELLED` | `plan` | User cancels checkout | ✅ Exists |
| `PAYMENT_SUCCESSFUL` | `plan`, `amount`, `currency` | Payment completed | ✅ Exists |
| `CURRENCY_AUTO_DETECTED` | `currency`, `country` | Currency auto-selected | ✅ Exists |
| `TEAMS_FEATURE_BLOCKED` | `source` | Free user hits Teams feature | ✅ Exists |
| `SUBSCRIPTION_CANCELLED` | `plan`, `reason` | User cancels subscription | ⚠️ Missing |
| `SUBSCRIPTION_RENEWED` | `plan` | Auto-renewal successful | ⚠️ Missing |

---

## 🎨 Media & Templates
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `MEDIA_UPLOADED` | `mediaType`, `fileSize`, `source` | User uploads image/video | ⚠️ Missing |
| `YOUTUBE_VIDEO_ADDED` | `videoUrl` | YouTube video embedded | ⚠️ Missing |
| `VIMEO_VIDEO_ADDED` | `videoUrl` | Vimeo video embedded | ⚠️ Missing |
| `TEMPLATE_BROWSED` | - | User opens templates gallery | ⚠️ Missing |
| `TEMPLATE_APPLIED` | `templateName`, `slideType` | Pre-designed template applied | ⚠️ Missing |

---

## 🔔 Alerts & Overlays
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `NEW_ALERT_SENT` | - | Alert message sent to live output | ✅ Exists |
| `ALERT_REMOVED` | - | Alert cleared from screen | ⚠️ Missing |
| `OVERLAY_APPLIED` | `overlayType` | Overlay (lower third, etc.) added | ⚠️ Missing |

---

## 📲 App Installation & Updates
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `APP_INSTALLED` | - | PWA installed | ✅ Exists |
| `APP_INSTALL_CANCELLED` | - | Installation prompt dismissed | ✅ Exists |
| `APP_UPDATED` | - | App updated to new version | ✅ Exists |
| `OPEN_INVITE_MODAL` | - | Invite team modal opened | ✅ Exists |

---

## 📦 Import/Export & Data Portability
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `SLIDES_EXPORTED` | `format`, `slideCount` | User exports slides (JSON/ProPresenter/EasyWorship) | ⚠️ Missing |
| `SLIDES_IMPORTED` | `format`, `slideCount`, `source` | User imports slides from file | ⚠️ Missing |
| `SCHEDULE_EXPORTED` | `scheduleId`, `slideCount` | Schedule exported | ⚠️ Missing |
| `SCHEDULE_IMPORTED` | `scheduleId`, `slideCount` | Schedule imported | ⚠️ Missing |

---

## 🎭 Advanced Features
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `ADVERT_MODAL_OPENED` | - | Advertisement displayed | ✅ Exists |
| `ADVERT_CLICKED` | - | User clicks ad | ✅ Exists |
| `LYRICS_EDITOR_OPENED` | `songId` | User opens lyrics editor | ⚠️ Missing |
| `LYRICS_EDITED` | `songId` | User modifies song lyrics | ⚠️ Missing |
| `CUSTOM_VERSE_ORDER_APPLIED` | `songId`, `verseOrder` | User reorders verses | ⚠️ Missing |

---

## 🎙️ Sermon Transcription
| Event Name | Properties | Description | Status |
|------------|-----------|-------------|---------|
| `TRANSCRIPTION_PANEL_OPENED` | - | User opens the Transcribe panel | ✅ Added |
| `TRANSCRIPTION_STARTED` | `provider` (`deepgram`\|`web-speech-api`), `plan` (`teams`\|`free`) | User starts a transcription session | ✅ Added |
| `TRANSCRIPTION_STOPPED` | `provider`, `plan`, `segmentCount` | User stops a transcription session | ✅ Added |
| `TRANSCRIPTION_CLEARED` | `provider`, `plan`, `segmentCount` | User clears the transcript | ✅ Added |
| `TRANSCRIPTION_BIBLE_REFERENCE_CLICKED` | `reference` | User clicks an inline Bible reference in the transcript | ✅ Added |
| `TRANSCRIPTION_SCRIPTURE_SUGGESTION_CLICKED` | `reference`, `displayLabel` | User clicks a scripture in the Scriptures tab | ✅ Added |

---

## 📊 Legend
- ✅ **Exists**: Event is already implemented in codebase
- ✅ **Added**: Event added during this tracking improvement session
- ⚠️ **Missing**: Event should be added for comprehensive tracking

---

## 🎯 Priority Implementation (Next Steps)

### High Priority (Core User Journey)
1. `LIVE_SESSION_STARTED` / `LIVE_SESSION_ENDED` - Track actual service usage
2. `SLIDE_EDITED` - Monitor content modification patterns
3. `MEDIA_UPLOADED` - Track media library usage
4. `SLIDES_EXPORTED` / `SLIDES_IMPORTED` - Measure migration/export behavior
5. `REMOTE_SLIDE_CHANGED` - Track remote control effectiveness

### Medium Priority (Engagement Metrics)
6. `LIBRARY_SLIDE_LOADED` / `LIBRARY_SONG_LOADED` - Library re-use patterns
7. `TEMPLATE_APPLIED` - Template feature adoption
8. `HYMN_SEARCH_PERFORMED` / `SONG_LYRICS_SEARCH_PERFORMED` - Search behavior
9. `SCHEDULE_DELETED` / `SCHEDULE_RENAMED` - Schedule management patterns
10. `SLIDE_BACKGROUND_CHANGED` - Customization depth

### Lower Priority (Nice to Have)
11. `SUBSCRIPTION_CANCELLED` / `SUBSCRIPTION_RENEWED` - Revenue analytics
12. `SLIDE_EDITING_CONFLICT` - Collaboration friction points
13. `ALERT_REMOVED` / `OVERLAY_APPLIED` - Advanced feature usage
14. `CUSTOM_VERSE_ORDER_APPLIED` - Power user behaviors

