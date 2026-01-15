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
**Status**: 🔧 FIX APPLIED (needs deploy)
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

2. **`PreviewArea.tsx` & `StudioCanvas.tsx`** - Aggressive frame retry:
   - Added useEffect that checks if video has actual frames (`videoWidth > 0`)
   - Retries up to 10 times (5 seconds) by re-assigning srcObject
   - Logs detailed state on each retry for debugging

**New Console Logs to Watch**:
```
[WebRTC-LiveKit] Track is muted, waiting for unmute: {...}
[WebRTC-LiveKit] Track unmuted, notifying callback: {...}
[PreviewVideo] No video frames yet, retrying... {checkCount: 1, ...}
[PreviewVideo] Video has frames: {videoWidth: 640, videoHeight: 480}
```

**Files Modified**:
- `frontend/src/services/webrtc.service.ts`
- `frontend/src/components/studio/canvas/PreviewArea.tsx`
- `frontend/src/components/studio/canvas/StudioCanvas.tsx`

**Deployment Required**: Rebuild and deploy frontend for fix to take effect.

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

---

## Files Modified

### Frontend
- `frontend/src/services/webrtc.service.ts` - Participant ID parameter
- `frontend/src/pages/GuestJoin.tsx` - Pass participant UUID, fix race condition with hasPublishedRef
- `frontend/src/hooks/studio/useWebRTC.ts` - Accept participantId, publish raw camera
- `frontend/src/pages/Studio.tsx` - Pass host ID, handle pending streams
- `frontend/src/components/studio/canvas/StudioCanvas.tsx` - Track detection for video updates
- `frontend/src/components/studio/canvas/PreviewArea.tsx` - PreviewVideo component, debug logging

### Documentation
- `PROGRESS_REPORT.md` - This file, tracks all issues and fixes
- `CLAUDE.md` - Standard procedures for Claude Code sessions

---

## Debugging Tips

### Console Logs to Watch For
```
[HTMLPreviewVideo] Updating video source: {...}  // Main canvas video updates
[PreviewVideo] Updating video source: {...}       // Preview tile video updates
[StudioCanvas] Video track changed for participant: {...}  // Canvas render track changes
[Studio] Matched stream to participant by ID: {...}  // Stream matching
[Studio] Stream arrived before participant, storing as pending: {...}  // Race condition handling
```

### Key Checks
1. Participant ID should be UUID format (e.g., `d89a9d46-b329-4396-852d-6333dbaed2b3`)
2. Track IDs should update when guest reconnects
3. `hadStream: false` in logs means previous stream was cleared properly

---

## Next Steps / TODO
- [ ] Set TURN password in production frontend `.env`
- [ ] Consider adding TLS certificates to TURN server for better security
- [ ] Investigate LiveKit initial connection failure (nginx config?)
- [ ] Test promotion from greenroom to stage
- [ ] Test multiple guests simultaneously
- [ ] Verify RTMP output includes all participants correctly
