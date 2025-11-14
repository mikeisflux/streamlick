# Settings Modal Implementation Checklist

Based on: `main-canvas-layout-guide.md` - Section 13

## Modal Structure
- [x] Modal dimensions (700x600px, centered)
- [x] Header with title and close button (50px height)
- [x] Left sidebar navigation (200px width)
- [x] Content area (500px width)
- [x] 8 tab system with icons
- [x] White background, rounded corners (12px), shadow

## Tab 1: General Settings ⚙️
- [ ] **Resolution dropdown**
  - [ ] Label: "Resolution"
  - [ ] Options: Full High Definition (1080p), High Definition (720p), Standard Definition (480p)
  - [ ] Width: 400px
  - [ ] Default: 1080p
  - [x] ✅ Basic implementation exists

- [ ] **Show resolution badge checkbox**
  - [x] ✅ Implemented
  - [x] Checked by default

- [ ] **Orientation radio buttons**
  - [ ] Options: Landscape (default), Portrait
  - [ ] Radio button group

- [ ] **Additional checkboxes**
  - [ ] ☑ Display informative messages on stage
  - [ ] ☑ Shift videos up for comments/banners
  - [ ] ☑ Audio avatars
  - [ ] ☑ Automatically add presented media to stage

- [ ] **Appearance buttons**
  - [ ] Three options: [Auto] [Light] [Dark]
  - [ ] Default: Light selected
  - [ ] Button group styling

## Tab 2: Camera Settings 📹
- [ ] **Camera preview window**
  - [ ] Size: 760x428px (16:9 ratio)
  - [ ] Live camera feed display
  - [ ] Top-right controls: [Camera off] [Crop] [Translate]

- [x] **Camera device dropdown**
  - [x] ✅ Basic implementation exists
  - [ ] Connect to real video devices list
  - [ ] Show device labels properly

- [ ] **Camera resolution dropdown**
  - [ ] Label: "Camera resolution"
  - [ ] Options: High Definition (720p), Standard Definition (480p)
  - [ ] Default: 720p

- [x] **Mirror my camera checkbox**
  - [x] ✅ Implemented
  - [ ] Add info tooltip: "Heads up, if you have an overlay that covers a lot of the screen, you might cover yourself"

- [ ] **(Advanced) Restrictive firewall mode checkbox**
  - [ ] Unchecked by default
  - [ ] Warning note about requiring studio rejoin

## Tab 3: Audio Settings 🎤
- [x] **Mic dropdown**
  - [x] ✅ Basic implementation exists
  - [ ] Connect to real audio input devices
  - [ ] Show device labels properly
  - [ ] Volume meter visualization: [▮▮▮▮▮░░░░░]

- [ ] **Speaker dropdown**
  - [ ] Connect to real audio output devices
  - [ ] [Test] button functionality
  - [ ] Show device labels properly

- [x] **Echo cancellation checkbox**
  - [x] ✅ Implemented
  - [ ] Add info icon with explanation

- [x] **Noise suppression checkbox**
  - [x] ✅ Implemented (called "Reduce mic background noise" in spec)
  - [ ] Add info icon with explanation

- [ ] **Stereo audio checkbox**
  - [ ] Note: "Echo cancellation must be off to use stereo audio"
  - [ ] Conditional disable logic

- [x] **Auto-adjust microphone checkbox**
  - [x] ✅ Implemented (called "Automatically adjust mic volume" in spec)
  - [ ] Add info icon with explanation

- [x] **Input volume slider**
  - [x] ✅ Implemented
  - [ ] Style to match spec (0-100 range with labels)

## Tab 4: Visual Effects Settings ✨
- [ ] **Camera preview (large)**
  - [ ] Full width display (~500px)
  - [ ] Show effects in real-time
  - [ ] Top-right controls: [Camera off] [Effects] [Text]

- [ ] **Enhance skin appearance checkbox**
  - [ ] Unchecked by default
  - [ ] ✨ sparkle icon
  - [ ] Info tooltip

- [ ] **Green screen checkbox**
  - [ ] Label: "I have a green screen"
  - [ ] Info tooltip
  - [ ] Link: "See our virtual background guide for tips"

- [ ] **Virtual backgrounds section**
  - [ ] Label with info icon
  - [ ] 2x4 grid of background thumbnails:
    - [ ] [None] - selected by default with checkmark
    - [ ] [Blur]
    - [ ] [Brick wall]
    - [ ] [Office]
    - [ ] [Sunset cityscape]
    - [ ] [Forest night]
    - [ ] [Branded logo circle]
    - [ ] [+] Add custom background button

