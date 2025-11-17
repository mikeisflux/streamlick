# Producer Mode - User Guide

**Professional production control for multi-participant streams**

---

## Overview

Producer Mode transforms Streamlick into a professional broadcast control room. It's designed for technical producers, directors, and production teams who need advanced controls for managing multi-participant live streams, podcasts, and video productions.

**Perfect for:**
- 🎬 Professional video productions
- 🎙️ Multi-host podcast shows
- 📺 Live talk shows and panels
- 🎓 Webinars with multiple presenters
- 🎪 Virtual events and conferences
- 📡 Live broadcasts with backstage management

**Key Features:**
- ✅ Participant management (host, guest, backstage)
- ✅ Individual audio/video controls per person
- ✅ Scene layouts (grid, sidebar, spotlight)
- ✅ Multi-track recording (separate files per participant)
- ✅ Broadcast controls (start/stop streaming)
- ✅ Real-time participant status monitoring
- ✅ Backstage area (prepare guests before going live)

---

## Accessing Producer Mode

### Step 1: Start Your Stream

1. Open **Studio** page
2. Enable camera and microphone
3. Start your stream as usual

### Step 2: Enable Producer Mode

1. Look at the **top control bar** (right side)
2. Find the **"Producer Mode"** button
3. Click to open Producer Mode panel
4. Panel slides in from the right side

**Alternative Access:**
- Keyboard shortcut: `Ctrl/Cmd + P` (planned)
- Direct URL: `/studio?producer=true` (planned)

### Step 3: Producer Panel Overview

The Producer Mode panel contains several sections:

1. **Scene Layouts** (top)
2. **Participants Management** (middle)
3. **Multi-Track Recording** (bottom)
4. **Broadcast Controls** (bottom)

---

## Understanding the Interface

### Scene Layouts Section

**What are scenes?**
Scenes are different video layouts for displaying participants.

**Available Layouts:**

#### 1. Grid Layout (Default)
```
┌─────────┬─────────┐
│ Person1 │ Person2 │
├─────────┼─────────┤
│ Person3 │ Person4 │
└─────────┴─────────┘
```
- **Best for:** Panel discussions, roundtables
- **Participants:** 2-9 people
- **Equal size:** Everyone gets equal screen space
- **Auto-arrange:** Fills grid automatically

#### 2. Sidebar Layout
```
┌──────────────┬────┐
│              │ P2 │
│   Person 1   ├────┤
│   (Main)     │ P3 │
│              ├────┤
│              │ P4 │
└──────────────┴────┘
```
- **Best for:** Host + multiple guests
- **Main speaker:** Large on left
- **Others:** Small sidebar on right
- **Use case:** Interview shows, main presenter format

#### 3. Spotlight Layout
```
┌─────────────────────┐
│                     │
│     Main Speaker    │
│      (Full Size)    │
│                     │
└─────────────────────┘
```
- **Best for:** Single speaker presentations
- **One participant:** Full screen
- **Others:** Hidden or tiny thumbnails
- **Use case:** Keynotes, solo presentations

**Changing Layouts:**
1. Click layout button in Scene Layouts section
2. Video preview updates immediately
3. All participants re-arrange automatically

### Participants Section

**Participant Cards:**
Each participant has a card showing:

```
┌────────────────────────────────┐
│ 👤 Sarah Mitchell              │
│ 🟢 Connected | Guest           │
│ [🎤] [📹] [⬆️] [🗑️]          │
└────────────────────────────────┘
```

**Card Details:**
- **Name:** Participant display name
- **Status Indicator:**
  - 🟢 Green = Connected
  - 🟡 Yellow = Connecting
  - 🔴 Red = Disconnected
- **Role Badge:** Host, Guest, or Backstage
- **Control Buttons:**
  - 🎤 Audio toggle (mute/unmute)
  - 📹 Video toggle (hide/show)
  - ⬆️ Promote (backstage → live)
  - 🗑️ Remove participant

### Multi-Track Recording Section

**Recording Controls:**

