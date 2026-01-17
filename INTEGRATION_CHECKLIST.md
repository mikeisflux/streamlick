# Streamlick Integration Checklist

## Architecture Difference (CRITICAL)

| Source Branch | Our Branch (Control Panel) |
|---------------|---------------------------|
| Host streams to Ant Media SFU | Host does NOT stream |
| StudioCanvas renders composite locally | Receives composite from Ant Media compositor |
| Canvas exports MediaStream to destinations | Server-side compositor handles output |
| Client does audio mixing | Server handles audio |
| Host sees their own rendered output | Host sees server composite preview |

**Key Principle**: Our Studio is a **CONTROL PANEL** - it sends commands to the server/compositor, and receives a preview stream. It does NOT render or broadcast anything.

---

## PHASE 1: STUDIO UI REDESIGN

### 1.1 Studio Layout Structure
- [ ] **Header Bar** - Recreate header with:
  - [ ] Back to dashboard button
  - [ ] Broadcast title (editable)
  - [ ] Live/Recording status indicators
  - [ ] Go Live / End Broadcast buttons
  - [ ] Settings gear button

### 1.2 Preview Area (Main Canvas View)
- [ ] **CompositePreview Component** - Shows server-rendered composite
  - [ ] Subscribe to Ant Media composite stream
  - [ ] Full-screen toggle
  - [ ] Picture-in-picture mode
  - [ ] Shows "Waiting for composite..." when not connected

### 1.3 Backstage/Greenroom Preview Strip
- [ ] **PreviewArea Component** (horizontal strip below main preview)
  - [ ] "Your Preview" tile - host's local camera (for self-monitoring only)
  - [ ] Screen share preview tile (if sharing)
  - [ ] Backstage participants - guests not on stage
  - [ ] Greenroom participants - guests waiting
  - [ ] "Invite Guests" button tile
  - [ ] Drag-to-reorder functionality
  - [ ] Hover actions: "Add to Stage" / "Remove from Stage"
  - [ ] Kick/Ban context menu on participants

### 1.4 Bottom Control Bar
- [ ] **Left Section - Broadcast Controls**
  - [ ] Layout selector dropdown (grid, spotlight, side-by-side, etc.)
  - [ ] Branding/Style button (opens right panel)
  - [ ] Overlays button (banners, lower thirds)

- [ ] **Center Section - Media Controls**
  - [ ] Microphone toggle + device dropdown
  - [ ] Camera toggle + device dropdown
  - [ ] Speaker/audio output toggle + dropdown
  - [ ] Screen share button + settings

- [ ] **Right Section - Feature Toggles**
  - [ ] Recording on/off
  - [ ] Chat overlay toggle
  - [ ] Viewer count display

### 1.5 Right Sidebar (Tabbed Panels)
- [ ] **Tab Button Bar** (vertical, 64px wide)
  - [ ] Comments tab
  - [ ] Banners tab
  - [ ] Style tab
  - [ ] Notes tab
  - [ ] People tab
  - [ ] Private Chat tab
  - [ ] Recording tab

- [ ] **Panel Content** (slides in, 320px wide)
  - [ ] Comments Panel - show platform comments
  - [ ] Banners Panel - create/edit lower thirds & banners
  - [ ] Style Panel - colors, backgrounds, branding
  - [ ] Notes Panel - host notes/teleprompter
  - [ ] People Panel - participant list with controls
  - [ ] Private Chat Panel - 1-on-1 messaging
  - [ ] Recording Panel - recording settings

### 1.6 Left Sidebar (Scenes - Optional)
- [ ] **Scene Manager**
  - [ ] Scene list with previews
  - [ ] Create/duplicate/delete scenes
  - [ ] Switch between scenes
  - [ ] Save current layout as scene

---

## PHASE 2: DASHBOARD ENHANCEMENT

### 2.1 Dashboard Layout
- [ ] **Sidebar Navigation**
  - [ ] Logo/branding
  - [ ] Home (broadcasts)
  - [ ] Library (recordings)
  - [ ] Destinations
  - [ ] Members (if team features)
  - [ ] Analytics
  - [ ] Settings
  - [ ] Logout

