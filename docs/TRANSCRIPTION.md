# Sermon Transcription Feature

## Overview
The Sermon Transcription feature provides real-time, **offline** speech-to-text transcription with automatic Bible reference detection. This is a **Teams-tier** feature.

## Technology
- **Web Speech API**: Browser-native speech recognition (no internet required after initial page load)
- **Offline-first**: Works completely offline using the browser's built-in capabilities
- **Bible Reference Parser**: Automatically detects and highlights Bible references in the transcript

## Browser Support
The feature requires browsers that support the Web Speech API:
- ✅ **Google Chrome** (recommended)
- ✅ **Microsoft Edge** (recommended)
- ✅ **Safari** (macOS/iOS)
- ❌ Firefox (not supported)
- ❌ Opera (limited support)

## Features

### 1. Real-time Transcription
- Continuous listening mode
- Live transcript display with cursor indicator
- Automatic segmentation of finalized speech

### 2. Bible Reference Detection
The parser supports various formats:
- **Standard**: "John 3:16", "Matthew 5:3"
- **Spoken**: "John chapter 3 verse 16"
- **Ranges**: "Matthew 5:3-12", "John 3:16-17"
- **Multiple verses**: "Psalm 23 verses 1 through 6"
- **Abbreviations**: "Gen 1:1", "Matt 5:3", "1 Cor 13:4"

All 66 books of the Bible are supported with common abbreviations.

### 3. Interactive Bible References
- Detected Bible references are clickable
- Click to automatically create a Bible slide in the current schedule
- References are visually highlighted with a Bible icon

### 4. Interactive Bible References
- Detected Bible references are clickable
- Click to automatically create a Bible slide in the current schedule
- References are visually highlighted with a Bible icon
- All clicked references update the same Bible slide (no duplicate slides created)

### 5. UI Controls
- **Start/Stop**: Toggle transcription on/off
- **Clear**: Remove all transcript segments from current session
- **Close**: Hide the transcripts panel

## Usage

### Quick Actions
1. Click "Transcribe Sermon" in Quick Actions
2. Or click the microphone icon in an existing transcript panel

### During Service
1. Start transcription before the sermon begins
2. Speak normally - the browser will transcribe automatically
3. Click any detected Bible reference to create or update a Bible slide
4. Stop transcription when finished

### Tips for Best Results
- Use a quality microphone
- Speak clearly and at a moderate pace
- Ensure minimal background noise
- Mention book names clearly (e.g., "The book of John chapter 3 verse 16")

## Privacy & Security
- **No cloud processing**: All transcription happens locally in the browser
- **No data sent to servers**: Transcripts are session-based (not stored)
- **Offline capable**: No internet connection required for transcription

## Technical Implementation

### Files
- `composables/useSermonTranscription.ts` - Main transcription logic
- `composables/useBibleReferenceParser.ts` - Bible reference detection
- `components/live/TranscriptsPanel.vue` - UI panel
- `components/live/TranscriptText.vue` - Rendered transcript with clickable refs
- `types/transcript.ts` - TypeScript interfaces

### Architecture
```
User speaks → Web Speech API → onresult event
                                    ↓
                        Text + Bible reference parsing
                                    ↓
                        Create TranscriptSegment (in memory)
                                    ↓
                        Display in UI with clickable refs
```

### Limitations
1. **Session-based**: Transcripts are cleared when transcription stops or panel is closed
2. **Browser-dependent accuracy**: Transcription quality varies by browser
3. **English only**: Currently configured for en-US
4. **No punctuation**: Browser API doesn't provide automatic punctuation
5. **Continuous mode restarts**: Some browsers require periodic restarts

## Future Enhancements
- [ ] Multi-language support
- [ ] Export transcript as text/PDF
- [ ] Persistent storage option
- [ ] Search within transcript
- [ ] Timestamp navigation
- [ ] Speaker identification
- [ ] Custom vocabulary (church-specific terms)

