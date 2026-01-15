# StreamLick Progress Report

## Session: 2026-01-14 - LiveKit WebRTC Integration

### Overview
Fixing video streaming issues with LiveKit SFU integration for multi-guest broadcasts.

---

## Issues & Fixes Log

### Issue #1: Participant ID Mismatch
**Status**: ✅ FIXED
**Date**: 2026-01-14
**Symptom**: Streams from LiveKit couldn't be matched to participants because LiveKit used timestamp-based IDs (`participant_1768351755301`) while StreamLick used UUIDs.

**Root Cause**:
- `GuestJoin.tsx` wasn't passing the participant's StreamLick UUID to LiveKit
- `webrtc.service.ts` generated fallback IDs instead of using the real participant ID

**Fix Applied**:
- `webrtc.service.ts`: `initialize()` now accepts optional `participantId` parameter
- `GuestJoin.tsx`: Passes participant UUID to WebRTC service
- `useWebRTC.ts`: Accepts and passes `participantId` to service
- `Studio.tsx`: Passes host's `user.id` as their participant identity

**Commit**: `00342e9` - Fix participant ID mismatch and race condition for LiveKit streams

---

### Issue #2: Race Condition - Streams Before Participants
**Status**: ✅ FIXED
**Date**: 2026-01-14
**Symptom**: Streams arrived via LiveKit before participant data arrived via socket, causing streams to be lost.

**Root Cause**: LiveKit track subscription is faster than socket.io participant-joined events.

**Fix Applied**:
- Added `pendingStreamsRef` in `Studio.tsx` to store streams that arrive before participant data
- Added effect to attach pending streams when participants join

**Commit**: `00342e9` - Fix participant ID mismatch and race condition for LiveKit streams

---

### Issue #3: Host Publishing Composite Instead of Raw Camera
**Status**: ✅ FIXED
**Date**: 2026-01-14
**Symptom**: Architecture mismatch - host was publishing the canvas composite to LiveKit instead of raw camera.

**Root Cause**: `useWebRTC.ts` was using `localStream` (processed) instead of raw camera for LiveKit.

**Fix Applied**:
- `useWebRTC.ts`: Host now publishes raw camera/mic to LiveKit (not the canvas composite)
- This ensures the correct architecture:
  ```
  All Participants → LiveKit → All Participants
                          ↓
                Host composites → RTMP out
  ```

**Commit**: `2ed5403` - Fix architecture: publish individual camera to LiveKit, not composite

---

### Issue #4: Frozen Video on Main Stage (StudioCanvas)
**Status**: ✅ FIXED
**Date**: 2026-01-14
**Symptom**: Guest video on main canvas appeared frozen after promotion or reconnection.

**Root Cause**:
- When LiveKit replaces video tracks (simulcast quality changes or reconnection), the MediaStream object reference stays the same but the internal track changes
- `HTMLPreviewVideo` component only checked if `stream` object changed, not if tracks inside changed
- Canvas render loop had the same issue with hidden video elements

**Fix Applied**:
- `StudioCanvas.tsx` - `HTMLPreviewVideo` component:
  - Added `lastTrackIdRef` to track video track ID
  - Detects when track inside stream changes (not just stream object)
  - Added `addtrack`/`removetrack` event listeners on stream
  - Forces `srcObject` re-assignment when track changes

- `StudioCanvas.tsx` - Canvas render loop:
  - Added `remoteTrackIdsRef` to track video track IDs for each participant
  - Detects track changes and updates hidden video elements accordingly

**Commit**: `4594d8a` - Fix frozen video: detect track changes within same MediaStream

---

### Issue #5: Frozen Video in Greenroom Preview Tiles (PreviewArea)
**Status**: ✅ FIXED
**Date**: 2026-01-14
**Symptom**: Guest video in greenroom/backstage preview tiles appeared frozen after guest reconnection.

**Root Cause**:
- `PreviewArea.tsx` used ref callbacks (`ref={(el) => {...}}`) that only run on mount
- When guest reconnected with new stream, the video element kept showing old disconnected stream
- Ref callbacks don't re-run when props change

**Fix Applied**:
- Created `PreviewVideo` component with proper `useEffect` hooks
- Tracks video track IDs to detect changes within same stream
- Listens for `addtrack`/`removetrack` events
- Forces `srcObject` re-assignment when tracks change
- Applied to both backstage and greenroom participant preview tiles

