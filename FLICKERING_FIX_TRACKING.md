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

### Change 14: Fix Connection Closed During Negotiation
**File:** `frontend/src/hooks/guest/useGuestStream.ts`
**Lines:** 20-22, 54-88, 117-125, 198-224

**Problem:** WebRTC-internals showed `ICE connection state: new => "closed"` - connections were being closed before ICE negotiation even started. The aggressive retry logic (every 3 seconds) was closing connections that were still negotiating.

**Root Cause from webrtc-internals:**
```
ICE connection state: new => "closed"
Connection state: new => "closed"
ICE Candidate pair: (empty)
ICE candidate grid: (empty)
```

The `setupGuestStream` function unconditionally closed existing connections:
```javascript
if (guestStreamPcRef.current) {
  guestStreamPcRef.current.close();  // Killed connections mid-negotiation!
}
```

When retry fired (every 3 seconds), if an answer was in transit, the connection got killed before ICE negotiation could complete.

**Fix:**
1. Added guards in `setupGuestStream` to protect active connections:
   - Skip if connection state is 'connected' or 'connecting'
   - Skip if ICE connection state is 'checking'
   - Skip if answer was received and connection is still in 'new' state (ICE pending)

2. Added ICE state logging for debugging:
   - `oniceconnectionstatechange` handler
   - `onicegatheringstatechange` handler

3. Increased retry delays to give more time for negotiation:
   - `GUEST_STREAM_RETRY_DELAY`: 3s → 5s
   - `ACTIVE_POLLING_INTERVAL`: 5s → 8s
   - `GUEST_STREAM_MAX_RETRIES`: 10 → 5

```javascript
const setupGuestStream = async (forceNew = false) => {
  // Check if we should skip creating a new connection
  if (guestStreamPcRef.current && !forceNew) {
    const state = guestStreamPcRef.current.connectionState;
    const iceState = guestStreamPcRef.current.iceConnectionState;

    if (state === 'connected') {
      console.log('[GuestStream] Already connected, skipping new connection');
      return;
    }
    if (state === 'connecting' || iceState === 'checking') {
      console.log('[GuestStream] Connection in progress, skipping new connection');
      return;
    }
    if (guestStreamAnswerReceivedRef.current && (state === 'new' || iceState === 'new')) {
      console.log('[GuestStream] Answer received, ICE negotiation pending, skipping');
      return;
    }
  }
  // ... rest of function
};
```

**Status:** APPLIED

---

### Change 15: Add TURN Server Support
**Files:**
- `frontend/src/config/webrtc.ts` (NEW)
- `frontend/.env.example`
- `frontend/src/hooks/guest/useGuestStream.ts`
- `frontend/src/hooks/guest/usePreviewStream.ts`
- `frontend/src/hooks/studio/useGuestStreams.ts`
- `frontend/src/hooks/studio/usePreviewStream.ts`
- `turn/` directory (NEW)

**Problem:** STUN servers alone only work when at least one peer has a "nice" NAT. For guests worldwide behind symmetric NATs, WebRTC connections will fail without TURN servers.

**Fix:**
1. Created centralized ICE server configuration (`frontend/src/config/webrtc.ts`)
2. Added environment variables for TURN server configuration
3. Updated all WebRTC hooks to use shared ICE config
4. Created `/turn` directory with deployment scripts for Ubuntu/systemd

**Environment Variables (add to frontend/.env):**
```
VITE_TURN_SERVER_URL=turn://your-turn-server:3478
VITE_TURN_SERVER_USERNAME=streamlick
VITE_TURN_SERVER_CREDENTIAL=your-password
```

**Admin Panel:** TURN servers can be deployed via Admin → Infrastructure → TURN Servers tab

**Manual Deploy:** Use `/turn/deploy.sh` on Ubuntu server

**Status:** APPLIED

---

### Change 16: Remove All Polling - Event-Driven WebRTC
**Files:**
- `frontend/src/hooks/studio/useParticipants.ts`
- `frontend/src/hooks/studio/useStudioInitialization.ts`
- `frontend/src/hooks/guest/useGuestStream.ts`
- `backend/src/socket/handlers/greenroom.handlers.ts`

**Problem:** Constant `request-guest-streams` polling every 5 seconds was causing guests to resend their WebRTC offers, which reset connections and triggered adaptive bitrate to restart from low quality. This caused:
- Video resolution cycling (800 → 1200 → 1600 → 1200)
- Guest video flickering on the host's stage canvas
- Server logs showing repeated "Host requesting all guests to resend stream offers"

**Root Cause:**
1. `useParticipants.ts` polled HTTP API every 5 seconds
2. Each poll emitted `request-guest-streams` if any guest lacked a stream
3. Backend sent `resend-stream-offer` to all guests
4. Guests re-created connections even when working ones existed
5. New connections started adaptive bitrate from low quality

**Fix - Event-Driven Architecture:**
1. **Removed HTTP polling** from `useParticipants.ts` - only initial fetch on mount
2. **Removed all `request-guest-streams` emissions** from frontend components
3. **Removed active polling** from `useGuestStream.ts` on guest side
4. **Added backend event** in `greenroom.handlers.ts` - when host enters greenroom, backend tells existing guests to resend offers (one-time)

**New Flow:**
```
Guest joins → auto-sends stream offer
Host joins → backend emits resend-stream-offer (one-time)
Guest receives resend → sends offer (if not already connected)
Host receives offer → creates connection
Connection established - no further polling
```

**Status:** APPLIED

---

### Change 17: Canvas Fallback Drawing for Remote Participants
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Lines:** ~483-500

**Problem:** When cache draw failed for remote participants, nothing was drawn (showing background color), causing flickering.

**Fix:** Added else-if branch to handle remote participants when cache is not available:
```javascript
} else if (p.type === 'remote' && p.videoEnabled) {
  // Try to draw directly from video if available
  if (videoReady && p.video) {
    ctx.drawImage(p.video, ...);
  } else {
    // Draw "Connecting..." placeholder
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(...);
    ctx.fillText('Connecting...', ...);
  }
}
```

**Status:** APPLIED

---

### Change 18: Auto-Reconnect for Frozen Connections
**Files:**
- `frontend/src/hooks/studio/useGuestStreams.ts`
- `frontend/src/hooks/guest/useGuestStream.ts`
- `backend/src/socket/handlers/greenroom.handlers.ts`

**Problem:** WebRTC connections would freeze after running fine for a while. No mechanism existed to recover frozen connections.

**Fix - Three-part solution:**

1. **Host side (useGuestStreams.ts):** When connection goes to 'disconnected' or 'failed', instead of just removing the stream:
   - Wait 5 seconds for natural recovery
   - If still disconnected, emit `request-guest-reconnect` to ask guest to reconnect
   - Wait 10 more seconds for guest to reconnect before removing stream

2. **Backend (greenroom.handlers.ts):** Added handler for `request-guest-reconnect`:
   - Sends `resend-stream-offer` directly to the specific guest socket

3. **Guest side (useGuestStream.ts):**
   - When receiving `resend-stream-offer` with frozen connection, force close old connection and create new one
   - Auto-reconnect: When connection fails/disconnects, automatically attempt reconnection after 5 seconds

**Status:** APPLIED

---
