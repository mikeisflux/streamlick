# StudioCanvas Implementation Checklist

## Overview
StudioCanvas.tsx is the main rendering component that displays the live stream output.
- **Original:** HTML/CSS rendering (1244 lines)
- **Target:** Canvas 2D API rendering
- **Canvas Size:**
  - Landscape: 1001px max width, 16:9 aspect ratio
  - Portrait: 563px max width, 9:16 aspect ratio
- **Target Resolution:** 1920x1080 (1080p) for landscape

---

## 1. PARTICIPANTS

### Local Participant (Host)
- **Location:** Lines 850-926
- **Video Source:** `localStream` (processed with noise gate) or `rawStream`
- **Video Element:** `mainVideoRef`
- **Features:**
  - Video enabled: Show camera feed
  - Video disabled: Show avatar (from localStorage 'selectedAvatar')
  - Audio visualization: Pulsating ring when speaking (`isLocalSpeaking`)
  - Mirror video: Controlled by `styleSettings.mirrorVideo`
  - Camera frame: rounded/circle/square/none (`styleSettings.cameraFrame`)
  - Border: Width and color (`styleSettings.borderWidth`, `styleSettings.primaryColor`)
- **Props:**
  - `videoEnabled`, `audioEnabled`, `isLocalUserOnStage`
  - Name: "You"
  - Position number: 1
  - Is host: true

### Remote Participants
- **Location:** Lines 929-955
- **Source:** `remoteParticipants` Map
- **Filtering:** Exclude role='backstage' and id='screen-share'
- **Features:**
  - Video/audio enabled states
  - Speaking detection (audio level analysis, lines 284-371)
  - Connection quality indicator
  - Lower thirds
  - Position numbers
  - Remove from stage button

### Screen Share
- **Location:** Lines 742-844
- **Video Element:** `screenShareVideoRef`
- **Layout:** Layout 6 ("Screen") - special layout
  - Top bar: Participant thumbnails (12% height)
  - Bottom: Screen share feed (88% height)
- **Source:** `screenShareStream`

---

## 2. LAYOUTS

All layouts defined in `getLayoutStyles()` function (lines 543-658)

### Layout 1: Solo
- **Type:** Single participant fills screen
- **Grid:** 1x1 but rendered at 50% size centered
- **Use:** One person streaming

### Layout 2: Cropped
- **Type:** 2x2 grid, tight boxes
- **Grid:** 2 columns x 2 rows
- **Use:** Up to 4 participants, equal size

### Layout 3: Group
- **Type:** Auto-calculated equal grid
- **Formula:** `cols = Math.ceil(Math.sqrt(count))`
- **Dynamic:** Adjusts to participant count

### Layout 4: Spotlight
- **Type:** One large + small boxes above
- **Grid:** 3 columns x 4 rows
- **Main:** Bottom 3 rows (col-span-3, row-span-3)
- **Secondary:** Top row slots (col-span-1, row-span-1)
- **Use:** Presenter with audience

### Layout 5: News
- **Type:** Side by side
- **Grid:** 2 columns x 1 row
- **Use:** Interview/discussion format

### Layout 6: Screen
- **Type:** Screen share with participant thumbnails
- **Top bar:** 12% height, horizontal participant boxes
- **Bottom:** 88% height, screen share fullscreen
- **Special:** Activated when `isSharingScreen || screenShareStream`

### Layout 7: Picture-in-Picture (PIP)
- **Type:** Full screen main + overlay corner
- **Main:** Full canvas
- **Overlay:** Bottom-right corner, 1/4 size (240x180px when solo)
- **Use:** Main content with host overlay

### Layout 8: Cinema
- **Type:** Wide format (21:9 aspect)
- **Grid:** 2 columns x 1 row (if >1 participant)
- **Use:** Cinematic widescreen

### Layout 9: Video Grid
- **Type:** Auto-adjusting grid with gaps
- **Grid:** Dynamic based on participant count
- **Gaps:** 4px (larger than other layouts)
- **Use:** Gallery view for meetings

### Layout 10: Advanced Positioning
- **Type:** Draggable custom positions
- **Storage:** localStorage key `customLayout_${selectedLayout}`
- **Format:** Map of participant positions {id, x, y, width, height}
- **Editing:** `editMode` prop enables drag/resize

---

## 3. MEDIA ASSETS

### Background Image
- **Location:** Lines 246-281
- **Storage:** localStorage 'streamBackgroundAssetId' (IndexedDB) or 'streamBackground' (URL)
- **Rendering:** Full canvas size, object-fit: cover
- **Z-index:** Bottom layer
- **Loading:** useEffect with event listener for 'backgroundUpdated'
- **Fallback:** `backgroundColor` prop (default: '#0F1419')