**Commit**: `635b790` - Fix frozen video in greenroom preview tiles

---

### Issue #6: LiveKit Connection Initial Failure
**Status**: ⚠️ KNOWN ISSUE (works after retry)
**Date**: 2026-01-14
**Symptom**:
```
WebSocket connection to 'wss://media.streamlick.com/rtc/v1?...' failed
Initial connection failed: v1 RTC path not found. Consider upgrading your LiveKit server version – Retrying
```

**Current Behavior**: Connection fails on first attempt but succeeds on retry.

**Possible Causes**:
- nginx routing issue for `/rtc/v1` path
- LiveKit server version mismatch with client
- WebSocket upgrade timing issue

**Workaround**: LiveKit client automatically retries and connection succeeds.

**TODO**: Investigate nginx configuration for `media.streamlick.com`

---

### Issue #7: Guest Stream Not Received by Host - Race Condition
**Status**: ✅ FIXED
**Date**: 2026-01-14
**Symptom**: Host sees participant in sync (from database) but receives no tracks from LiveKit. Guest console shows `[GuestJoin] No local stream available when joining`.

**Root Cause**:
Guest tried to join LiveKit BEFORE `localStream` was ready:
1. `handleJoin()` called
2. `webrtcService.initialize()` → WebRTC ready
3. `webrtcService.joinRoom(localStream)` → **FAILED because localStream was null**
4. `useMedia` finally produces stream → **Too late!**

**Fix Applied** (`GuestJoin.tsx`):
- Added `hasPublishedRef` to track if we've successfully published to LiveKit
- Added `useEffect` that watches for `localStream` and calls `joinRoom()` when it becomes available (if not already joined)
- Reset `hasPublishedRef` on leave to allow re-joining

```javascript
// Join LiveKit when localStream becomes available (handles race condition)
useEffect(() => {
  if (!hasJoined || !localStream || hasPublishedRef.current) return;

  const publishToLiveKit = async () => {
    await webrtcService.joinRoom(localStream);
    hasPublishedRef.current = true;
  };

  publishToLiveKit();
}, [hasJoined, localStream]);
```

**Commit**: `287b4c7` - Fix race condition: guest joins LiveKit before stream ready

---

### Issue #8: Frozen Video in PreviewArea Guest Tiles
**Status**: ✅ FIXED
**Date**: 2026-01-14
**Symptom**: Guest video preview tile at bottom of host's studio shows frozen frame. Console shows `[PreviewVideo] Updating video source` but video doesn't play.

**Root Cause**:
The PreviewVideo component had several issues:
1. `video.play().catch(() => {})` silently swallowed play failures
2. No monitoring of track state (enabled/muted/readyState)
3. No recovery mechanism for stalled or unexpectedly paused videos
4. Browser autoplay policies could silently fail

**Fix Applied** (`PreviewArea.tsx`):
- Added `attemptPlay()` helper with detailed track state logging
- Added retry logic (500ms delay) when play() fails
- Added event listeners for video element events:
  - `stalled`: Attempts recovery when video stalls
  - `pause`: Auto-resumes if video is unexpectedly paused
  - `canplay`: Ensures playback when video becomes ready
- Force re-assigns srcObject on retry to reset video element state

**Files Modified**:
- `frontend/src/components/studio/canvas/PreviewArea.tsx`

**Commit**: `77248ee` - Fix frozen video in guest preview tiles

---

### Issue #9: Mobile Camera Shows Black Screen / No Front/Back Selection
**Status**: ✅ FIXED
**Date**: 2026-01-14
**Symptom**: Mobile guest joining shows black screen, only one camera option in device selector (should have front/back).

**Root Cause**:
1. `startCamera()` in `useMedia.ts` didn't accept any device selection parameters
2. No `facingMode` support for mobile devices (front: `user`, back: `environment`)
3. Couldn't switch cameras after initial selection

**Fix Applied**:
- `useMedia.ts`: Added `options` parameter with `videoDeviceId`, `audioDeviceId`, and `facingMode`
- `useMedia.ts`: Properly stops existing streams when switching devices
- `GuestJoin.tsx`: Starts with front camera (`facingMode: 'user'`) by default
- `GuestJoin.tsx`: Added `flipCamera()` function to toggle between front/back
- `GuestJoin.tsx`: Added useEffect to handle device selection changes
- `GuestJoinLobby.tsx`: Added "Flip" button visible on mobile devices

