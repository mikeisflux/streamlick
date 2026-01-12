# Video Flickering Fix - Detailed Change Log

## Problem
Guest video flickering on the stage canvas. Preview tiles work fine.

---

## HISTORICAL COMMITS (Before Current Session)

These commits were made in previous sessions. Status: ALREADY TRIED, FLICKERING PERSISTS

| Commit | Description | Status |
|--------|-------------|--------|
| `5046bf2` | Stricter readyState check (>= 2 + videoWidth > 0) | TRIED - still flickering |
| `d37eaab` | Added stability tracking | TRIED - still flickering |
| `1932f91` | Aggressive stability tracking + frame preservation | TRIED - still flickering |
| `aa0b662` | Per-participant offscreen canvas caching | TRIED - still flickering |
| `6811daa` | Always draw from cache buffer | TRIED - still flickering |
| `2b4eca1` | Fix guest view to show full stage when promoted | WORKED for guest view |
| `763eaad` | Guest preview persistence + video stability | Partially worked |
| `3004342` | Refactor StudioCanvas from 2099 to 770 lines | Code cleanup only |
| `b415b18` | Use ref for speakingParticipants in render loop | TRIED - stopped screen flickering |
| `b296075` | Fix participant reconnection on host reload | Addressed reconnection issue |
| `e175bff` | Emit to greenroom room for stream requests | Backend fix |
| `d682e3a` | Ignore offers when already connected | TRIED - reduced flickering |
| `4975e6b` | Preserve guest role during polling | TRIED - still flickering |
| `4bff44e` | Only update speaking state when it changes | TRIED - still flickering |
| `b279f49` | Prevent unnecessary cleanup and re-renders | TRIED - still flickering |

---

## CURRENT SESSION CHANGES

### Change 1: Audio Analyzer Recreation Fix
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Lines:** 211-320

**Problem:** Audio analyzers were being destroyed and recreated every time `remoteParticipants` changed (every 5 seconds from poll + socket events). The `useEffect` cleanup function was clearing ALL audio contexts on every dependency change.

**Fix:**
- Store audio contexts in a `useRef` that persists across re-renders (`audioContextsRef`)
- Only create new analyzers when stream actually changes (compare `streamId`)
- Separate unmount cleanup from dependency change handling
- Add check `if (existing && existing.streamId === streamId) return;` to skip if already have working analyzer

**Status:** APPLIED

---

### Change 2: Video Element Cleanup Fix
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Lines:** 686-737

**Problem:** The cleanup function in the video element management `useEffect` was clearing ALL video elements and canvas cache every time `remoteParticipants` changed. New video elements need time to load.

**Fix:**
- Changed cleanup to only run on component unmount (separate `useEffect` with empty deps)
- Changed main effect to return `() => {}` instead of full cleanup
- Individual items are removed only when participants actually leave

**Status:** APPLIED

---

### Change 3: Role Preservation in handleParticipantsSync
**File:** `frontend/src/hooks/studio/useParticipants.ts`
**Lines:** 195-206

**Problem:** `handleParticipantsSync` was not preserving the 'guest' role when receiving sync events, causing role to reset to 'backstage'. This triggered video element deletion because the condition `p.role !== 'guest'` became true.

**Fix:**
```javascript
const apiRole = (p.role || 'backstage') as 'host' | 'guest' | 'backstage';
const role = existing?.role === 'guest' ? 'guest' : apiRole;
```

**Status:** APPLIED

---

### Change 4: useAudioLevel 60 FPS Re-renders Fix
**File:** `frontend/src/hooks/studio/useAudioLevel.ts`
**Lines:** 52-77

**Problem:** `setIsSpeaking(speaking)` was called on every animation frame (60 FPS) even when the value hadn't changed. This caused 60 state updates per second.

**Fix:**
```javascript
let wasSpeaking = false;
// ... inside checkAudioLevel:
if (speaking !== wasSpeaking) {
  wasSpeaking = speaking;
  setIsSpeaking(speaking);
}
```

**Status:** APPLIED

---

### Change 5: Video ReadyState Check Relaxed
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Line:** 424 (now ~424)