**Before Recording:**
```
┌──────────────────────────────┐
│ 🎬 Multi-Track Recording     │
│ ☑️ Separate audio/video      │
│ [Start Multi-Track Rec] btn  │
└──────────────────────────────┘
```

**During Recording:**
```
┌──────────────────────────────┐
│ 🎬 Multi-Track Recording 🔴  │
│ Recording... ⏱️ 00:15:42     │
│ 6 tracks active              │
│ [Stop Recording] btn         │
└──────────────────────────────┘
```

**After Recording:**
```
┌──────────────────────────────┐
│ ✅ 6 tracks ready            │
│ 245.3 MB total               │
│ [Download All Tracks] btn    │
└──────────────────────────────┘
```

### Broadcast Controls Section

**Streaming Status:**

```
┌──────────────────────────────┐
│ 📡 Broadcast Status          │
│ Status: ⚫ Not Streaming      │
│ [Start Broadcast] btn        │
└──────────────────────────────┘
```

**When Live:**
```
┌──────────────────────────────┐
│ 📡 Broadcast Status          │
│ Status: 🔴 LIVE              │
│ Duration: 00:42:18           │
│ [Stop Broadcast] btn         │
└──────────────────────────────┘
```

---

## Participant Management

### Roles Explained

#### 1. Host
- **Definition:** Stream owner, full control
- **Capabilities:**
  - Access Producer Mode
  - Control all participants
  - Start/stop recording
  - Change scenes
- **Visibility:** Always visible in stream
- **Icon:** ⭐ Star badge

#### 2. Guest
- **Definition:** Live participant in the stream
- **Capabilities:**
  - Speak and appear on stream
  - Self-mute audio/video
  - Limited controls
- **Visibility:** Visible in stream
- **Icon:** 👤 Person badge

#### 3. Backstage
- **Definition:** Participant not visible to audience
- **Capabilities:**
  - Prepare before going live
  - Can see/hear stream
  - Cannot be seen by audience
- **Visibility:** Hidden from stream output
- **Icon:** 🎭 Backstage badge

### Participant Workflows

#### Adding a Participant

**Method 1: Invite Link**
1. Generate invite link (Studio → Share)
2. Send link to participant
3. They join as Guest (auto)
4. Appears in Participants list

**Method 2: Meeting ID**
1. Share meeting ID with participant
2. They enter ID on join page
3. Join as Guest
4. Appears in Participants list

#### Moving Participant to Backstage

**Why use backstage?**
- Prepare guests before introducing them
- Remove guest temporarily (break, technical issues)
- Keep them connected but off-camera

**How to move backstage:**
1. Find participant card
2. Click **"Move to Backstage"** button (⬇️)
3. Participant instantly disappears from stream
4. Status changes to "Backstage"

**What happens:**
- Participant can still hear stream
- Participant can still see stream
- Audience CANNOT see participant
- Audio/video not transmitted to viewers

#### Promoting Participant to Live

**When to promote:**
- Guest is ready to appear on stream
- Introducing new speaker
- Bringing guest back from break

**How to promote:**
1. Find backstage participant card
2. Click **"Promote to Live"** button (⬆️)
3. Participant instantly appears in stream
4. Status changes to "Guest"

**What happens:**
- Participant becomes visible
- Audio/video transmitted to viewers
- Appears in current scene layout
- Recording includes them (if active)

#### Controlling Participant Audio/Video

**Muting Participants:**
1. Click 🎤 microphone button on participant card
2. Button turns red = muted
3. Participant's audio is cut from stream
4. Participant sees "Muted by host" indicator

**Hiding Participant Video:**
1. Click 📹 camera button on participant card
2. Button turns red = video hidden
3. Participant's video is cut from stream
4. Audio still works (if unmuted)

**Use cases:**
- Mute noisy background
- Hide participant during screen share
- Prevent interruptions
- Emergency mute during inappropriate content

#### Removing Participants

**When to remove:**
- Session ended for that participant
- Participant causing disruption
- Accidental duplicate connection