**Files Modified**:
- `frontend/src/hooks/useMedia.ts`
- `frontend/src/pages/GuestJoin.tsx`
- `frontend/src/components/guest/GuestJoinLobby.tsx`

**Commit**: `deb0b96` - Add mobile camera support with facingMode and flip button

---

## Audio Configuration (Verified Working)

| Source | Destination | Config |
|--------|-------------|--------|
| Host Mic | Broadcast only | `playLocally: false` |
| Guest Audio | Broadcast + Host Speakers | `playLocally: true` (default) |
| Muting | Track enable/disable | `track.enabled = !track.enabled` |

---

### Issue #10: TURN Server Configuration Issues
**Status**: 🔧 IN PROGRESS
**Date**: 2026-01-14
**Symptom**: Mobile guests may fail to connect or have frozen video due to NAT traversal failures.

**Root Cause**:
Multiple configuration issues identified on TURN server (`turn-1`):
1. **TLS port 5349 not listening** - coturn config has `tls-listening-port=5349` but no SSL certificates configured
2. **Password mismatch** - Server has `Str3aml1ck_TURN_2026!xK9m` but code defaulted to `changeme`
3. **Environment variable name mismatch** - `.env.example` used different names than `webrtc.service.ts`

**TURN Server Status** (178.156.222.91):
- Port 3478 (TCP/UDP): ✅ Listening
- Port 5349 (TLS): ❌ Not listening (no SSL certs)
- External IP: ✅ Correctly configured
- Username: `streamlick`
- Password: `Str3aml1ck_TURN_2026!xK9m`

**Fix Applied**:
- `webrtc.service.ts`:
  - Made TLS URL optional (only used if configured)
  - Improved ICE server configuration with proper logging
  - Added multiple STUN servers for redundancy
  - Only adds TURN if password is set
- `.env.example`: Updated with correct variable names

**Environment Variables** (set in production `.env`):
```
VITE_TURN_URL=turn:turn.streamlick.com:3478
VITE_TURN_USERNAME=streamlick
VITE_TURN_PASSWORD=Str3aml1ck_TURN_2026!xK9m
```

**TODO**:
- [x] Set TURN password in production frontend `.env` ✅ DONE
- [ ] Consider adding TLS certificates to TURN server for better security

---

### Issue #11: Guest Video Freezes Immediately on Join
**Status**: ✅ FIXED
**Date**: 2026-01-15
**Symptom**: Guest video in preview tiles and main canvas freezes the moment they join. Video shows one frame then stops.

**Root Cause**:
When a guest's track is first subscribed via LiveKit, ICE negotiation may still be in progress:
```
WARN: Failed to ping without candidate pairs. Connection is not possible yet.
```
The track is technically "subscribed" but `mediaStreamTrack.muted` is `true` because actual video data isn't flowing yet. The webrtc.service.ts was notifying the UI immediately, causing the video element to try playing a muted track.

**Fix Applied**:
1. **`webrtc.service.ts`** - Wait for track data before notifying:
   - Check if `mediaStreamTrack.muted` is true on subscription
   - If muted, wait for the `unmute` event before notifying the stream callback
   - Added 2 second timeout fallback in case unmute never fires

2. **`PreviewArea.tsx` & `StudioCanvas.tsx` & `GuestStreamPreview.tsx`** - Aggressive frame retry:
   - Added useEffect that checks if video has actual frames (`videoWidth > 0`)
   - Retries up to 10 times (5 seconds) by re-assigning srcObject
   - Logs detailed state on each retry for debugging
   - Listens for track add/remove events on stream
   - Handles stalled/pause/canplay events

**New Console Logs to Watch**:
```
[WebRTC-LiveKit] Track is muted, waiting for unmute: {...}
[WebRTC-LiveKit] Track unmuted, notifying callback: {...}
[PreviewVideo] No video frames yet, retrying... {checkCount: 1, ...}
[PreviewVideo] Video has frames: {videoWidth: 640, videoHeight: 480}
[GuestStreamPreview] No video frames yet, retrying... {checkCount: 1, ...}
[GuestStreamPreview] Video has frames: {...}
```