- [x] **Background blur checkbox** (existing)
  - [x] ✅ Implemented

- [x] **Virtual background checkbox** (existing)
  - [x] ✅ Implemented

- [x] **Background removal checkbox** (existing)
  - [x] ✅ Implemented

- [x] **Auto-enhance lighting checkbox** (existing)
  - [x] ✅ Implemented

- [x] **Color correction checkbox** (existing)
  - [x] ✅ Implemented

## Tab 5: Recording Settings ⏺️
- [ ] **Local recording section header**
  - [ ] Header: "Local recording"
  - [ ] Description: "High-quality individual audio and video recordings for each guest."
  - [ ] "Learn more" link

- [ ] **Record locally checkbox** (main toggle)
  - [ ] Label: "Record locally for each participant"
  - [ ] Info icon
  - [ ] Sub-options when checked:
    - [ ] Radio: ◉ Record audio and video (default)
    - [ ] Radio: ○ Record audio only

- [x] **Recording quality dropdown** (existing)
  - [x] ✅ Basic implementation exists

- [x] **Record local copies checkbox** (existing)
  - [x] ✅ Implemented

- [x] **Separate audio tracks checkbox** (existing)
  - [x] ✅ Implemented

- [x] **Auto-save recordings checkbox** (existing)
  - [x] ✅ Implemented

## Tab 6: Hotkeys Settings ⌨️
- [x] **Hotkeys list display**
  - [x] ✅ Basic 6 hotkeys implemented
  - [ ] **MISSING SECTIONS - Need to add:**

- [ ] **DEVICES Section**
  - [ ] Mute/unmute mic: [CTRL+D]
  - [ ] Camera on/off: [CTRL+E]

- [ ] **SHARING Section**
  - [ ] Share screen: [SHIFT+S]
  - [ ] Share video: [SHIFT+V]
  - [ ] Share image: [SHIFT+I]
  - [ ] Play/pause shared video: [Not set]
  - [ ] Share second camera: [Not set]

- [ ] **SLIDES Section**
  - [ ] Next slideshow slide: [RIGHT]
  - [ ] Previous slideshow slide: [LEFT]

- [ ] **STREAMING AND RECORDING Section**
  - [ ] Start stream/recording: [Not set]
  - [ ] End stream/recording: [Not set]
  - [ ] Pause/resume recording: [Not set]
  - [ ] Cancel recording: [Not set]

- [ ] **LAYOUTS Section** (9 layout shortcuts)
  - [ ] Solo layout: [SHIFT+1]
  - [ ] Cropped layout: [SHIFT+2]
  - [ ] Group layout: [SHIFT+3]
  - [ ] Spotlight layout: [SHIFT+4]
  - [ ] News layout: [SHIFT+5]
  - [ ] Screen layout: [SHIFT+6]
  - [ ] Picture-in-picture layout: [SHIFT+7]
  - [ ] Cinema layout: [SHIFT+8]
  - [ ] Mission Briefing: [Not set]
  - [ ] Next layout: [L]
  - [ ] Previous layout: [SHIFT+L]

- [ ] **SCENES Section**
  - [ ] Next scene: [Not set]
  - [ ] Previous scene: [Not set]

- [ ] **NAVIGATION Section** (10 hotkeys)
  - [ ] Open comments tab: [Not set]
  - [ ] Open banners tab: [Not set]
  - [ ] Open media assets tab: [Not set]
  - [ ] Open style tab: [Not set]
  - [ ] Open notes tab: [Not set]
  - [ ] Open people tab: [Not set]
  - [ ] Open private chat: [Not set]
  - [ ] Open recording tab: [Not set]
  - [ ] Open settings: [Not set]
  - [ ] Next tab: [T]
  - [ ] Previous tab: [SHIFT+T]

- [ ] **OTHER Section**
  - [ ] Enter/exit fullscreen: [SHIFT+F]
  - [ ] Toggle display names: [Not set]
  - [ ] Create marker: [B]

- [ ] **Hotkey input fields**
  - [ ] Click to record new key combination
  - [ ] [×] button to clear hotkey
  - [ ] Conflict detection (highlight in red)
  - [ ] "Even more hotkey options are coming soon!" message

- [ ] **[Restore defaults] button**
  - [ ] At bottom of scrollable content

## Tab 7: Layouts Settings 📐
- [ ] **Header text**
  - [ ] "Select which layouts you would like to use"

- [ ] **Layout list with reordering**
  - [ ] Drag handles [::] on left
  - [ ] Layout icon preview
  - [ ] Checkbox to enable/disable each
  - [ ] Layout name display
  - [ ] Options menu [⋮] on right for custom layouts