**How to remove:**
1. Click 🗑️ trash button on participant card
2. Confirmation dialog: "Remove [Name]?"
3. Click "Yes, Remove"
4. Participant is disconnected immediately

**What happens:**
- Participant connection closed
- Removed from stream instantly
- Cannot rejoin without new invite
- Recording stops for that participant (if active)

---

## Scene Layout Strategies

### Grid Layout Best Practices

**When to use:**
- Panel discussions (3-6 people)
- Roundtable conversations
- No clear "main" speaker
- Democratic format (everyone equal)

**Tips:**
- Works best with 2, 4, or 6 participants
- Odd numbers (3, 5) create uneven rows
- Keep to max 9 participants (3x3 grid)
- Beyond 9, consider sidebar or spotlight

**Example: 4-Person Podcast**
```
Host    Co-Host
Guest1  Guest2
```
Everyone has equal presence, democratic feel.

### Sidebar Layout Best Practices

**When to use:**
- One main speaker + multiple guests
- Interview format (1 interviewer, multiple guests)
- Teacher + students
- Moderator + panelists

**Tips:**
- Main speaker should be active talker
- Sidebar shows reactions and other speakers
- Switch main speaker when conversation shifts
- Good for 2-5 total participants

**Example: Interview Show**
```
Main: Interviewer (large)
Sidebar: Guest 1, Guest 2, Guest 3
```
Interviewer is focus, guests are secondary.

### Spotlight Layout Best Practices

**When to use:**
- Single speaker presentation
- Keynote speeches
- Solo performances
- One-on-one interviews

**Tips:**
- Only one participant visible at a time
- Switch spotlight when speaker changes
- Use during screen sharing (spotlight on slides)
- Good for focused, formal content

**Example: Solo Presentation**
```
Full Screen: Presenter
(All others hidden or tiny thumbnails)
```

### Dynamic Scene Switching

**Pro Strategy:** Change scenes during stream

**Example Workflow (Podcast Episode):**

1. **Intro (0:00-2:00):**
   - Layout: Spotlight
   - Show: Host only
   - Purpose: Welcome, explain topic

2. **Main Interview (2:00-30:00):**
   - Layout: Sidebar
   - Main: Guest
   - Sidebar: Host
   - Purpose: Focus on guest answers

3. **Q&A (30:00-45:00):**
   - Layout: Grid
   - Show: Host + Guest + 2 Callers
   - Purpose: Community interaction

4. **Outro (45:00-47:00):**
   - Layout: Spotlight
   - Show: Host only
   - Purpose: Wrap up, call to action

**How to execute:**
- Pre-plan scene transitions
- Click layout button at transition point
- Instant switch (no disruption)
- Rehearse timing during practice run

---

## Multi-Track Recording Workflows

### Recording Setup

**Step 1: Choose Recording Mode**

**Option A: Separate Audio/Video** (Recommended)
- Each participant: 2 files (audio.webm + video.webm)
- Best for: Professional editing, podcasts
- File count: Participants × 2
- Example: 3 people = 6 files

**Option B: Combined**
- Each participant: 1 file (combined.webm)
- Best for: Quick edits, simple workflows
- File count: Participants × 1
- Example: 3 people = 3 files

**Step 2: Verify Participants**

Before clicking "Start":
1. Check all intended participants are **Live** (not backstage)
2. Backstage participants won't be recorded
3. Verify participant names are correct (used in filenames)
4. Test audio levels for each person

**Step 3: Start Recording**

1. Click **"Start Multi-Track Recording"**
2. All live participants start recording simultaneously
3. Red "REC" badges appear on participant cards
4. Duration counter starts: `00:00:00`

### During Recording

**Monitoring:**
- Check duration counter increases
- Verify all participants show "REC" badge
- Watch for connection issues (yellow/red status)

**Adding Participants Mid-Recording:**
- New participant joins
- They start recording from join time
- Existing participants continue uninterrupted
- New participant has shorter recording

**Removing Participants Mid-Recording:**
- Participant's recording stops at removal time
- Other participants continue recording
- Removed participant's file saved (partial recording)