**Files Modified**:
- `frontend/src/services/webrtc.service.ts`
- `frontend/src/components/studio/canvas/PreviewArea.tsx`
- `frontend/src/components/studio/canvas/StudioCanvas.tsx`
- `frontend/src/components/guest/GuestStreamPreview.tsx`

**Commits**:
- `70fd5db` - Fix guest video freezing on initial join
- `9a8ab5e` - Fix GuestStreamPreview video freezing (host preview on guest screen)
- `2826199` - Fix race condition: set callbacks before joinRoom in GuestJoin
- `7b24691` - Fix play() interruption in GuestStreamPreview frame retry
- `aeb299b` - Fix conflicting retry mechanisms in GuestStreamPreview
- `51805c4` - Add muted attribute to GuestStreamPreview video for autoplay
- `11352bd` - Add session persistence for guest page refresh
- `cfea147` - Fix: Create new MediaStream when tracks change

---

### Issue #12: Video Track Shows 'live' But No Frames Received
**Status**: ✅ FIXED
**Date**: 2026-01-15
**Symptom**: Video track from LiveKit shows `trackReadyState: 'live'` and `trackMuted: false` with valid settings (320x180, 30fps), but browser video element `readyState` stays at 0 (HAVE_NOTHING) - no frames ever received.

**Root Cause**:
The webrtc.service.ts was directly accessing `track.mediaStreamTrack` and creating MediaStreams manually. However, LiveKit's RemoteTrack may not be fully initialized for playback when accessed this way. LiveKit's recommended approach is to use `track.attach()` which:
1. Properly initializes the track for playback
2. Handles browser-specific quirks
3. Sets up the correct MediaStream internally

**Fix Applied**:
- `webrtc.service.ts` - Use LiveKit's native `track.attach()` method:
  - Call `track.attach()` to get a properly configured video/audio element
  - Extract the MediaStream from the attached element's `srcObject`
  - Store attached elements in `attachedElements` Map to prevent garbage collection
  - Clean up attached elements when participant disconnects or room closes
  - Added fallback to `handleTrackWithMediaStreamTrack()` if attach doesn't work

**Key Changes**:
```typescript
// OLD approach (didn't work):
const mediaTrack = track.mediaStreamTrack; // May not be initialized
const stream = new MediaStream([mediaTrack]);

// NEW approach (proper LiveKit pattern):
const element = track.attach(); // Properly initializes track
const attachedStream = element.srcObject as MediaStream;
const mediaTrack = attachedStream.getTracks().find(t => t.kind === track.kind);
```

**Files Modified**:
- `frontend/src/services/webrtc.service.ts`

---

## Current Branch
`claude/fix-previewarea-typescript-qp6Tf`

## Commits in This Session
1. `00342e9` - Fix participant ID mismatch and race condition for LiveKit streams
2. `2ed5403` - Fix architecture: publish individual camera to LiveKit, not composite
3. `4594d8a` - Fix frozen video: detect track changes within same MediaStream
4. `635b790` - Fix frozen video in greenroom preview tiles
5. `00b8aae` - Add progress report and Claude Code instructions
6. `287b4c7` - Fix race condition: guest joins LiveKit before stream ready
7. `70fd5db` - Fix guest video freezing on initial join
8. `9a8ab5e` - Fix GuestStreamPreview video freezing (host preview on guest screen)
9. `f2bf2eb` - Update progress report with GuestStreamPreview fix and documentation
10. `2826199` - Fix race condition: set callbacks before joinRoom in GuestJoin
11. `7b24691` - Fix play() interruption in GuestStreamPreview frame retry
12. `aeb299b` - Fix conflicting retry mechanisms in GuestStreamPreview
13. `51805c4` - Add muted attribute to GuestStreamPreview video for autoplay
14. `11352bd` - Add session persistence for guest page refresh

---

## Files Modified

### Frontend
- `frontend/src/services/webrtc.service.ts` - Participant ID parameter, wait for track unmute
- `frontend/src/pages/GuestJoin.tsx` - Pass participant UUID, fix race condition with hasPublishedRef, set callbacks before joinRoom, session persistence for refresh
- `frontend/src/hooks/studio/useWebRTC.ts` - Accept participantId, publish raw camera
- `frontend/src/pages/Studio.tsx` - Pass host ID, handle pending streams
- `frontend/src/components/studio/canvas/StudioCanvas.tsx` - Track detection for video updates, frame retry
- `frontend/src/components/studio/canvas/PreviewArea.tsx` - PreviewVideo component, debug logging, frame retry
- `frontend/src/components/guest/GuestStreamPreview.tsx` - Track detection, frame retry (less aggressive), muted attribute for autoplay