### 2.2 Main Content
- [ ] **Create Section** (3 large buttons)
  - [ ] "Live Stream" - opens create modal
  - [ ] "Recording" - recording-only mode
  - [ ] "Webinar" - scheduled event mode

- [ ] **Studios List**
  - [ ] Table/grid view toggle
  - [ ] Columns: Name, Status, Created, Participants, Actions
  - [ ] Status badges: Live (red), Greenroom (yellow), Idle (gray), Ended
  - [ ] Actions: Enter Studio, Copy Invite Link, Edit, Delete

- [ ] **Create Modal**
  - [ ] Title input
  - [ ] Destination selection
  - [ ] Reusable studio toggle
  - [ ] Recording options

---

## PHASE 3: ADMIN SECTION

### 3.1 Admin Hub (/admin)
- [ ] **Stats Dashboard**
  - [ ] Active broadcasts count
  - [ ] Total users count
  - [ ] System status

- [ ] **Admin Cards Grid**
  - [ ] Settings
  - [ ] Users
  - [ ] Broadcasts
  - [ ] Destinations
  - [ ] Logs (if implemented)

### 3.2 Admin Settings (/admin/settings)
- [ ] **System Configuration Tab**
  - [ ] JWT secret
  - [ ] Database connection
  - [ ] Redis URL
  - [ ] Ant Media URL and app name

- [ ] **Branding Tab**
  - [ ] Platform name
  - [ ] Logo upload
  - [ ] Primary/secondary colors
  - [ ] Favicon

### 3.3 Admin Users (/admin/users)
- [ ] User list with search
- [ ] Create new user
- [ ] Edit user roles (Admin/User)
- [ ] Delete/disable users

### 3.4 Admin Broadcasts (/admin/broadcasts)
- [ ] List all broadcasts across users
- [ ] Filter by status
- [ ] Force end broadcast
- [ ] View broadcast details

---

## PHASE 4: SOCKET EVENTS FOR CONTROL PANEL

### 4.1 Events to Emit (Control Commands)
```typescript
// Layout control
socket.emit('layout-change', { broadcastId, layout });

// Participant control
socket.emit('bring-on-stage', { participantId });
socket.emit('remove-from-stage', { participantId });
socket.emit('mute-participant', { participantId, audioEnabled: boolean });
socket.emit('kick-participant', { participantId });

// Broadcast control
socket.emit('go-live');
socket.emit('end-broadcast');
socket.emit('start-recording');
socket.emit('stop-recording');

// Overlay control (if implemented server-side)
socket.emit('show-banner', { text, style });
socket.emit('hide-banner');
socket.emit('show-lower-third', { name, title });
socket.emit('hide-lower-third');
```

### 4.2 Events to Listen (State Updates)
```typescript
socket.on('broadcast-state', (state) => { /* full state update */ });
socket.on('participant-joined', (participant) => { /* new participant */ });
socket.on('participant-left', ({ participantId }) => { /* remove */ });
socket.on('participant-updated', (participant) => { /* audio/video/stage change */ });
socket.on('layout-changed', ({ layout }) => { /* layout updated */ });
socket.on('broadcast-live', () => { /* went live */ });
socket.on('broadcast-ended', () => { /* ended */ });
socket.on('composite-ready', ({ streamId }) => { /* subscribe to this */ });
```

---

## PHASE 5: COMPONENTS TO CREATE

