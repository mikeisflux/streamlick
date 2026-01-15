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
   - `[WebRTC-AntMedia]` - Ant Media connection
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

### Ant Media SFU Flow
```
All Participants → Ant Media SFU → All Participants
                        ↓
              Host composites locally
                        ↓
                 RTMP/WHIP Output
```

### Key Services
- `webrtc.service.ts` - Ant Media WebRTCAdaptor connection
- `audio-mixer.service.ts` - Audio routing and mixing
- `canvas-stream.service.ts` - Canvas capture for RTMP
- `broadcast-output.service.ts` - RTMP/WHIP streaming

### Key Components
- `StudioCanvas.tsx` - Main broadcast canvas (renders participants)
- `PreviewArea.tsx` - Greenroom/backstage preview tiles
- `Studio.tsx` - Main studio page, handles stream callbacks

## Known Issues & Workarounds

### Video Track Changes
When guests reconnect or simulcast quality changes, video tracks may change but the MediaStream object reference stays the same. Components must track individual track IDs, not just stream references.

### Ant Media REST API
The backend proxies Ant Media REST API calls. The frontend never connects directly to the Ant Media REST API - all conference management goes through the Streamlick backend.

## Branch Information
Current development branch: `claude/merge-previewarea-typescript-04F8x`

## Quick Commands
```bash
# Build frontend
cd frontend && npx vite build

# Check Ant Media status (on media server)
systemctl status antmedia

# View Ant Media logs
tail -f /usr/local/antmedia/log/ant-media-server.log

# Ant Media REST API base URL
# https://media.streamlick.com:5443/LiveApp/rest/v2/
```

## Environment Variables

### Frontend (.env)
```
VITE_ANTMEDIA_URL=https://media.streamlick.com
VITE_ANTMEDIA_WS_URL=wss://media.streamlick.com:5443/LiveApp/websocket
VITE_ANTMEDIA_APP=LiveApp
```

### Backend (.env)
```
ANTMEDIA_URL=https://media.streamlick.com:5443
ANTMEDIA_APP=LiveApp
```