### Documentation
- `PROGRESS_REPORT.md` - This file, tracks all issues and fixes
- `CLAUDE.md` - Standard procedures for Claude Code sessions

---

## Debugging Tips

### Console Logs to Watch For
```
[HTMLPreviewVideo] Updating video source: {...}  // Main canvas video updates
[PreviewVideo] Updating video source: {...}       // Preview tile video updates
[GuestStreamPreview] Setting broadcast stream: {...}  // Host preview on guest page
[StudioCanvas] Video track changed for participant: {...}  // Canvas render track changes
[Studio] Matched stream to participant by ID: {...}  // Stream matching
[Studio] Stream arrived before participant, storing as pending: {...}  // Race condition handling
[WebRTC-LiveKit] Track is muted, waiting for unmute: {...}  // Track not ready yet
[*] No video frames yet, retrying... {checkCount: N}  // Frame retry in progress
[*] Video has frames: {videoWidth: X, videoHeight: Y}  // Video recovered
```

### Key Checks
1. Participant ID should be UUID format (e.g., `d89a9d46-b329-4396-852d-6333dbaed2b3`)
2. Track IDs should update when guest reconnects
3. `hadStream: false` in logs means previous stream was cleared properly

### Components with Video Frame Retry Pattern (DO NOT RE-IMPLEMENT)
The following components already have the frame retry and track change detection fix:
- `PreviewArea.tsx` → `PreviewVideo` component (backstage/greenroom tiles on host Studio)
- `StudioCanvas.tsx` → `HTMLPreviewVideo` component (main canvas on host Studio)
- `GuestStreamPreview.tsx` (host preview on guest greenroom page)

If video freezing occurs in a NEW component, apply the same pattern:
1. Track ID detection (`lastTrackIdRef`)
2. Frame check retry loop (`checkForFrames` with `videoWidth > 0`)
3. Stream event listeners (`addtrack`, `removetrack`)
4. Video element events (`stalled`, `pause`, `canplay`)

---

### Issue #13: Guest Greenroom LIVE Preview Shows Raw Camera Instead of Canvas
**Status**: ✅ FIXED
**Date**: 2026-01-15
**Symptom**: When a guest enters the greenroom, the "LIVE" preview in the top-right shows only the host's raw webcam feed instead of the full composed canvas output (with all participants, overlays, backgrounds).

**Root Cause**:
When migrating from LiveKit to Ant Media SFU, the P2P canvas preview system was disabled:
1. `GuestJoin.tsx` comment said "P2P hooks (usePreviewStream, useGuestStream) removed in favor of LiveKit SFU"
2. The guest's `broadcastStream` was being set from `webrtcService.setRemoteStreamCallback`
3. This gave the host's raw camera stream from Ant Media SFU, not the composed canvas

**Architecture**:
The system has TWO separate streaming mechanisms:
1. **Ant Media SFU** - Individual participant camera/mic streams (for compositing)
2. **P2P Canvas Preview** - Composed canvas output (for guest "LIVE" preview)

The P2P preview stream system was already implemented but not used:
- `hooks/studio/usePreviewStream.ts` - Host sends canvas via P2P to each guest
- `hooks/guest/usePreviewStream.ts` - Guest receives canvas via P2P
- Uses socket.io for signaling (`preview-stream-requested`, `preview-offer`, `preview-answer`, `preview-ice-candidate`)

**Fix Applied**:
- `GuestJoin.tsx`:
  - Re-imported `usePreviewStream` from guest hooks
  - Added `usePreviewStream` hook call to receive P2P canvas preview
  - Removed `setBroadcastStream` calls from Ant Media callback (not needed for preview)
  - Updated comments to clarify architecture

**Files Modified**:
- `frontend/src/pages/GuestJoin.tsx`

**Commit**: `93e8789` - Re-enable P2P canvas preview for guest greenroom LIVE display

---