**Handling Disconnections:**
- Participant disconnects = their recording stops
- Other participants unaffected
- If participant reconnects, recording resumes (creates new file)

### Stopping and Downloading

**Step 1: Stop Recording**
1. Click **"Stop Multi-Track Recording"**
2. All recordings stop simultaneously
3. Files processed in browser (1-2 seconds)
4. Success message: "6 tracks ready (245.3 MB total)"

**Step 2: Download Tracks**
1. Click **"Download All Tracks"**
2. Files download to Downloads folder
3. Each file named: `session_Name_tracktype.webm`
4. Toast confirms: "Downloaded 6 tracks"

**File Naming Examples:**
```
producer-session_Host_audio.webm
producer-session_Host_video.webm
producer-session_Sarah_audio.webm
producer-session_Sarah_video.webm
producer-session_Mike_audio.webm
producer-session_Mike_video.webm
```

**Important:** Download immediately! Tracks are held in memory and lost if you refresh/close browser.

---

## Broadcast Controls

### Starting a Broadcast

**Prerequisites:**
1. At least one participant is live
2. Destination configured (RTMP/streaming platform)
3. Stream key entered (if using external platform)

**Steps:**
1. Verify scene layout is correct
2. Check all participants are ready
3. Click **"Start Broadcast"**
4. Status changes to 🔴 LIVE
5. Duration counter starts

**What gets broadcast:**
- Current scene layout (grid/sidebar/spotlight)
- All live participants (not backstage)
- Current audio/video settings
- Any enabled effects (captions, background removal)

### Stopping a Broadcast

**Steps:**
1. Click **"Stop Broadcast"**
2. Confirmation dialog: "End stream for all viewers?"
3. Click "Yes, Stop"
4. Status changes to ⚫ Not Streaming

**What happens:**
- Stream ends for all viewers
- Participants remain connected
- Can restart broadcast without reconnecting participants
- Multi-track recording (if active) continues

---

## Advanced Workflows

### Workflow 1: Live Talk Show

**Setup:**
- **Participants:** 1 Host, 3 Guests
- **Layout:** Sidebar (host main, guests sidebar)
- **Recording:** Multi-track (separate A/V)

**Pre-Show (10 minutes before):**
1. Host joins, enables Producer Mode
2. Guests join, moved to Backstage
3. Test audio/video for each guest
4. Verify scene layout
5. Start multi-track recording (captures pre-show chat)

**Show Start:**
1. Promote Guest 1 to Live
2. Switch to Grid layout (host + guest 1)
3. Start broadcast
4. Introduce guest

**Mid-Show (Guest Switch):**
1. Promote Guest 2 to Live
2. Move Guest 1 to Backstage (or keep visible)
3. Adjust layout (sidebar: host main, guests sidebar)

**Show End:**
1. Stop broadcast
2. Move all guests to Backstage
3. Switch to Spotlight (host only)
4. Record outro
5. Stop multi-track recording
6. Download all tracks

### Workflow 2: Professional Podcast

**Setup:**
- **Participants:** 2 Co-Hosts, 1 Guest
- **Layout:** Grid (3 people)
- **Recording:** Multi-track (separate audio only for mixing)

**Pre-Recording:**
1. Co-hosts join, test audio
2. Guest joins, moved to Backstage
3. Co-hosts discuss intro (not recorded)
4. When ready: Start multi-track recording

**Recording:**
1. Co-hosts record intro (Grid: 2 people)
2. Promote Guest to Live
3. Layout auto-adjusts (Grid: 3 people)
4. Record full interview
5. Guest leaves or moved to Backstage
6. Co-hosts record outro (Grid: 2 people)

**Post-Recording:**
1. Stop multi-track recording
2. Download audio files:
   - `podcast_CoHost1_audio.webm`
   - `podcast_CoHost2_audio.webm`
   - `podcast_Guest_audio.webm`
3. Import into Audacity for editing
4. Mix, add music, export final episode

### Workflow 3: Virtual Conference Panel

