# Video Flickering Fix - Status Tracking

## Problem Summary
Guest video flickering on the stage canvas, while preview tiles work correctly.

## Root Causes Identified

### 1. Audio Analyzer Recreation (FIXED)
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Issue:** Audio analyzers were being torn down and recreated every time `remoteParticipants` changed (every 5 seconds from poll + socket events)
**Fix:**
- Store audio contexts in a ref that persists across re-renders
- Only create new analyzers if stream changed or analyzer doesn't exist
- Only cleanup on component unmount, not on every dependency change

### 2. Video Element Cleanup (FIXED)
**File:** `frontend/src/components/studio/canvas/StudioCanvas.tsx`
**Issue:** The cleanup function in the video element management useEffect was clearing ALL video elements and canvas cache every time `remoteParticipants` changed
**Fix:**
- Changed cleanup to only run on component unmount
- Added separate unmount-only useEffect for cleanup
- Specific items are removed when participants leave (not all at once)

### 3. Role Preservation - Participants Sync (FIXED)
**File:** `frontend/src/hooks/studio/useParticipants.ts`
**Issue:** `handleParticipantsSync` was not preserving the 'guest' role when receiving sync events, causing role to reset to 'backstage'
**Fix:** Added same role preservation logic as poll handler:
```javascript
const apiRole = (p.role || 'backstage') as 'host' | 'guest' | 'backstage';
const role = existing?.role === 'guest' ? 'guest' : apiRole;
```

### 4. Role Preservation - Poll Handler (PREVIOUSLY FIXED)
**File:** `frontend/src/hooks/studio/useParticipants.ts`
**Status:** Already fixed in previous session

### 5. WebRTC Offer Handling (PREVIOUSLY FIXED)
**File:** `frontend/src/hooks/studio/useGuestStreams.ts`
**Status:** Already fixed - ignores offers if connection is already connected/connecting

---

## Files Modified

| File | Status | Changes |
|------|--------|---------|
| `frontend/src/components/studio/canvas/StudioCanvas.tsx` | MODIFIED | Fixed audio analyzer and video element cleanup |
| `frontend/src/hooks/studio/useParticipants.ts` | MODIFIED | Fixed role preservation in handleParticipantsSync |
| `frontend/src/hooks/studio/useAudioLevel.ts` | MODIFIED | Fixed 60 FPS re-renders - only update state when speaking status changes |

---

## Files Verified (No Issues Found)

| File | Status | Notes |
|------|--------|-------|
| `frontend/src/components/studio/canvas/PreviewArea.tsx` | OK | Uses direct video element with srcObject check |
| `frontend/src/components/VideoPreview.tsx` | OK | Has srcObject check |
| `frontend/src/hooks/studio/useGuestStreams.ts` | OK | Has connection state check to prevent reconnection |
| `frontend/src/components/guest/GuestGreenroom.tsx` | OK | Uses standard video rendering |
| `frontend/src/components/guest/GuestStreamPreview.tsx` | OK | Uses standard video rendering |
| `frontend/src/hooks/guest/useGuestStream.ts` | OK | Uses refs for state, no React re-renders |
| `frontend/src/hooks/studio/useBroadcast.ts` | OK | Interval only runs during recording, properly cleaned up |
| `frontend/src/hooks/studio/useFeatureLifecycles.ts` | OK | Intervals only run when enabled, properly cleaned up |
| `frontend/src/components/RecordingControls.tsx` | OK | Interval uses ref, properly cleaned up |
| `frontend/src/components/ProducerMode.tsx` | OK | Animation frames properly managed with cleanup |
| `frontend/src/components/CountdownTimer.tsx` | OK | Interval properly cleaned up |
| `frontend/src/components/ClipManager.tsx` | OK | Interval stored in ref, properly cleaned up |
| `frontend/src/components/ViewerCount.tsx` | OK | Interval cleaned up on dependency change |
| `frontend/src/pages/Studio.tsx` | OK | useEffects have proper dependencies and cleanups |
| `frontend/src/hooks/studio/useChatOverlay.ts` | OK | Animation frames only during active drag/resize |

---

## Testing Checklist

- [ ] Guest joins greenroom - preview appears without flickering
- [ ] Guest promoted to stage - canvas shows guest without flickering
- [ ] Host refreshes page - guests reconnect without flickering
- [ ] Multiple guests on stage - all stable
- [ ] Audio levels detected correctly for speaking indicators
- [ ] Guest demoted to backstage - removed from canvas cleanly

---

## Remaining Potential Issues

1. **Video readyState check**: Currently uses `readyState >= 3` which may be too strict. Consider relaxing to `>= 2`

2. **Stability tracking**: The stability counter system may be over-engineered. Consider simplifying if issues persist.

3. **Canvas cache recreation**: If layout size changes by >10px, cache is recreated. May cause brief flicker during resize.
