# Claude Code Instructions for StreamLick

## Standard Procedures

### 1. Progress Report Maintenance
**ALWAYS** update `PROGRESS_REPORT.md` when:
- Encountering a new bug/issue
- Implementing a fix
- Discovering root causes
- Making commits

Before attempting any fix, **CHECK** `PROGRESS_REPORT.md` to see if:
- The issue has been encountered before
- A fix was already attempted
- There are known workarounds

### 2. Commit Tracking
After every commit, add an entry to `PROGRESS_REPORT.md` with:
- Issue description
- Root cause analysis
- Fix applied
- Commit hash
- Files modified

### 3. Debugging WebRTC/Video Issues
When debugging video streaming issues:
1. Check console logs for these patterns:
   - `[HTMLPreviewVideo]` - Main canvas video
   - `[PreviewVideo]` - Preview tile video
   - `[StudioCanvas]` - Canvas render loop
   - `[WebRTC-LiveKit]` - LiveKit connection
   - `[Studio]` - Stream matching
2. Verify participant IDs are UUIDs (not timestamp-based)
3. Check if track IDs are changing on reconnect
4. Verify `hadStream` values in logs

### 4. Audio Configuration Reference
| Source | Destination | Config |
|--------|-------------|--------|
| Host Mic | Broadcast only | `playLocally: false` |
| Guest Audio | Broadcast + Host Speakers | `playLocally: true` |
| Muting | Track enable/disable | `track.enabled = !track.enabled` |

## Project Architecture

### LiveKit SFU Flow
```
All Participants → LiveKit SFU → All Participants
                        ↓
              Host composites locally
                        ↓
                 RTMP/WHIP Output
```

### Key Services
- `webrtc.service.ts` - LiveKit room connection
- `audio-mixer.service.ts` - Audio routing and mixing
- `canvas-stream.service.ts` - Canvas capture for RTMP
- `broadcast-output.service.ts` - RTMP/WHIP streaming

### Key Components
- `StudioCanvas.tsx` - Main broadcast canvas (renders participants)
- `PreviewArea.tsx` - Greenroom/backstage preview tiles
- `Studio.tsx` - Main studio page, handles stream callbacks

## Known Issues & Workarounds

### LiveKit Initial Connection Failure
LiveKit connection fails on first attempt with "v1 RTC path not found" but succeeds on retry. This is a known issue - the client automatically retries.

### Video Track Changes
When guests reconnect or LiveKit switches simulcast quality, video tracks change but the MediaStream object reference stays the same. Components must track individual track IDs, not just stream references.

## Branch Information
Current development branch: `claude/merge-webcam-participant-id-2INUk`

## Quick Commands
```bash
# Build frontend
cd frontend && npx vite build

# Check LiveKit status (on media server)
pm2 show livekit
cat /etc/livekit/livekit.yaml

# View LiveKit logs
pm2 logs livekit
```