- [ ] **Default layouts list:**
  - [ ] ☑ Cropped layout
  - [ ] ☑ Group layout
  - [ ] ☑ Spotlight layout
  - [ ] ☑ News layout
  - [ ] ☑ Screen layout
  - [ ] ☑ Picture-in-picture layout
  - [ ] ☑ Cinema layout
  - [ ] ☑ Mission Briefing (with menu)

- [x] **Auto-arrange participants** (existing)
  - [x] ✅ Implemented

- [x] **Remember layout preferences** (existing)
  - [x] ✅ Implemented

- [x] **Show layout grid lines** (existing)
  - [x] ✅ Implemented

- [x] **Default layout dropdown** (existing)
  - [x] ✅ Implemented
  - [ ] Update options to match spec layout names

## Tab 8: Guests Settings 👥
- [ ] **Guest permissions section**
  - [ ] ☑ Guests can stream this to their own destinations (with info icon)
  - [ ] ☑ Guests see viewer comments and post (with info icon)
  - [ ] ☑ Play a sound when guests enter (with info icon)
  - [ ] ☐ Guests must authenticate (with info icon, unchecked)

- [ ] **Banned guests section**
  - [ ] Border: 1px solid #E0E0E0
  - [ ] Padding: 20px
  - [ ] Text: "No banned guests" (empty state)
  - [ ] Dynamic list when guests are banned

- [ ] **Greenroom section**
  - [ ] ☐ Greenroom ✨ checkbox (unchecked)
  - [ ] Description: "The best way to manage guests for important streams."
  - [ ] "Learn more" link
  - [ ] Info box (blue background):
    "ℹ Upgrade to Teams or Business plan to access Greenroom and ensure your guests are ready to go live."

- [x] **Basic guest permission toggles** (existing)
  - [x] ✅ Guests can enable camera
  - [x] ✅ Guests can enable microphone
  - [x] ✅ Guests can share screen
  - [x] ✅ Require approval to join
  - [x] ✅ Mute guests on entry
  - [x] ✅ Disable guest camera on entry
  - [x] ✅ Show guests in backstage first

---

## Summary Status

### ✅ COMPLETED (Basic Implementation):
- [x] Modal structure and layout
- [x] 8 tab navigation with icons
- [x] General Settings (partial)
- [x] Camera Settings (partial)
- [x] Audio Settings (partial)
- [x] Visual Effects Settings (partial)
- [x] Recording Settings (partial)
- [x] Hotkeys Settings (partial - 6/40+ hotkeys)
- [x] Layouts Settings (partial)
- [x] Guests Settings (partial)

### ⚠️ NEEDS COMPLETION:
- [ ] Connect to real device lists (camera/audio/speaker)
- [ ] Add missing orientation, appearance, and info message toggles
- [ ] Implement camera preview with live feed
- [ ] Add volume meters for audio
- [ ] Create virtual backgrounds grid UI
- [ ] Complete hotkeys list (currently 6/40+ implemented)
- [ ] Add layout reordering with drag handles
- [ ] Implement banned guests list
- [ ] Add Greenroom upgrade section
- [ ] Add info icons with tooltips throughout
- [ ] Implement [Test] speaker button
- [ ] Add stereo audio conditional logic
- [ ] Create hotkey recording interface
- [ ] Add [Restore defaults] button for hotkeys

### 🔧 NEEDS WIRING:
- [ ] Connect all settings to Studio.tsx state
- [ ] Pass real device lists from useMediaDevices
- [ ] Implement settings persistence (localStorage)
- [ ] Apply canvas background color changes in real-time
- [ ] Apply resolution changes to canvas
- [ ] Wire up all toggle switches to parent state

### 📊 COMPLETION ESTIMATE:
- **Modal UI Structure:** 95% ✅
- **Settings Options:** 60% ⚠️
- **Functionality/Wiring:** 30% ⚠️
- **Overall Completion:** ~60%

---

## Priority Implementation Order:

1. **HIGH PRIORITY** (Functional Settings):
   - Connect device selectors to real devices
   - Wire up canvas settings (resolution, background color)
   - Implement settings persistence
   - Add missing info icons and tooltips

2. **MEDIUM PRIORITY** (Enhanced UX):
   - Complete hotkeys list (40+ shortcuts)
   - Add camera preview with live feed
   - Implement virtual backgrounds grid
   - Add volume meters for audio

3. **LOW PRIORITY** (Nice-to-have):
   - Greenroom upgrade section
   - Banned guests list
   - Layout reordering drag-and-drop
   - Stereo audio conditional logic
   - Hotkey conflict detection