### Issue #14: Mute Buttons Not Synced with Ant Media Server
**Status**: ✅ FIXED
**Date**: 2026-01-15
**Symptom**: Mute buttons only toggled `track.enabled` locally, but Ant Media server was not notified about mute state changes.

**Root Cause**:
The mute implementation in `useMedia.ts` correctly sets `track.enabled = false` to mute:
- This stops sending audio/video data through the track
- WebRTC transmission is muted locally
- BUT Ant Media server wasn't explicitly notified via its API

While `track.enabled = false` does stop transmission, Ant Media provides explicit mute APIs that should be called for proper server-side tracking.

**Architecture**:
Muting now uses a two-layer approach:
1. **Local track**: `track.enabled = false` (immediate local muting via useMedia hook)
2. **Ant Media notification**: `webrtcService.muteAudio()/muteVideo()` (server notification)

**Fix Applied**:
- `GuestJoin.tsx`: Added `useEffect` hooks to sync `audioEnabled` and `videoEnabled` with `webrtcService.muteAudio()` and `webrtcService.muteVideo()`
- `Studio.tsx`: Same synchronization for host's mute state
- `webrtc.service.ts`: Added logging to mute methods for debugging

**Key Points**:
- Host mute only affects host's mic/camera (not guests)
- Guest mute only affects that guest's mic/camera
- Muting does NOT disconnect streams - tracks remain in WebRTC connection
- When unmuted, audio/video resumes without reconnection

**Files Modified**:
- `frontend/src/pages/GuestJoin.tsx`
- `frontend/src/pages/Studio.tsx`
- `frontend/src/services/webrtc.service.ts`

**Commit**: `33e7bcc` - Sync mute state with Ant Media server

---

### Issue #15: Guest Stream Not Visible to Host After Late Join
**Status**: ✅ FIXED
**Date**: 2026-01-15
**Symptom**: When a guest joins AFTER the host is already in the room, the host never receives their video stream. The guest's preview tile on the host's screen shows black.

**Root Cause**:
In Ant Media conference mode, when a new participant joins after the host:
- Ant Media sends `subtrackAdded` callback (NOT `streamJoined`)
- The `webrtc.service.ts` was NOT handling `subtrackAdded`
- Therefore, the host never subscribed to the new participant's stream

**Fix Applied**:
- Added handler for `subtrackAdded` callback in `webrtc.service.ts`
- When `subtrackAdded` is received with a `trackId` different from our own, subscribe to it
- This ensures host receives streams from guests who join after them

**Files Modified**:
- `frontend/src/services/webrtc.service.ts`

---

### Issue #16: Black Video Caused by Mute Sync on Mount
**Status**: ✅ FIXED
**Date**: 2026-01-15
**Symptom**: Guest and host video shows black screen shortly after joining. Camera restarts during connection setup.

**Root Cause**:
The mute sync useEffects ran on initial mount:
1. When `hasJoined` became true, effects ran immediately
2. With `audioEnabled=true`, called `webrtcService.muteAudio(false)` → `unmuteLocalMic()`
3. With `videoEnabled=true`, called `webrtcService.muteVideo(false)` → `turnOnLocalCamera()`
4. `turnOnLocalCamera()` RESTARTS the camera with `getUserMedia()` and replaces the track
5. This disrupted the already-working stream

**Fix Applied**:
- Added `initialMuteStateRef` to track if initial state has been recorded
- On first run (mount), only record the current state without calling API
- Only call mute/unmute API on ACTUAL state changes (user clicks mute button)
- Applied to both `GuestJoin.tsx` and `Studio.tsx`

**Files Modified**:
- `frontend/src/pages/GuestJoin.tsx`
- `frontend/src/pages/Studio.tsx`

**Commit**: `b67f7ed` - Fix stream subscription and mute sync issues

---

### Issue #17: Guest LIVE Preview Shows Black
**Status**: ✅ FIXED
**Date**: 2026-01-15
**Symptom**: Guest's LIVE preview (top-right) shows black screen. The WebRTC connection is established and frames are being transmitted successfully, but the video element shows no frames (videoWidth=0, videoHeight=0).

**Root Causes**:
Analysis of logs revealed THREE distinct issues:

1. **Canvas render loop stops when host tab goes to background**
   - `requestAnimationFrame` is throttled/paused when browser tab is not visible
   - Host logs showed fps dropping from 30 → 2 → 0 when tab became hidden
   - `framesSent` stopped increasing while connection remained open
   - Guest received no new frames after host tab went to background

