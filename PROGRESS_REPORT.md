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

## Audio Configuration (Verified Working)

| Source | Destination | Config |
|--------|-------------|--------|
| Host Mic | Broadcast only | `playLocally: false` |
| Guest Audio | Broadcast + Host Speakers | `playLocally: true` (default) |
| Muting | Track enable/disable | `track.enabled = !track.enabled` |

---

## Current Branch
`claude/merge-webcam-participant-id-2INUk`

## Commits in This Session
1. `00342e9` - Fix participant ID mismatch and race condition for LiveKit streams
2. `2ed5403` - Fix architecture: publish individual camera to LiveKit, not composite
3. `4594d8a` - Fix frozen video: detect track changes within same MediaStream
4. `635b790` - Fix frozen video in greenroom preview tiles

---

## Files Modified

### Frontend
- `frontend/src/services/webrtc.service.ts` - Participant ID parameter
- `frontend/src/pages/GuestJoin.tsx` - Pass participant UUID to WebRTC
- `frontend/src/hooks/studio/useWebRTC.ts` - Accept participantId, publish raw camera
- `frontend/src/pages/Studio.tsx` - Pass host ID, handle pending streams
- `frontend/src/components/studio/canvas/StudioCanvas.tsx` - Track detection for video updates
- `frontend/src/components/studio/canvas/PreviewArea.tsx` - PreviewVideo component

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
- [ ] Investigate LiveKit initial connection failure (nginx config?)
- [ ] Test promotion from greenroom to stage
- [ ] Test multiple guests simultaneously
- [ ] Verify RTMP output includes all participants correctly