**Setup:**
- **Participants:** 1 Moderator, 4 Panelists
- **Layout:** Grid (5 people)
- **Recording:** Multi-track (combined for simplicity)
- **Broadcast:** Live to YouTube/Facebook

**Pre-Event (30 minutes before):**
1. Moderator joins, enables Producer Mode
2. Panelists join, all moved to Backstage
3. Tech check: audio, video, lighting for each panelist
4. Brief panelists on format

**Event Start:**
1. Start broadcast (moderator only, Spotlight)
2. Moderator introduces event
3. Promote all panelists to Live
4. Switch to Grid layout (5 people)
5. Start multi-track recording

**During Event:**
- Monitor participant connections
- Mute panelists if background noise
- Switch to Sidebar if one panelist dominates

**Q&A Segment:**
- Keep panelists Live
- Audience questions via chat (moderator reads aloud)
- Or: Promote audience members to Live temporarily

**Event End:**
1. Stop multi-track recording
2. Download tracks for highlight reel
3. Stop broadcast
4. Thank panelists (still connected but broadcast stopped)

---

## Tips & Best Practices

### Producer Mode Etiquette

✅ **Do:**
- Communicate with participants before muting/hiding them
- Test all controls before going live
- Have a backup producer (if possible)
- Rehearse scene transitions
- Keep notes of timestamps (for editing later)

❌ **Don't:**
- Mute participants without warning (unless emergency)
- Remove participants mid-sentence
- Change scenes during important moments
- Forget to promote backstage guests when it's their time

### Pre-Production Checklist

**24 Hours Before:**
- [ ] Send calendar invites to all participants
- [ ] Include meeting link and backup contact info
- [ ] Share run-of-show document
- [ ] Confirm participant tech requirements

**1 Hour Before:**
- [ ] Host joins, opens Producer Mode
- [ ] Verify scene layouts configured
- [ ] Test multi-track recording (30-second test)
- [ ] Prepare intro slides (if using screen share)

**15 Minutes Before:**
- [ ] Participants join, all moved to Backstage
- [ ] Individual tech check (audio, video, lighting)
- [ ] Brief participants on hand signals/cues
- [ ] Final scene layout check

**Go Live:**
- [ ] Start multi-track recording
- [ ] Promote host to Live
- [ ] Start broadcast
- [ ] Promote guests as scheduled

### Troubleshooting During Live Production