### Logo
- **Location:** Lines 439-523 (loading), 1066-1089 (rendering)
- **Storage:** localStorage 'streamLogoAssetId' or 'streamLogo'
- **Position:** Top-left (20px, 20px)
- **Max Size:** 150x150px
- **Z-index:** 20
- **Event:** 'logoUpdated'

### Overlay (Full-screen)
- **Location:** Lines 460-476 (loading), 1092-1106 (rendering)
- **Storage:** localStorage 'streamOverlayAssetId' or 'streamOverlay'
- **Position:** Full canvas (absolute inset-0)
- **Size:** Full width/height, object-fit: cover
- **Z-index:** 30 (on top of participants)
- **Event:** 'overlayUpdated'
- **Use:** Full-screen graphics like cyberpunk character

### Video Clip
- **Location:** Lines 479-494 (loading), 1109-1202 (rendering)
- **Storage:** localStorage 'streamVideoClipAssetId' or 'streamVideoClip'
- **Position:** Full canvas overlay
- **Z-index:** 35 (highest media layer)
- **Audio:** Routed through audioMixerService
- **Features:**
  - Auto-remove on end (onEnded event)
  - Close button (top-right)
  - Unmuted, volume 1.0
- **Event:** 'videoClipUpdated'

---

## 4. OVERLAYS & TEXT

### Banners (Lower Thirds / Text Overlays)
- **Location:** Lines 151-198 (loading), 1045-1063 (rendering)
- **Storage:** localStorage 'banners'
- **Types:** 'lower-third', 'text-overlay', 'cta', 'countdown'
- **Positions:**
  - top-left, top-center, top-right
  - bottom-left, bottom-center, bottom-right
- **Styling:**
  - Custom backgroundColor, textColor
  - Title + optional subtitle
  - Rounded corners, shadow
  - Max width: 90%
- **Z-index:** 25
- **Event:** 'bannersUpdated' (custom) or 'storage' (cross-tab)

### AI Captions
- **Location:** Lines 1028 (rendering)
- **Component:** `<CaptionOverlay>`
- **Props:** `caption` (Caption object from caption.service)
- **Visibility:** Controlled by `captionsEnabled` prop
- **Format:** { text: string, confidence: number, timestamp: number }

### Teleprompter
- **Location:** Lines 1031-1039 (rendering)
- **Component:** `<TeleprompterOverlay>`
- **Props:**
  - notes: string
  - fontSize: number (default 24)
  - isScrolling: boolean
  - scrollSpeed: number (default 2)
  - scrollPosition: number
- **Visibility:** Controlled by `showTeleprompterOnCanvas` prop

### Comment Overlay
- **Location:** Lines 1042 (rendering)
- **Component:** `<CommentOverlay>`
- **Props:**
  - comment: { id, platform, authorName, authorAvatar, message, timestamp }
  - onDismiss: callback
- **Platforms:** youtube, facebook, twitch, linkedin, x, rumble

### Chat Overlay
- **Location:** Lines 978-1025 (rendering)
- **Position:** Draggable & resizable
- **Default Position:** Bottom-right (16px, 80px from bottom)
- **Size:** Controlled by `chatOverlaySize` prop
- **Features:**
  - Drag handle (top bar)
  - Resize handle (bottom-right corner)
  - Shows last 10 messages
  - Author name + message format
- **Z-index:** 10
- **Visibility:** Controlled by `showChatOnStream` prop

### Resolution Badge
- **Location:** Lines 960-975
- **Content:** "1080p"
- **Position:** Top-left (16px, 16px)
- **Size:** 60x32px
- **Style:** Black background (70% opacity), white text
- **Z-index:** 5
- **Visibility:** `showResolutionBadge` prop, hidden during screen share

---

## 5. STYLE SETTINGS

### Camera Frame Styles
- **Location:** Lines 200-244 (loading)
- **Storage:** localStorage 'style_cameraFrame'
- **Options:** 'none', 'rounded', 'circle', 'square'
- **Applied to:** ParticipantBox components

### Border Styling
- **Storage:** localStorage 'style_borderWidth', 'style_primaryColor'
- **Defaults:** 2px width, #0066ff color
- **Applied to:** Participant borders

### Mirror Video
- **Storage:** localStorage 'mirrorVideo'
- **Default:** false
- **Applied to:** Local participant video (transform: scaleX(-1))

### Event Listeners
- **'storage' event:** Cross-tab synchronization
- **'styleSettingsUpdated' event:** Same-tab updates

