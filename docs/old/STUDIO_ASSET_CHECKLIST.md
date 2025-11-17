# Studio.tsx Asset Checklist
**Reference**: `claude/allow-streamlick-host-011CUv8jPoqiWGPCPUQuj6Ur:frontend/src/pages/Studio.tsx`
**Target**: Current `claude/merge-to-master-3-011CUxFkQmELeGuqKzZTsixC:frontend/src/pages/Studio.tsx`

## Component Imports (Lines 1-40)

### ✅ HAVE - Core Components
- [x] VideoPreview
- [x] Button
- [x] Drawer
- [x] DestinationsPanel
- [x] InviteGuestsPanel
- [x] BannerEditorPanel
- [x] BrandSettingsPanel
- [x] ParticipantsPanel
- [x] RecordingControls
- [x] CaptionOverlay

### ❌ MISSING - Panel Components
- [ ] StylePanel
- [ ] NotesPanel
- [ ] MediaAssetsPanel
- [ ] PrivateChatPanel
- [ ] CommentsPanel

### ❌ MISSING - Feature Components
- [ ] ClipManager
- [ ] ProducerMode

### ✅ HAVE - Services
- [x] captionsService
- [x] clipRecordingService

### ❌ MISSING - Services
- [ ] verticalVideoService (commented out in reference)

### ✅ HAVE - Icons
- [x] VideoCameraIcon, MicrophoneIcon, ChatBubbleLeftIcon
- [x] UserGroupIcon, CogIcon, Bars3Icon, XMarkIcon

### ❌ MISSING - Killer Feature Icons
- [ ] FilmIcon (for clip recording)
- [ ] SparklesIcon (for AI captions)
- [ ] DevicePhoneMobileIcon (for clip manager)

---

## State Management (Lines 43-98)

### ✅ Core State (HAVE)
- [x] broadcastId
- [x] isLoading
- [x] broadcast, isLive, setBroadcast

### ❌ Sidebar State (NEED)
- [ ] leftSidebarOpen (controls 280px scenes panel)
- [ ] rightSidebarOpen (controls 320px tabbed panel)
- [ ] activeRightTab: 'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording'

### ❌ Layout State (NEED)
- [ ] selectedLayout (number 1-9 for layout bar)

### ❌ Chat Overlay State (NEED)
- [ ] showChatOverlay
- [ ] chatOverlayPos { x, y }
- [ ] chatOverlaySize { width, height }
- [ ] isDragging
- [ ] isResizingOverlay
- [ ] dragOffset

### ❌ Settings Modal State (NEED)
- [ ] showSettings
- [ ] audioDevices
- [ ] videoDevices
- [ ] selectedAudioDevice
- [ ] selectedVideoDevice

### ❌ Drawer State (NEED)
- [ ] activeDrawer: 'destinations' | 'invite' | 'banners' | 'brand' | null

### ❌ Killer Features State (NEED)
- [ ] showClipManager
- [ ] showProducerMode
- [ ] captionsEnabled
- [ ] clipRecordingEnabled

### ❌ Caption Config (NEED)
- [ ] captionConfig object with position, fontSize, colors, etc.

### ✅ Layout Definitions (HAVE)
- [x] 9 layout configurations array

---

## UI Structure Line-by-Line

### Top Bar (60px height) - Line 490-532
**Reference**: Fully implemented ✓
**Current**: ❌ Incorrect height/styling

Required structure:
```tsx
<header style={{
  gridColumn: '1 / -1',
  height: '60px',
  backgroundColor: '#2d2d2d',
  borderColor: '#404040'
}}>
  <div className="flex items-center justify-between px-6">
    <div className="flex items-center gap-4">
      <h1 style={{ width: '140px' }}>Streamlick</h1>
      {/* LIVE indicator */}
    </div>
    <div className="flex items-center gap-3">
      <span>{broadcast?.title}</span>
      <button>Settings</button>
      <Button>Go Live / End Broadcast</Button>
    </div>
  </div>
</header>
```