**Participant Connection Drops:**
1. Keep stream going (don't panic)
2. Acknowledge to audience: "We lost [Name], they'll be back"
3. Continue with remaining participants
4. When participant reconnects, promote back to Live

**Audio Issues (Echo, Feedback):**
1. Mute offending participant immediately
2. Use text chat to notify them
3. Ask them to check headphones/settings
4. Unmute when resolved

**Wrong Scene Layout:**
1. Switch layouts immediately (instant change)
2. Audience won't notice if done smoothly
3. Practice transitions beforehand to avoid mistakes

**Forgot to Start Recording:**
1. Start recording immediately (better late than never)
2. At least you capture remainder
3. Note timestamp when recording started

---

## Keyboard Shortcuts

Currently no keyboard shortcuts available.

**Planned shortcuts:**
- `Ctrl/Cmd + P` - Toggle Producer Mode panel
- `Ctrl/Cmd + 1/2/3` - Switch scene layouts
- `Ctrl/Cmd + M` - Mute selected participant
- `Ctrl/Cmd + Shift + R` - Start/stop multi-track recording
- `Ctrl/Cmd + Shift + B` - Start/stop broadcast

---

## FAQ

**Q: Can multiple people access Producer Mode?**
A: Currently, only the host can access Producer Mode. Multi-producer support is planned.

**Q: Do backstage participants see each other?**
A: No, backstage participants only see live participants. They can't see other backstage people.

**Q: Can I record without broadcasting?**
A: Yes! Start multi-track recording without starting broadcast. Great for podcast recording.

**Q: Can I broadcast without recording?**
A: Yes! Start broadcast without multi-track recording. Live-only content.

**Q: What happens if I close Producer Mode panel?**
A: Panel closes but settings remain. Participants stay in their roles. Reopen anytime.

**Q: Can participants see they've been moved to backstage?**
A: Yes, they see "You are backstage" indicator. They can still see/hear the live stream.

**Q: Do scene changes affect multi-track recording?**
A: No, multi-track recording captures each participant separately, regardless of scene layout.

**Q: Can I change layouts during broadcast?**
A: Yes, instant scene switching without interrupting stream. Viewers see smooth transition.

**Q: What if I remove someone by accident?**
A: They're disconnected. Send them a new invite link to rejoin. No way to undo removal.

**Q: Can I promote multiple people to live at once?**
A: Currently, one at a time. Click promote button for each participant.

**Q: Do muted participants know they're muted?**
A: Yes, they see "Muted by host" indicator. They can't unmute themselves.

**Q: Can I rename participants?**
A: Not currently in UI. Participants' names come from their join settings.

---

## Troubleshooting

### Producer Mode Panel Won't Open

**Problem:** Click "Producer Mode" button but panel doesn't appear

**Solutions:**
1. Refresh page and try again
2. Check browser console (F12) for errors
3. Ensure you're the host (not a guest)
4. Try different browser (Chrome recommended)
5. Clear browser cache and reload

### Can't Control Participant Audio/Video

**Problem:** Click mute/video buttons but nothing happens

**Solutions:**
1. Verify participant is connected (green status)
2. Check if participant manually muted themselves (you can't unmute)
3. Refresh page and try again
4. Participant may need to refresh their connection

### Participant Stuck in Backstage

**Problem:** Promote button doesn't work

**Solutions:**
1. Check participant connection status (should be green)
2. Verify participant stream is active (camera/mic on)
3. Try moving to backstage again, then promote
4. Participant may need to refresh browser

### Multi-Track Recording Not Capturing Audio

**Problem:** Downloaded files have no audio

**Solutions:**
1. Check participant microphones were enabled during recording
2. Verify browser permissions for microphone access
3. Test recording with 30-second clip before full session
4. Ensure participants weren't muted during recording

---

## Performance Considerations

### System Requirements

**Minimum (2-3 participants):**
- CPU: Intel i5 / AMD Ryzen 5 (4 cores)
- RAM: 8 GB
- Bandwidth: 10 Mbps upload

**Recommended (4-6 participants):**
- CPU: Intel i7 / AMD Ryzen 7 (8 cores)
- RAM: 16 GB
- Bandwidth: 25 Mbps upload

**Professional (6+ participants):**
- CPU: Intel i9 / AMD Ryzen 9 (12 cores)
- RAM: 32 GB
- Bandwidth: 50 Mbps upload

### Performance Impact

**CPU Usage:**
- Producer Mode UI: ~5% (panel rendering)
- Per participant: ~10-15%
- Multi-track recording: +5% per participant
- Total (4 participants + recording): ~65-80% CPU

**Memory Usage:**
- Producer Mode UI: ~100 MB
- Per participant stream: ~200 MB
- Multi-track recording buffers: ~300 MB
- Total (4 participants + recording): ~2-3 GB RAM

**Bandwidth:**
- Receiving (per participant): ~2-5 Mbps
- Broadcasting (output): ~3-8 Mbps
- Total (4 participants): ~15-30 Mbps

---

## Related Documentation

- **Multi-Track Recording:** Detailed guide on recording workflows
- **Clip Recording:** Create instant highlights during production
- **AI Captions:** Add live captions to your broadcast
- **Smart Background Removal:** Professional backgrounds for participants

---

## Support

Having issues?
1. Check browser console (F12) for errors
2. Verify all participants have stable connections
3. Test with smaller participant count
4. Use Chrome browser (best performance)
5. Report bugs via GitHub Issues

---

## Version History

- **v1.0.0** - Initial release
  - Scene layouts (Grid, Sidebar, Spotlight)
  - Participant management (Host, Guest, Backstage)
  - Multi-track recording integration
  - Broadcast controls
  - Individual audio/video controls
  - Real-time status monitoring