---

## 6. AUDIO

### Audio Level Detection

#### Local User
- **Hook:** `useAudioLevel(rawStream || localStream, audioEnabled)`
- **Returns:** `isLocalSpeaking` boolean
- **Used for:** Visual audio animations on local participant

#### Remote Participants
- **Location:** Lines 284-371
- **Method:** AudioContext + AnalyserNode
- **Config:**
  - FFT size: 512
  - Smoothing: 0.8
  - Threshold: 10
- **State:** `speakingParticipants` Set<string>
- **Cleanup:** Disconnects analyser nodes on unmount
- **Frame-based:** Uses requestAnimationFrame

### Volume Control
- **Location:** Lines 698-709, 1216-1236 (UI)
- **Range:** 0-100
- **Control:** Slider with -/+ labels
- **Routing:** `compositorService.setInputVolume(volume)`
  - Controls Web Audio API mixer
  - Affects ALL audio (participants, videos, clips)
- **UI:** Bottom center, opacity on hover

---

## 7. INTERACTION

### Fullscreen
- **Location:** Lines 688-696, 1206-1213 (button)
- **Button:** Bottom-right corner
- **Trigger:** `containerRef.requestFullscreen()`
- **Toggle:** Checks `document.fullscreenElement`

### Volume Slider
- **Location:** Lines 1216-1236
- **Position:** Bottom center
- **Visibility:** Opacity 0, shows on hover
- **Range:** 0-100 with labels
- **Display:** Current value as percentage

### Chat Drag/Resize
- **Props:**
  - `onChatOverlayDragStart`: Drag handler
  - `onChatOverlayResizeStart`: Resize handler
  - `isDraggingChat`, `isResizingChat`: State flags
- **Ref:** `chatOverlayRef` for position calculations

### Remove Participant
- **Prop:** `onRemoveFromStage(participantId: string)`
- **Passed to:** Each ParticipantBox component
- **Visibility:** Controlled by editMode

---

## 8. EDIT MODE

### Custom Layouts (Layout 10)
- **Location:** Lines 383-437
- **State:** `customLayoutPositions` Map
- **Storage:** localStorage `customLayout_${selectedLayout}`
- **Features:**
  - Drag participants to any position
  - Resize participants
  - Auto-save after 500ms debounce
- **Format:** {id, x, y, width, height}