**Checklist**:
- [ ] Fixed 60px height
- [ ] Logo section (140px width)
- [ ] LIVE indicator with pulsing animation
- [ ] Broadcast title display
- [ ] Settings button (CogIcon)
- [ ] Go Live / End Broadcast button
- [ ] Proper background (#2d2d2d)
- [ ] Border (#404040)

---

### Left Sidebar - Scenes Panel (280px) - Lines 534-596
**Reference**: Fully implemented ✓
**Current**: ❌ Missing

Required structure:
```tsx
{leftSidebarOpen && (
  <aside style={{
    width: '280px',
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0'
  }}>
    <div style={{ height: '56px' }}>
      <h3>Scenes</h3>
      <button onClick={() => setLeftSidebarOpen(false)}>
        <XMarkIcon />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* Intro Video button (80px) */}
      {/* Scene card (180px height) */}
      {/* New Scene button (64px) */}
      {/* Outro Video button (80px) */}
    </div>
  </aside>
)}
```

**Checklist**:
- [ ] 280px fixed width
- [ ] Light background (#f5f5f5)
- [ ] Collapsible with state
- [ ] Scene header (56px)
- [ ] Intro video placeholder (80px)
- [ ] Scene cards (180px each)
  - [ ] Live video preview
  - [ ] Scene name
- [ ] New scene button (64px)
- [ ] Outro video placeholder (80px)

---

### Main Canvas Area - Lines 599-773
**Reference**: Fully implemented ✓
**Current**: ❌ Incorrect sizing/structure

Required structure:
```tsx
<main style={{ backgroundColor: '#1a1a1a' }}>
  {/* Canvas Container - 16:9 */}
  <div className="flex-1 flex items-center justify-center p-6">
    <div style={{
      width: '100%',
      maxWidth: '1920px',
      aspectRatio: '16 / 9',
      backgroundColor: '#000000'
    }}>
      {/* Video preview */}
      {/* Resolution badge */}
      {/* Chat overlay */}
      {/* Caption overlay */}
      {/* User label overlay */}
    </div>
  </div>

  {/* Layout Bar - 72px */}
  <div style={{
    height: '72px',
    backgroundColor: '#2d2d2d'
  }}>
    {/* 9 layout buttons (56px × 56px) */}
  </div>

  {/* Bottom Control Bar - 80px */}
  <div style={{
    height: '80px',
    backgroundColor: '#2d2d2d'
  }}>
    {/* Left: Destinations, Banners, Brand, Killer Features */}
    {/* Center: Mic, Speaker, Camera, Screen Share */}
    {/* Right: Producer Mode, Invite, Settings */}
  </div>
</main>
```

**Checklist**:
- [ ] Canvas 16:9 aspect ratio
- [ ] Max width 1920px
- [ ] Centered in container
- [ ] Black background (#000000)
- [ ] Resolution badge (centered top)
- [ ] Draggable chat overlay
- [ ] Resizable chat overlay
- [ ] Caption overlay
- [ ] User label overlay

#### Layout Bar (72px)
- [ ] Fixed 72px height
- [ ] Background #2d2d2d
- [ ] Border top #404040
- [ ] 9 layout buttons
  - [ ] 56px × 56px each
  - [ ] Custom icon rendering
  - [ ] Selected state (#0066ff)
  - [ ] Tooltips
- [ ] Layout types:
  - [ ] 1. Single Speaker
  - [ ] 2. Side by Side
  - [ ] 3. Picture in Picture
  - [ ] 4. Grid 2×2
  - [ ] 5. Grid 3×3
  - [ ] 6. Main + Strip
  - [ ] 7. Interview
  - [ ] 8. Panel
  - [ ] 9. Screen Share

#### Bottom Control Bar (80px) - Lines 776-898
- [ ] Fixed 80px height
- [ ] Background #2d2d2d
- [ ] Border top #404040
- [ ] **Left Section:**
  - [ ] Destinations button
  - [ ] Banners button
  - [ ] Brand button
  - [ ] Vertical separator
  - [ ] **Killer Features:**
    - [ ] AI Captions (SparklesIcon)
    - [ ] Clip Recording (FilmIcon)
    - [ ] Clip Manager (DevicePhoneMobileIcon)
- [ ] **Center Section:**
  - [ ] Microphone toggle (large, rounded)
  - [ ] Speaker control
  - [ ] Camera toggle (large, rounded)
  - [ ] Screen share toggle
  - [ ] Red background when disabled
- [ ] **Right Section:**
  - [ ] Producer Mode button (purple, prominent)
  - [ ] Invite Guests button (green, large)
  - [ ] Settings button

---

### Right Sidebar - Tabbed Panels (320px) - Lines 901-1036
**Reference**: Fully implemented ✓
**Current**: ❌ Missing tabs

Required structure:
```tsx
{rightSidebarOpen && (
  <aside style={{
    width: '320px',
    backgroundColor: '#ffffff',
    borderColor: '#e0e0e0',
    zIndex: 800
  }}>
    {/* Tab Headers */}
    <div className="border-b flex overflow-x-auto">
      <button onClick={() => setActiveRightTab('comments')}>
        Comments
      </button>
      <button onClick={() => setActiveRightTab('banners')}>
        Banners
      </button>
      {/* ... 6 more tabs */}
      <button onClick={() => setRightSidebarOpen(false)}>
        <XMarkIcon />
      </button>
    </div>

    {/* Tab Content */}
    <div className="flex-1 overflow-y-auto">
      {activeRightTab === 'comments' && <CommentsPanel />}
      {activeRightTab === 'banners' && <div>...</div>}
      {/* ... */}
    </div>
  </aside>
)}
```

**Checklist**:
- [ ] 320px fixed width
- [ ] White background (#ffffff)
- [ ] Light border (#e0e0e0)
- [ ] Z-index 800
- [ ] Collapsible with state
- [ ] **8 Tabs:**
  1. [ ] Comments - `<CommentsPanel />`
  2. [ ] Banners - Placeholder
  3. [ ] Media - `<MediaAssetsPanel />`
  4. [ ] Style - `<StylePanel />`
  5. [ ] Notes - `<NotesPanel />`
  6. [ ] People - `<ParticipantsPanel />`
  7. [ ] Chat - `<PrivateChatPanel />`
  8. [ ] Recording - `<RecordingControls />`
- [ ] Tab headers with active state
- [ ] Close button in tab bar
- [ ] Overflow scrolling content area

---

### Settings Modal - Lines 1068-1172
**Checklist**:
- [ ] Large centered modal
- [ ] Video device selection
- [ ] Audio device selection
- [ ] Chat overlay toggle
- [ ] Device enumeration
- [ ] Live preview (optional)
- [ ] Done button to close

---

### Drawer Panels - Lines 1174-1209
**Checklist**:
- [ ] Destinations drawer (large)
  - [ ] `<DestinationsPanel />`
- [ ] Invite drawer (medium)
  - [ ] `<InviteGuestsPanel />`
- [ ] Banners drawer (large)
  - [ ] `<BannerEditorPanel />`
- [ ] Brand drawer (large)
  - [ ] `<BrandSettingsPanel />`

---

### Killer Feature Modals - Lines 1211-1223
**Checklist**:
- [ ] Clip Manager modal
  - [ ] `<ClipManager broadcastId={broadcastId} />`
  - [ ] Close button
- [ ] Producer Mode modal
  - [ ] `<ProducerMode broadcastId={broadcastId} producerId="..." />`
  - [ ] Close button

---

### Toggle Buttons (When Sidebars Collapsed) - Lines 1039-1065
**Checklist**:
- [ ] Left sidebar toggle (Bars3Icon)
  - [ ] Fixed position left side
  - [ ] Shows when leftSidebarOpen = false
- [ ] Right sidebar toggle (ChatBubbleLeftIcon)
  - [ ] Fixed position right side
  - [ ] Shows when rightSidebarOpen = false

---

## Handler Functions

### ❌ MISSING Event Handlers
- [ ] `handleChatOverlayDragStart(e)`
- [ ] `handleChatOverlayResizeStart(e)`
- [ ] `loadDevices()`
- [ ] `handleAudioDeviceChange(deviceId)`
- [ ] `handleVideoDeviceChange(deviceId)`
- [ ] `openSettings()`
- [ ] `toggleCaptions()`
- [ ] `toggleClipRecording()`
- [ ] `renderLayoutIcon(iconType)` - Returns JSX for each layout

---

## Missing Components (Need to Create)

### Panel Components
- [ ] `StylePanel.tsx` - Brand color, theme, camera frame customization
- [ ] `NotesPanel.tsx` - Rich text editor, teleprompter mode
- [ ] `MediaAssetsPanel.tsx` - Brand selector, presets, music tracks
- [ ] `PrivateChatPanel.tsx` - Real-time host/guest messaging
- [ ] `CommentsPanel.tsx` - Platform comments aggregation

### Feature Components
- [ ] `ClipManager.tsx` - Clip list, preview, download
- [ ] `ProducerMode.tsx` - Full producer dashboard

---

## CSS Grid Layout (Root Container)

**Reference**: Lines 479-489

```tsx
<div className="h-screen w-screen overflow-hidden grid" style={{
  gridTemplateRows: '60px 1fr',
  gridTemplateColumns: leftSidebarOpen && rightSidebarOpen
    ? '280px 1fr 320px'
    : leftSidebarOpen
    ? '280px 1fr 0px'
    : rightSidebarOpen
    ? '0px 1fr 320px'
    : '0px 1fr 0px',
  backgroundColor: '#1a1a1a'
}}>
```

**Checklist**:
- [ ] Full screen (h-screen w-screen)
- [ ] CSS Grid layout
- [ ] Row template: 60px | 1fr
- [ ] Column template: 280px | 1fr | 320px (responsive)
- [ ] Background #1a1a1a
- [ ] Overflow hidden

---

## Color Palette Compliance

**Checklist**:
- [ ] Primary background: #1a1a1a ✓
- [ ] Secondary background: #2d2d2d ✓
- [ ] Tertiary background: #3d3d3d ✓
- [ ] Light sidebar: #f5f5f5, #ffffff ✓
- [ ] Dark borders: #404040 ✓
- [ ] Light borders: #e0e0e0 ✓
- [ ] Primary action: #0066ff ✓
- [ ] Success: #10b981
- [ ] Danger: #ef4444
- [ ] Warning: #f59e0b

---

## Summary

### Components to Import: 7
- StylePanel, NotesPanel, MediaAssetsPanel, PrivateChatPanel
- CommentsPanel, ClipManager, ProducerMode

### State Variables to Add: ~20
- Sidebar states, tab state, layout state, overlay states
- Settings modal states, drawer states, killer feature states

### UI Sections to Rebuild: 7
1. Top bar (60px)
2. Left sidebar (280px) with scenes
3. Right sidebar (320px) with 8 tabs
4. Canvas area (16:9, max 1920px)
5. Layout bar (72px)
6. Bottom control bar (80px)
7. Toggle buttons for collapsed sidebars

### Missing Icons to Add: 3
- FilmIcon, SparklesIcon, DevicePhoneMobileIcon

### Total Estimated Changes: ~600 lines to add/modify

---

**Next Step**: Copy the complete Studio.tsx from `claude/allow-streamlick-host-011CUv8jPoqiWGPCPUQuj6Ur` branch and merge with current WebRTC functionality.