### New Components Needed
```
frontend/src/components/
├── studio/
│   ├── StudioHeader.tsx           # Top bar with title, live button
│   ├── CompositePreview.tsx       # Main preview (subscribes to server composite)
│   ├── PreviewStrip.tsx           # Backstage/greenroom preview tiles
│   ├── PreviewTile.tsx            # Individual participant tile
│   ├── BottomControlBar.tsx       # Media controls + features
│   ├── LayoutSelector.tsx         # Layout dropdown
│   ├── DeviceSelector.tsx         # Camera/mic/speaker dropdowns
│   ├── RightSidebar.tsx           # Tabbed sidebar container
│   └── panels/
│       ├── PeoplePanel.tsx        # Participant list
│       ├── CommentsPanel.tsx      # Comments from platforms
│       ├── StylePanel.tsx         # Branding/colors
│       ├── BannersPanel.tsx       # Lower thirds/banners
│       ├── NotesPanel.tsx         # Host notes
│       └── PrivateChatPanel.tsx   # DMs to participants
│
├── dashboard/
│   ├── DashboardSidebar.tsx       # Left navigation
│   ├── BroadcastCard.tsx          # Individual broadcast card
│   ├── CreateModal.tsx            # Create broadcast modal
│   └── StatusBadge.tsx            # Status indicator
│
└── admin/
    ├── AdminLayout.tsx            # Admin page wrapper
    ├── AdminCard.tsx              # Navigation card
    ├── SettingsForm.tsx           # Settings sections
    └── UserTable.tsx              # User management table
```

---

## PHASE 6: STYLING GUIDELINES

### Color Palette (from source)
```css
--dark-950: #0a0a0f;     /* Deepest background */
--dark-900: #111118;     /* Card backgrounds */
--dark-800: #1a1a24;     /* Borders, dividers */
--dark-700: #252532;     /* Hover states */
--dark-600: #32324a;     /* Inactive elements */
--dark-500: #4a4a6a;     /* Muted text */
--dark-400: #6b6b8a;     /* Secondary text */

--brand-600: #6366f1;    /* Primary brand (indigo) */
--brand-700: #4f46e5;    /* Brand hover */
--brand-500: #818cf8;    /* Brand light */

--red-600: #dc2626;      /* Danger/Live indicator */
--yellow-500: #eab308;   /* Warning/Greenroom */
--green-600: #16a34a;    /* Success/Active */
```

### Common Patterns
- Cards: `bg-dark-900 border border-dark-800 rounded-xl`
- Buttons Primary: `bg-brand-600 hover:bg-brand-700 rounded-lg`
- Buttons Secondary: `bg-dark-700 hover:bg-dark-600 rounded-lg`
- Inputs: `bg-dark-800 border border-dark-700 rounded-lg focus:border-brand-500`
- Icons: Use `lucide-react` consistently

---

## IMPLEMENTATION ORDER

1. **Week 1: Studio UI Foundation**
   - [ ] StudioHeader
   - [ ] CompositePreview (with Ant Media subscription)
   - [ ] BottomControlBar (basic media controls)
   - [ ] PreviewStrip (participant tiles)

2. **Week 2: Studio Panels**
   - [ ] RightSidebar structure
   - [ ] PeoplePanel
   - [ ] StylePanel
   - [ ] LayoutSelector

3. **Week 3: Dashboard Enhancement**
   - [ ] DashboardSidebar
   - [ ] Enhanced broadcast cards
   - [ ] CreateModal improvements

4. **Week 4: Admin Section**
   - [ ] Admin hub page
   - [ ] Admin settings
   - [ ] Admin users

---

## QUESTIONS TO RESOLVE

1. **Overlay Control**: Should overlays (banners, lower thirds) be controlled from:
   - [ ] The control panel (sends commands to server compositor)
   - [ ] The compositor HTML directly

2. **Chat Integration**: Do we need live platform chat integration (YouTube, Twitch, etc.)?
   - [ ] Yes - need backend routes for each platform
   - [ ] No - just private chat between participants

3. **Recording**: Where does recording happen?
   - [ ] Server-side (Ant Media recording)
   - [ ] Client-side (no local recording needed in control panel mode)

4. **Scene Management**: Do we need scene switching?
   - [ ] Yes - save/load different layouts
   - [ ] No - just use live layout switching

---

## NOTES

- **DO NOT COPY** files wholesale - integrate functionality piece by piece
- **Adapt to control panel model** - we don't render, we control
- **Keep socket events** as the primary control mechanism
- **Server compositor** handles all video mixing and RTMP output
- **Host preview** is just for monitoring, not for production