2. **Video element dimensions never update from 0x0**
   - WebRTC `framesReceived` and `framesDecoded` showed frames ARE being received
   - But `video.videoWidth` and `video.videoHeight` remained 0
   - The `loadedmetadata` event fires before any frames arrive (with 0x0 dimensions)
   - Need to listen for `resize` event which fires when first frame is decoded

3. **Audio track overwrites video track stream**
   - WebRTC sends each track in its own MediaStream
   - Video track arrives first: `{videoTracks: 1, audioTracks: 0}`
   - Audio track arrives second: `{videoTracks: 0, audioTracks: 1}`
   - `setBroadcastStream()` was called for both, so audio stream (with 0 video tracks) overwrote video stream
   - GuestStreamPreview ended up with a stream containing only audio

**Fix Applied**:

1. **Background tab rendering** (`StudioCanvas.tsx`):
   - Added Page Visibility API listener (`visibilitychange` event)
   - When tab is hidden, switch from `requestAnimationFrame` to `setInterval` (10 FPS)
   - When tab is visible again, switch back to `requestAnimationFrame`
   - This ensures canvas continues producing frames even when host minimizes browser

2. **Video dimension detection** (`GuestStreamPreview.tsx`):
   - Added `resize` event listener on video element
   - `resize` fires when first frame is decoded and dimensions become available
   - When resize fires with valid dimensions and video is paused, attempt play

3. **Only set video stream** (`hooks/guest/usePreviewStream.ts`):
   - Only call `setBroadcastStream()` when receiving VIDEO track
   - Ignore audio track's stream to prevent overwriting video stream

**Console Logs**:
```
[StudioCanvas] Tab hidden - switching to setInterval fallback (10 FPS)
[StudioCanvas] Tab visible - switching back to requestAnimationFrame
[GuestStreamPreview] Video resized: videoWidth=1920, videoHeight=1080
[PreviewStream] Setting video stream: streamId=xxx, videoTracks=1
```

**Files Modified**:
- `frontend/src/components/studio/canvas/StudioCanvas.tsx` - Background tab fallback
- `frontend/src/components/guest/GuestStreamPreview.tsx` - Resize event listener
- `frontend/src/hooks/guest/usePreviewStream.ts` - Only set video stream

**Commits**:
- `b14af0e` - Fix guest LIVE preview black screen with two root cause fixes
- `be3332f` - Fix audio track overwriting video track in guest preview stream

---

### Optimization #1: Adaptive Resolution for Greenroom vs Stage
**Status**: ✅ IMPLEMENTED
**Date**: 2026-01-15
**Goal**: Reduce bandwidth usage when guests are in greenroom since host only sees them in a small 160x90px preview tile.

**Solution**:
Guests now transmit at different resolutions based on their status:

| Status | Resolution | Frame Rate | Est. Bandwidth |
|--------|------------|------------|----------------|
| Greenroom | 480x270 | 15 fps | ~200-400 kbps |
| On Stage | 1280x720 | 30 fps | ~1.5-2.5 Mbps |

**Implementation**:
1. Added `width`, `height`, `frameRate` options to `useMedia.startCamera()`
2. Guest starts with greenroom resolution on initial join
3. When promoted to stage (status changes to 'live'), automatically:
   - Restart camera at higher resolution
   - Replace video track on Ant Media connection
4. When demoted back to greenroom, downgrade resolution
5. Device switching and camera flip preserve current resolution mode

**Trade-off**: Brief ~1-2 second video restart when resolution changes during promotion.

**Files Modified**:
- `frontend/src/hooks/useMedia.ts` - Resolution options
- `frontend/src/pages/GuestJoin.tsx` - Adaptive resolution logic

**Commit**: `aa21f2f` - Add adaptive resolution for greenroom vs stage bandwidth optimization

---

## Next Steps / TODO
- [ ] Set TURN password in production frontend `.env`
- [ ] Consider adding TLS certificates to TURN server for better security
- [ ] Investigate initial WebRTC connection failure (Ant Media server config?)
- [x] Test promotion from greenroom to stage (resolution upgrade implemented)
- [ ] Test multiple guests simultaneously
- [ ] Verify RTMP output includes all participants correctly