**Problem:** Video readyState check was `>= 3` (HAVE_FUTURE_DATA) which is too strict. ReadyState 2 (HAVE_CURRENT_DATA) is sufficient to draw frames.

**Fix:**
```javascript
// Before:
const videoReady = p.video && p.video.readyState >= 3 && ...
// After:
const videoReady = p.video && p.video.readyState >= 2 && ...
```

**Status:** APPLIED

---

### Change 6: Removed Stability Tracking
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Lines:** ~424-434

**Problem:** Complex stability tracking (`videoStableFrames`, `stableCount`, `videoIsStable`) was overly cautious and might have been causing frames to be skipped.

**Fix:** Removed stability tracking entirely. Now always update cache if video is ready, always draw from cache if available.

**Status:** APPLIED

---

### Change 7: Stricter srcObject Protection in useEffect
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Lines:** 706-727

**Problem:** The `srcObject` was being updated if `video.srcObject !== p.stream`, but object reference comparison might fail even if it's the same stream.

**Fix:**
```javascript
// Before: Complex conditions checking video state
// After: Only set srcObject if we don't have one at all
if (!hasSrcObject && p.stream) {
  video.srcObject = p.stream;
  video.play().catch(() => {});
}
```

If video already has a srcObject and is working (playing or has valid dimensions), leave it completely alone.

**Status:** APPLIED

---

### Change 8: Fixed Cache Update Order
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Lines:** ~431-452

**Problem:** Dark frame was drawn BEFORE cache was updated, then `shouldDrawFromCache` was checked using the OLD value of `hasCachedFrame`. First frame for any participant was always dark.

**Fix:**
1. Update cache FIRST
2. THEN check if we can draw from it (including the just-updated cache)
```javascript
// Update cache first
if (p.videoEnabled && videoReady && cache) {
  try { cache.ctx.drawImage(...); cache.lastFrameTime = now; } catch {}
}
// Now check if we can draw (includes if we just updated)
const canDrawFromCache = p.videoEnabled && cache && cache.lastFrameTime > 0;
```

**Status:** APPLIED

---

### Change 9: Dark Background Fallback - REVERTED
**Status:** REVERTED - Made preview black

---

### Change 10: Cache Resize Preservation - REVERTED
**Status:** REVERTED - Made preview black

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `StudioCanvas.tsx` | Audio analyzer fix, video element cleanup fix, readyState relaxed, stability tracking removed, srcObject protection, cache order fix |
| `useParticipants.ts` | Role preservation in handleParticipantsSync |
| `useAudioLevel.ts` | 60 FPS re-renders fix |

---

### Change 11: Debug Logging Added
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Lines:** ~419-449

**Purpose:** Add debug logging to track exactly what's happening with remote participant video state. Logs only when state changes (not every frame) to avoid flooding console.

**What it logs:**
- videoEnabled
- hasVideo (is there a video element)
- videoReady (readyState >= 2 AND has dimensions)
- readyState (raw value)
- videoWidth/Height
- hasSrcObject
- hasCache
- cacheLastFrame timestamp

**How to use:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Filter for "FLICKER DEBUG"
4. Watch for state changes when flickering occurs

**Status:** APPLIED - FOR DEBUGGING

---

### Change 12: Fix Duplicate Offer Handling in useGuestStreams
**File:** `frontend/src/hooks/studio/useGuestStreams.ts`
**Lines:** 54-66

