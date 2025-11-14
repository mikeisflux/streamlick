# Main Canvas Layout Implementation Checklist

Based on: `main-canvas-layout-guide.md` - Sections 1-12, 14-16

## Overall Screen Layout (2560×1400px)

### Viewport Structure
- [ ] **Total screen dimensions:** 2560px × 1400px
- [ ] **Top Navigation Bar:** 60px height (full width)
- [ ] **Bottom Control Bar:** 80px height (full width)
- [ ] **Right Sidebar:** 80px width (from top bar to bottom bar)
- [ ] **Workspace Area:** 2480px width × 1260px height

### Current Implementation Status
- [x] Basic layout structure exists
- [ ] Exact measurements need verification
- [ ] Z-index hierarchy needs review

---

## Workspace Area (Light Background)

### Dimensions & Position
- [ ] **Width:** 2480px (full width minus 80px right sidebar)
- [ ] **Height:** 1260px (viewport minus 60px top bar minus 80px bottom bar)
- [ ] **Background Color:** #F5F5F5 or #FAFAFA (light gray)
- [ ] **Position:**
  - Top: 60px (below top bar)
  - Left: 0px
  - Right: 2480px (before sidebar)
  - Bottom: 1320px (above bottom bar)

### Current Status
- [x] Workspace area exists
- [ ] Background color verification (#1a1a1a currently, should be #F5F5F5)
- [ ] Exact dimensions need verification

---

## Main Canvas (Black Stage Area)

### Canvas Specifications
- [x] **Aspect Ratio:** 16:9 (CRITICAL - must always maintain)
- [x] **Background Color:** #0F1419 (very dark blue/black) ✅ CORRECT
- [ ] **Approximate Width:** ~1880px
- [ ] **Approximate Height:** ~920px (maintains 16:9 from width)
- [ ] **Max Width:** 1920px
- [ ] **Centering:** Horizontally and vertically in workspace

### Canvas Positioning
- [ ] **Left margin:** ~255px from screen edge
- [ ] **Top margin:** ~130px from screen edge (~70px from workspace top)
- [ ] **Right margin:** ~345px to sidebar start
- [ ] **Variable top/bottom padding** to maintain 16:9

### Edit Mode Border
- [x] **Border when in edit mode:** 4px solid #8B5CF6 (purple) ✅ IMPLEMENTED
- [x] **Border radius:** 8px ✅ IMPLIED by rounded
- [x] **Box-sizing:** border-box ✅ IMPLEMENTED

### Current Status
- [x] Canvas aspect ratio maintained (16:9)
- [x] Background color correct (#0F1419)
- [x] Edit mode purple border implemented
- [ ] Exact positioning and margins need verification
- [ ] Max-width constraint (1920px) needs verification

---

## Resolution Badge

### Specifications
- [x] **Position:** Inside canvas, top-left corner
- [x] **Offset from canvas edges:** 16px from left, 16px from top ✅ IMPLEMENTED
- [x] **Size:** 60px × 32px ✅ IMPLEMENTED
- [x] **Background:** rgba(0, 0, 0, 0.7) ✅ IMPLEMENTED
- [x] **Border radius:** 4px ✅ IMPLEMENTED
- [x] **Text:** "1080p" ✅ IMPLEMENTED
- [x] **Text color:** #FFFFFF (white) ✅ IMPLEMENTED
- [x] **Font size:** 14px (text-sm)
- [x] **Font weight:** 600 (semibold)

### Visibility
- [x] **Hide when screen sharing** ✅ IMPLEMENTED

### Current Status
- [x] ✅ FULLY IMPLEMENTED AND CORRECT

---

## Layout Selector Bar

### Position & Dimensions
- [ ] **Position:** BELOW the black canvas, centered horizontally
- [ ] **Top offset:** 8-12px below canvas bottom edge
- [ ] **Width:** ~650px (fits 9 layouts + 3 control buttons + divider)
- [ ] **Height:** 72px (specified in code) vs 56px (spec) ⚠️ DISCREPANCY
- [ ] **Background:** #2d2d2d (currently) vs rgba(255,255,255,0.95) (spec) ⚠️ DISCREPANCY
- [ ] **Border radius:** 8px
- [ ] **Shadow:** 0 2px 8px rgba(0,0,0,0.1)
- [ ] **Center x:** ~1280px (screen center)

### Layout Buttons (9 options)
- [x] **Button count:** 9 layout option buttons ✅ IMPLEMENTED
- [x] **Button size:** 56px × 56px ✅ IMPLEMENTED
- [x] **Active color:** #0066ff (blue) ✅ IMPLEMENTED
- [x] **Inactive color:** #3d3d3d ✅ IMPLEMENTED
- [x] **Gap between buttons:** Minimal spacing
- [x] **Icons:** Custom SVG for each layout ✅ IMPLEMENTED

### Control Buttons (3 buttons)
- [x] **Divider:** Vertical line separator ✅ IMPLEMENTED
- [x] **Edit button:** Pencil icon, purple when active ✅ IMPLEMENTED
- [x] **Add button:** Plus icon ✅ IMPLEMENTED
- [x] **Settings button:** Gear icon ✅ IMPLEMENTED
- [x] **Button size:** 56px × 56px ✅ IMPLEMENTED

### Current Status
- [x] All 9 layout buttons implemented
- [x] All 3 control buttons implemented
- [ ] ⚠️ Height mismatch (72px vs 56px spec)
- [ ] ⚠️ Background color mismatch (#2d2d2d vs rgba(255,255,255,0.95))
- [ ] ⚠️ Position needs verification (should be below canvas, not at bottom)
- [ ] ⚠️ Border color mismatch (#404040 vs spec)

---

## Participant Preview Tiles (Bottom Left)

### Specifications
- [ ] **Position:** Bottom left of workspace, above bottom bar
- [ ] **Tile size:** ~175px width × 140px height (per tile)
- [ ] **Gap between tiles:** 8px

### Tile 1 - Local Preview ("You")
- [ ] **Left:** ~35px from screen edge
- [ ] **Top:** ~1150px from screen top
- [ ] **Width:** 175px
- [ ] **Height:** 140px
- [ ] **Border:** 2px border-blue-500 (blue border) ⚠️ CURRENT vs spec
- [ ] **Video preview:** Shows local camera feed
- [ ] **Controls:** Mic icon, menu icon
- [ ] **Name label:** "You (Preview)"
- [ ] **Background:** Black/dark when camera off

### Tile 2 - Present or Invite Button
- [ ] **Left:** ~220px from screen edge (8px gap from tile 1)
- [ ] **Top:** ~1150px from screen top
- [ ] **Width:** 175px
- [ ] **Height:** 140px
- [ ] **Icons:** Screen share (🖥️) + People (👥) icons
- [ ] **Label:** "Present or invite"
- [ ] **Background:** White/light gray (#FFFFFF or #F5F5F5)
- [ ] **Empty state text:** "Participants will appear here when they join"

### Current Implementation (PreviewArea.tsx)
- [x] Component exists
- [x] Shows local preview
- [x] Shows backstage participants
- [x] Screen share preview
- [ ] ⚠️ Position - currently in separate section, should be bottom-left overlay
- [ ] ⚠️ Styling doesn't match spec (black background vs white for invite tile)
- [ ] ⚠️ Missing "Present or invite" combined button

---

## Participant Tiles on Canvas

### Participant Box Component
- [x] **Position number badge:** 28px circle, top-left, blue background ✅ IMPLEMENTED
- [x] **Connection quality indicator:** 24px circle, top-right ✅ IMPLEMENTED
- [x] **Lower third name display:** 40px from bottom, 40px height ✅ IMPLEMENTED
- [x] **Mute indicator:** 32px circle, 52px from bottom, red ✅ IMPLEMENTED
- [x] **Camera off placeholder:** Gray background with icon ✅ IMPLEMENTED
- [x] **Video element:** Full width/height, object-cover ✅ IMPLEMENTED

### Sizes
- [x] **Small size:** Used in sidebar thumbnails ✅ IMPLEMENTED
- [x] **Medium size:** (Not currently used)
- [x] **Large size:** Used in main canvas ✅ IMPLEMENTED

### Current Status
- [x] ✅ ParticipantBox fully implemented per spec
- [x] ✅ All overlays positioned correctly
- [x] ✅ Connection quality colors implemented
- [x] ✅ Lower third styling correct

---

## Color Palette Verification

| Element | Current | Spec | Status |
|---------|---------|------|--------|
| Canvas Background | #0F1419 | #0F1419 | ✅ CORRECT |
| Edit Mode Border | #8B5CF6 | #8B5CF6 | ✅ CORRECT |
| Resolution Badge BG | rgba(0,0,0,0.7) | rgba(0,0,0,0.7) | ✅ CORRECT |
| Resolution Badge Text | #FFFFFF | #FFFFFF | ✅ CORRECT |
| Layout Bar BG | #2d2d2d | rgba(255,255,255,0.95) | ❌ WRONG |
| Layout Bar Border | #404040 | - | ⚠️ NOT IN SPEC |
| Workspace BG | #1a1a1a | #F5F5F5 or #FAFAFA | ❌ WRONG |
| Active Layout Button | #0066ff | #0066ff | ✅ CORRECT |
| Inactive Layout Button | #3d3d3d | #3d3d3d | ✅ CORRECT |
| Position Badge | rgba(0,102,255,0.9) | rgba(0,102,255,0.9) | ✅ CORRECT |

---

## Z-Index Hierarchy

### Spec Requirements
```
Layer 100: Top navigation bar (always on top)
Layer 90:  Bottom control bar (always visible)
Layer 80:  Right sidebar (vertical icon tabs)
Layer 50:  Layout selector bar (floating below canvas)
Layer 40:  Participant preview tiles (bottom left)
Layer 30:  "Present or invite" tile
Layer 20:  Canvas editing controls (when in edit mode)
Layer 10:  Participant tiles inside canvas (people boxes)
Layer 5:   Resolution badge (1080p indicator)
Layer 1:   Canvas background (dark)
Layer 0:   Workspace background (light gray)
```

### Current Implementation
- [ ] Top nav: z-index 1000 (should be 100)
- [ ] Right sidebar button bar: z-index 900 (should be 80)
- [ ] Bottom control bar: z-index 700 (should be 90)
- [ ] Layout selector: Not specified (should be 50)
- [ ] Preview tiles: Not specified (should be 40)
- [ ] Canvas items: z-index 10 used for overlays
- [ ] Resolution badge: z-index not specified (should be 5)

### Status
- [ ] ⚠️ Z-index values need adjustment to match spec

---

## Responsive Behavior

### Canvas Scaling
- [x] **16:9 aspect ratio maintained** ✅ IMPLEMENTED
- [ ] **Minimum canvas width:** 800px
- [ ] **Minimum canvas height:** 450px
- [ ] **Max-width:** 1920px
- [ ] **Below minimum:** Scroll bars appear
- [ ] **Content rescaling:** Proportional when window resizes

### Current Status
- [x] Aspect ratio maintained
- [ ] Min/max constraints need verification
- [ ] Scroll behavior needs testing

---

## Layout Editor / Edit Mode

### Activating Edit Mode
- [x] **Edit button:** In layout selector, pencil icon ✅ IMPLEMENTED
- [x] **Active state:** Blue (#1E88E5) currently purple (#8B5CF6) ⚠️ DISCREPANCY
- [x] **Canvas border:** 4px solid purple when active ✅ IMPLEMENTED
- [ ] **Bottom buttons appear:** [⊕ Add item ▼] [↶ Undo] [↷ Redo] at bottom-left
- [ ] **Bottom right buttons:** [Cancel] [Save] buttons
- [ ] **Button positions:**
  - Left buttons at x: ~260px, y: ~1290px
  - Right buttons at x: ~2080px, y: ~1290px

### Draggable Items
- [ ] **Blue selection border** when selected
- [ ] **Resize handles** on corners: □ corners
- [ ] **Layer number badge** (top-left): "1", "2", etc.
- [ ] **Entire item draggable**

### Item Control Toolbar (Above Selected Item)
- [ ] **Toolbar appears** above selected item
- [ ] **Background:** White with shadow
- [ ] **Height:** 48px
- [ ] **Buttons (left to right):**
  1. [ ] ↕ Move layer forward (Ctrl+])
  2. [ ] ↕ Move layer back (Ctrl+[)
  3. [ ] [▭▼] Fit/Fill dropdown (Fit/Fill options)
  4. [ ] [🔷▼] Shape dropdown (Rectangle/Circle/Square)
  5. [ ] [📐▼] Border dropdown (Straight/Rounded)
  6. [ ] 📋 Duplicate (Ctrl+D)
  7. [ ] 🗑 Delete (Del) - red when hovered

### Add Item Menu
- [ ] **Triggered by:** [⊕ Add item ▼] button
- [ ] **Dropdown width:** ~300px
- [ ] **Options:**
  1. [ ] 👥 Dynamic camera grid (recommended) - max 1 per layout
  2. [ ] 📹 Camera Slot - single participant
  3. [ ] ⊞ Media Slot - screen shares/slides, max 1 per layout

### Save Layout Modal
- [ ] **Save button** triggers modal
- [ ] **Layout name input** with icon selector
- [ ] **Two options:**
  - [ ] "Update layout" button
  - [ ] "Save as new layout" button
- [ ] **Modal size:** ~500px width
- [ ] **Close X button**

### Discard Changes Modal
- [ ] **Cancel button** triggers modal
- [ ] **Warning message:** "Discard changes?"
- [ ] **Description:** "Your changes will be lost."
- [ ] **Buttons:**
  - [ ] "Keep editing" (gray)
  - [ ] "Discard" (red)

### Current Status
- [x] Edit mode toggle works
- [x] Purple border appears
- [ ] ❌ Add item, undo, redo, cancel, save buttons NOT implemented
- [ ] ❌ Draggable items NOT implemented
- [ ] ❌ Item control toolbar NOT implemented
- [ ] ❌ Add item menu NOT implemented
- [ ] ❌ Save layout modal NOT implemented
- [ ] ❌ Discard changes modal NOT implemented

---

## Button Locations & Functions

### Top Bar Buttons (Right Side)
- [ ] **Edit button:** Pencil icon + text, ~80px wide, x: ~2220px
- [ ] **Profile dropdown:** Avatar + name + chevron, ~120px wide, x: ~2310px
- [ ] **Go live button:** Blue (#1E88E5), ~100px wide, x: ~2440px

### Participant Tile Behaviors
- [ ] **Click tile:** Selects participant
- [ ] **Drag tile:** Reorder in preview area
- [ ] **Right-click menu:**
  - [ ] Add to stage
  - [ ] Remove from stage
  - [ ] Mute/Unmute
  - [ ] Disable/Enable camera
  - [ ] Kick
  - [ ] Ban

### Window Controls
- [ ] **Minimize button**
- [ ] **Maximize/Restore button**
- [ ] **Close button**

### Current Status
- [ ] Top bar buttons need to be verified/implemented
- [ ] Participant drag-and-drop NOT implemented
- [ ] Right-click menus NOT implemented

---

## Key Measurements Reference

| Measurement | Value | Status |
|-------------|-------|--------|
| Screen dimensions | 2560×1400px | ✅ Reference |
| Top bar height | 60px | ✅ Exists |
| Bottom bar height | 80px | ✅ Exists |
| Right sidebar width | 80px (spec) vs 64px (current) | ⚠️ WRONG |
| Workspace width | 2480px | ⚠️ Need verify |
| Workspace height | 1260px | ⚠️ Need verify |
| Canvas width | ~1880px | ⚠️ Need verify |
| Canvas height | ~920px | ⚠️ Need verify |
| Canvas aspect ratio | 16:9 | ✅ CORRECT |
| Layout selector height | 72px (current) vs 56px (spec) | ⚠️ WRONG |
| Layout selector width | ~650px | ⚠️ Need verify |
| Gap canvas to layouts | 8-12px | ⚠️ Need verify |
| Participant tile size | 175×140px (spec) vs 160×90px (current) | ⚠️ WRONG |
| Tile spacing | 8px | ⚠️ Need verify |
| Edit mode border | 4px purple | ✅ CORRECT |
| Resolution badge | 60×32px | ✅ CORRECT |

---

## Critical Issues Summary

### 🔴 HIGH PRIORITY (Visual/Layout Issues):
1. **Workspace background:** Currently #1a1a1a, should be #F5F5F5 (light gray)
2. **Layout selector background:** Currently #2d2d2d, should be rgba(255,255,255,0.95) (almost white)
3. **Right sidebar width:** Currently 64px, should be 80px
4. **Layout selector position:** Currently at bottom, should be BELOW canvas (floating)
5. **Preview tiles position:** Currently separate section, should be bottom-left overlay

### 🟡 MEDIUM PRIORITY (Measurements):
6. **Layout selector height:** 72px vs 56px spec
7. **Participant tile size:** 160×90px vs 175×140px spec
8. **Canvas margins/positioning:** Need exact verification
9. **Z-index hierarchy:** Values don't match spec (100, 90, 80, 50, etc.)

### 🟢 LOW PRIORITY (Missing Features):
10. **Edit mode controls:** Add item, undo, redo, cancel, save buttons
11. **Draggable items system:** Not implemented
12. **Item control toolbar:** Not implemented
13. **Add item menu:** Not implemented
14. **Save/Discard modals:** Not implemented
15. **Participant drag-and-drop:** Not implemented
16. **Right-click menus:** Not implemented

---

## Overall Completion Status

### ✅ WORKING CORRECTLY:
- Canvas aspect ratio (16:9)
- Canvas background color (#0F1419)
- Edit mode purple border
- Resolution badge (position, size, styling)
- ParticipantBox component (overlays, styling)
- Layout button functionality
- Control buttons (edit, add, settings)

### ⚠️ NEEDS FIXES:
- Workspace background color
- Layout selector styling and position
- Right sidebar width
- Preview tiles position and styling
- Z-index values throughout
- Exact measurements verification

### ❌ NOT IMPLEMENTED:
- Complete edit mode system (draggable items, toolbar, menus)
- Save/discard layout modals
- Participant tile behaviors (drag, right-click)
- Undo/redo functionality
- Add item menu with options

### 📊 OVERALL COMPLETION:
- **Basic Layout:** 85% ✅
- **Styling/Colors:** 60% ⚠️
- **Measurements:** 70% ⚠️
- **Edit Mode Features:** 15% ❌
- **Interactive Features:** 20% ❌
- **TOTAL:** ~50%

---

## Immediate Next Steps

1. **Fix workspace background** → #F5F5F5 instead of #1a1a1a
2. **Fix layout selector styling** → White background, position below canvas
3. **Fix right sidebar width** → 80px instead of 64px
4. **Reposition preview tiles** → Bottom-left overlay, not separate section
5. **Adjust z-index values** → Match spec hierarchy (100, 90, 80, 50...)
6. **Verify canvas positioning** → Ensure proper centering and margins
7. **Update tile sizes** → 175×140px for preview tiles
8. **Implement edit mode controls** → Add buttons for save, cancel, add item, undo, redo
