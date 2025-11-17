# Studio.tsx Layout Audit - Current vs Specification

## Current Layout (INCORRECT)

```tsx
// Line 928-993: Header
<header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
```
❌ **Issue**: Uses `py-4` padding, not fixed 60px height

```tsx
// Line 997: Left Sidebar
<aside className="w-80 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
```
❌ **Issue**: `w-80` = 320px, should be 280px (w-70 doesn't exist, need custom)

```tsx
// Line 1357-1420: Main content
<main className="flex-1 p-6 overflow-hidden">
  <div className="h-full flex flex-col">
    <div className="flex-1 bg-black rounded-lg overflow-hidden p-4">
```
❌ **Issues**:
- No proper canvas sizing (16:9 aspect ratio)
- No max-width 1920px
- No layout bar (72px) below canvas
- No bottom control bar (80px)

```tsx
// Line 1423: Right Sidebar
<aside className="w-96 bg-gray-800 border-l border-gray-700 overflow-hidden">
```
❌ **Issue**: `w-96` = 384px, should be 320px (w-80)

```tsx
// Line 1383-1418: Controls (in main area)
<div className="mt-6 flex justify-center gap-4">
```
❌ **Issue**: Controls are in main area, should be in dedicated 80px bottom bar

## Required Layout (Per STUDIO_SPECIFICATIONS.md)

### Grid Structure
```tsx
<div className="h-screen w-screen overflow-hidden grid"
  style={{
    gridTemplateRows: '60px 1fr',
    gridTemplateColumns: '280px 1fr 320px',
    backgroundColor: '#1a1a1a'
  }}>
```

### Top Bar - 60px height
```tsx
<header style={{
  gridColumn: '1 / -1',
  height: '60px',
  backgroundColor: '#2d2d2d',
  borderColor: '#404040',
  zIndex: 1000
}}>
```

**Contents:**
- Left: Logo (140px width), LIVE indicator
- Right: Settings, Go Live/End Broadcast

### Left Sidebar - 280px width
```tsx
<aside style={{
  width: '280px',
  backgroundColor: '#f5f5f5',
  borderColor: '#e0e0e0'
}}>
```

**Contents:**
- Scenes panel
- Intro video button (80px height)
- Scene cards (180px height each)
- New scene button (64px)
- Outro video button (80px)

### Main Canvas Area
```tsx
<main style={{ backgroundColor: '#1a1a1a' }}>
  {/* Canvas Container - 16:9, max 1920px */}
  <div className="flex-1 flex items-center justify-center p-6">
    <div style={{
      width: '100%',
      maxWidth: '1920px',
      aspectRatio: '16 / 9'
    }}>
      {/* Video content */}
    </div>
  </div>

  {/* Layout Bar - 72px height */}
  <div style={{
    height: '72px',
    backgroundColor: '#2d2d2d',
    borderColor: '#404040'
  }}>
    {/* 9 layout buttons (56px × 56px each) */}
  </div>

  {/* Bottom Control Bar - 80px height */}
  <div style={{
    height: '80px',
    backgroundColor: '#2d2d2d',
    borderColor: '#404040'
  }}>
    {/* Left: Destinations, Banners, Brand, Killer Features */}
    {/* Center: Mic, Speaker, Camera, Screen Share */}
    {/* Right: Producer Mode, Invite, Settings */}
  </div>
</main>
```

### Right Sidebar - 320px width
```tsx
<aside style={{
  width: '320px',
  backgroundColor: '#ffffff',
  borderColor: '#e0e0e0',
  zIndex: 800
}}>
```

**Contents:**
- Tab headers with 8 tabs
- Tab content area (scrollable)

## Implementation Priority

1. ✅ Convert to CSS Grid layout with proper columns (280px | 1fr | 320px)
2. ✅ Fix top bar to 60px height
3. ✅ Fix left sidebar to 280px width
4. ✅ Fix right sidebar to 320px width
5. ✅ Add 16:9 canvas with max-width 1920px
6. ✅ Add layout bar (72px) with 9 layout buttons
7. ✅ Add bottom control bar (80px) with 3 sections
8. ✅ Move existing controls to bottom bar
9. ✅ Add right sidebar tabs
10. ✅ Add scenes panel to left sidebar

## Color Palette (Must Use)

- Primary background: `#1a1a1a`
- Secondary background: `#2d2d2d`
- Tertiary background: `#3d3d3d`
- Light sidebar: `#f5f5f5`, `#ffffff`
- Borders (dark): `#404040`
- Borders (light): `#e0e0e0`
- Primary action: `#0066ff`

## Current Component Usage

✅ Already have these panels:
- BannerEditorPanel
- BrandSettingsPanel
- CaptionOverlay
- ChatOverlay
- DestinationsPanel
- InviteGuestsPanel
- ParticipantsPanel
- RecordingControls
- SceneManager

❌ Missing:
- ProducerMode component
- StylePanel
- NotesPanel
- CommentsPanel
- MediaAssetsPanel

## Next Steps

1. Read current Studio.tsx completely
2. Create new layout structure with proper grid
3. Implement all sizing specifications
4. Test and verify all measurements
5. Commit changes