### Visual Indicator
- **Border:** 4px solid purple (#8B5CF6) when `editMode={true}`

---

## 9. PROPS INTERFACE

### Required Media Props
- `localStream: MediaStream | null` - Local camera/mic (processed)
- `rawStream: MediaStream | null` - Pre-noise-gate audio for detection
- `videoEnabled: boolean`
- `audioEnabled: boolean`
- `isLocalUserOnStage: boolean`
- `remoteParticipants: Map<string, RemoteParticipant>`

### Screen Share Props
- `isSharingScreen: boolean`
- `screenShareStream: MediaStream | null`

### Layout Props
- `selectedLayout: number` (1-10)
- `orientation: 'landscape' | 'portrait'`
- `backgroundColor: string` (default '#0F1419')

### Chat Props
- `chatMessages: ChatMessage[]`
- `showChatOnStream: boolean`
- `chatOverlayPosition: {x, y}`
- `chatOverlaySize: {width, height}`
- `isDraggingChat: boolean`
- `isResizingChat: boolean`
- `chatOverlayRef: RefObject<HTMLDivElement>`
- `onChatOverlayDragStart: (e) => void`
- `onChatOverlayResizeStart: (e) => void`

### Caption Props
- `captionsEnabled: boolean`
- `currentCaption: Caption | null`

### Teleprompter Props
- `teleprompterNotes: string`
- `teleprompterFontSize: number`
- `teleprompterIsScrolling: boolean`
- `teleprompterScrollSpeed: number`
- `teleprompterScrollPosition: number`
- `showTeleprompterOnCanvas: boolean`

### Comment Props
- `displayedComment: Comment | null`
- `onDismissComment: () => void`

### UI Props
- `showResolutionBadge: boolean`
- `showPositionNumbers: boolean`
- `showConnectionQuality: boolean`
- `showLowerThirds: boolean`
- `editMode: boolean`
- `onRemoveFromStage: (id) => void`

---

## 10. CANVAS CONVERSION REQUIREMENTS

### Canvas Setup
- **Element:** `<canvas>` with 16:9 or 9:16 aspect ratio
- **Resolution:** 1920x1080 (landscape) or 1080x1920 (portrait)
- **FPS:** 30
- **Context:** 2D, {alpha: false, desynchronized: true}

### Rendering Order (Z-Index equivalent)
1. **Background** (color or image)
2. **Participants** (video or avatar)
3. **Resolution badge** (z:5)
4. **Chat overlay** (z:10)
5. **Banners** (z:25)
6. **Logo** (z:20)
7. **Overlay** (z:30) - full-screen graphics
8. **Video clip** (z:35) - highest media
9. **Captions** (on top)
10. **Teleprompter** (on top)
11. **Comments** (on top)
12. **Controls** (volume, fullscreen) - z:50

### Video Element Management
- Create hidden video elements for each participant
- Set srcObject to MediaStream
- Set autoplay, playsInline, muted
- Draw video frames to canvas in render loop
- Clean up on participant removal

### Image Loading
- Preload all images (background, logo, overlay, avatars)
- Cache HTMLImageElement instances
- Listen for storage/custom events for updates
- Handle CORS: crossOrigin = 'anonymous'

### Text Rendering
- Use fillText() for participant names, chat, captions
- Implement line wrapping for chat messages
- Match font sizes, colors, positions from HTML version
- Add shadows for better readability

### Audio Visualization
- Keep existing AudioContext/AnalyserNode setup
- Draw pulsating circles around speaking participants
- Use arc() for circular animations
- Scale based on audio level (0-1)

### Performance
- Target 30 FPS (33ms per frame)
- Use requestAnimationFrame for render loop
- Monitor frame times and dropped frames
- Throttle non-critical updates

### Output Stream
- Use `canvas.captureStream(30)` for video track
- Combine with audio from audioMixerService
- Export via `getOutputStream()` method
- Use in useBroadcast for WebRTC production

---

## 11. CRITICAL NOTES

### Do NOT Break
1. Audio mixer integration (compositorService.setInputVolume)
2. Video element auto-mute detection callbacks
3. localStorage synchronization (storage events)
4. Custom events (backgroundUpdated, logoUpdated, etc.)
5. AudioContext management for audio visualization
6. ParticipantBox video playback
7. Screen share video element handling

### Must Preserve
1. All layout calculations and positioning logic
2. Audio level detection for animations
3. Banner positioning system
4. Chat message formatting
5. Style settings (camera frame, borders, colors)
6. Mirror video for local participant
7. Edit mode drag/resize functionality
8. Volume control routing through Web Audio API

### New Additions Needed
1. Canvas render loop with requestAnimationFrame
2. Video frame drawing from video elements
3. Image drawing for backgrounds/overlays/logos
4. Text rendering for all overlay text
5. Shape drawing for audio animations
6. getOutputStream() export method
7. Canvas cleanup on unmount

---

## 12. TESTING CHECKLIST

### Visual Verification
- [ ] All 10 layouts render correctly
- [ ] Participants show video when enabled
- [ ] Avatars show when video disabled
- [ ] Background image displays correctly
- [ ] Logo appears in top-left
- [ ] Full-screen overlay works
- [ ] Banners show in correct positions
- [ ] Chat overlay is readable
- [ ] Captions display correctly
- [ ] Teleprompter shows when enabled
- [ ] Comments appear properly
- [ ] Resolution badge shows "1080p"

### Interaction
- [ ] Volume slider controls audio
- [ ] Fullscreen button works
- [ ] Chat can be dragged
- [ ] Chat can be resized
- [ ] Edit mode allows participant dragging
- [ ] Remove participant button works

### Media
- [ ] Background changes work
- [ ] Logo changes work
- [ ] Overlay changes work
- [ ] Video clips play with audio
- [ ] Screen share displays correctly

### Audio
- [ ] Local speaking animation works
- [ ] Remote speaking animations work
- [ ] Volume control affects all audio
- [ ] Audio mixer routing works

### Streaming
- [ ] Canvas stream exports correctly
- [ ] Media server receives stream
- [ ] Viewers see correct output
- [ ] No black screens or freezing
- [ ] FPS is stable at ~30

### Performance
- [ ] No memory leaks
- [ ] Smooth rendering at 30 FPS
- [ ] CPU usage reasonable
- [ ] No dropped frames
- [ ] Canvas updates in real-time

---

## CURRENT STATUS
- [x] Backup created: StudioCanvas.BACKUP.tsx
- [ ] Canvas element added
- [ ] Rendering loop implemented
- [ ] Background/overlay rendering ported
- [ ] Participant rendering ported
- [ ] Layout logic ported
- [ ] Text overlays ported
- [ ] Audio visualization ported
- [ ] Stream export added
- [ ] Testing completed