**Problem:** When the host requests guests to resend stream offers (at 1s and 3s after init), the second offer arrives while the first connection is still in `state: "new"` (ICE hasn't started yet). The code was only ignoring offers for "connected" or "connecting" states, treating "new" as "broken" and closing the connection.

**Root Cause from Logs:**
```
[GuestStreams] Received offer from guest: d0ab7c2d-...
... connection established ...
[GuestStreams] Received offer from guest: d0ab7c2d-...
[GuestStreams] Closing broken connection for d0ab7c2d-... - state: new
```

**Fix:**
```javascript
// Before:
if (state === 'connected' || state === 'connecting') {

// After - also protect 'new' state:
if (state === 'connected' || state === 'connecting' || state === 'new') {
```

**Status:** APPLIED

---

## Debugging Checklist

If still flickering, check:

1. [ ] Is the video element being recreated? (Check if `remoteVideoElementsRef.current.get(id)` returns undefined when it shouldn't)
2. [ ] Is the cache being cleared? (Check if `participantCanvasCacheRef.current.get(id)` returns undefined)
3. [ ] Is the role changing? (Add console.log to check `p.role` in render loop)
4. [ ] Is the stream object changing? (Check if `p.stream.id` changes)
5. [ ] Is readyState fluctuating? (Log `p.video.readyState` in render loop)
6. [ ] Is videoWidth/videoHeight 0? (Log these values)

---

## Console Logging to Add for Debugging

Add this inside the render loop to debug:
```javascript
console.log('[Render] Participant:', p.id, {
  videoReady,
  hasCache: !!cache,
  cacheLastFrame: cache?.lastFrameTime,
  canDrawFromCache,
  videoReadyState: p.video?.readyState,
  videoWidth: p.video?.videoWidth,
  hasSrcObject: !!p.video?.srcObject,
});
```

---

### Change 13: Fix ICE Candidate Queueing in Guest Stream (Guest Cannot Connect)
**File:** `frontend/src/hooks/guest/useGuestStream.ts`
**Lines:** 43-44, 63-65, 72-88, 243-253

**Problem:** Guest stream (guest camera -> host) was failing to connect. The connection would go from "connecting" to "failed" state. Meanwhile, the preview stream (host -> guest) worked fine.

**Root Cause from Logs:**
```
[GuestStream] Sending offer to host
[GuestStream] Received answer from host - connection in progress
[GuestStream] Remote description set successfully, waiting for WebRTC connection...
[GuestStream] Connection state: connecting
[PreviewStream] Connection state: connected  <-- Preview works
[GuestStream] Connection state: failed  <-- Guest->Host fails
```

The issue was in the ICE candidate handling flow:
1. Guest creates peer connection and calls `setLocalDescription(offer)` (line ~113)
2. ICE candidates start gathering immediately after `setLocalDescription`
3. `onicecandidate` callback fires, but it checks `hostStreamSocketIdRef.current` before sending
4. **BUG:** `hostStreamSocketIdRef.current` is only set when the answer is received (line ~217)
5. Result: All ICE candidates gathered before the answer arrives are **dropped** because `hostStreamSocketIdRef.current` is null

The preview stream worked because it receives the offer first (with hostSocketId), then creates the answer - so the socket ID is available when ICE candidates are gathered.

**Fix:**
1. Added a queue for pending ICE candidates: `pendingIceCandidatesRef`
2. In `onicecandidate`: if no hostSocketId yet, queue the candidate instead of dropping it
3. When answer is received and hostSocketId is set, flush all queued candidates to the host
4. Clear the queue when creating a new connection (for retries)

```javascript
// Added ref for pending candidates
const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

// In setupGuestStream, clear queue for new connection:
pendingIceCandidatesRef.current = [];
hostStreamSocketIdRef.current = null;

// In onicecandidate handler:
if (event.candidate) {
  const candidateJson = event.candidate.toJSON();
  if (hostStreamSocketIdRef.current) {
    // Have host socket ID, send immediately
    socketService.emit('guest-stream-ice-candidate', {...});
  } else {
    // Queue until we receive answer with host socket ID
    console.log('[GuestStream] Queueing ICE candidate (waiting for host socket ID)');
    pendingIceCandidatesRef.current.push(candidateJson);
  }
}

// After setting remote description in handleGuestStreamAnswer:
if (pendingIceCandidatesRef.current.length > 0) {
  console.log(`[GuestStream] Flushing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
  pendingIceCandidatesRef.current.forEach((candidate) => {
    socketService.emit('guest-stream-ice-candidate', {
      targetSocketId: hostStreamSocketIdRef.current,
      candidate,
    });
  });
  pendingIceCandidatesRef.current = [];
}
```

**Status:** APPLIED

---
