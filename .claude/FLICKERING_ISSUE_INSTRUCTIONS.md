# IMPORTANT: Video Flickering Issue Instructions

## BEFORE MAKING ANY CHANGES

1. **READ THE LOG FIRST**: Check `/home/user/streamlick/FLICKERING_FIX_TRACKING.md` for:
   - Historical commits that have already been tried
   - Current session changes
   - Debugging checklist
   - What has and hasn't worked

2. **DO NOT REPEAT FAILED FIXES**: The following approaches have been tried and DID NOT fix the flickering:
   - Stricter readyState checks (>= 2, >= 3)
   - Stability tracking (counting stable frames before drawing)
   - Per-participant offscreen canvas caching
   - Always drawing from cache buffer
   - Role preservation during polling
   - Speaking state optimization
   - Cleanup prevention in useEffect

3. **KEY FACTS**:
   - Preview tiles work FINE (no flickering)
   - Stage canvas FLICKERS
   - Same WebRTC stream is used in both
   - The difference is: Preview uses direct `<video>` element, Stage uses `canvas.drawImage()`

## Process of Elimination

Before trying a new fix:
1. Check if it's in the historical commits table
2. Check if it's similar to something already tried
3. Add your change to the tracking doc BEFORE committing
4. If it doesn't work, mark it as TRIED in the tracking doc

## Key Files

- `frontend/src/components/studio/canvas/StudioCanvas.tsx` - Main canvas rendering
- `frontend/src/hooks/studio/useParticipants.ts` - Participant state management
- `frontend/src/hooks/studio/useGuestStreams.ts` - WebRTC stream handling
- `frontend/src/hooks/studio/useAudioLevel.ts` - Audio level detection

## Debugging

Add console logs to see:
```javascript
console.log('[Render] Participant:', p.id, {
  videoReady,
  hasCache: !!cache,
  cacheLastFrame: cache?.lastFrameTime,
  videoReadyState: p.video?.readyState,
  videoWidth: p.video?.videoWidth,
  hasSrcObject: !!p.video?.srcObject,
  role: p.participant?.role,
});
```

## Untried Approaches (Potential Next Steps)

1. Skip canvas entirely for remote participants - render a real `<video>` element on top
2. Use a WebGL canvas instead of 2D canvas
3. Double-buffer with two canvases
4. Investigate if drawImage is silently failing
5. Check if the video element is being garbage collected
