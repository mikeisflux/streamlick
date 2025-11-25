# Compositor to FFmpeg Pipeline - Testing Guide

## Overview

This document outlines the compositor pipeline changes and provides testing guidance for debugging the mediasoup → FFmpeg → RTMP streaming flow.

## Changes Merged

### 1. Single FFmpeg Process with Tee Muxer
**File**: `media-server/src/rtmp/compositor-pipeline.ts`

**Previous Behavior**: Created separate FFmpeg processes for each RTMP destination
- Each destination had its own FFmpeg instance
- Each FFmpeg instance listened on its own RTP ports
- Could cause "Address already in use" errors

**New Behavior**: Single FFmpeg process with tee muxer for multiple outputs
- One FFmpeg process handles all destinations (lines 172-202)
- Uses tee muxer format to split output to multiple RTMP endpoints
- Listens on one set of RTP ports (video + audio)
- Tee output format: `[f=flv:flvflags=no_duration_filesize]rtmp://url1|[f=flv:flvflags=no_duration_filesize]rtmp://url2`

**Benefits**:
- Eliminates port conflicts
- Reduces CPU/memory usage
- Simplifies pipeline management
- Better error handling

### 2. Duplicate Event Protection
**File**: `media-server/src/index.ts`

**Issue**: Frontend was sending multiple `start-rtmp` events, causing duplicate FFmpeg processes

**Solution**: Added `isRtmpStreaming` flag to broadcast data structure
- Check if already streaming before starting (lines 524-530)
- Set flag immediately when starting (line 533)
- Clear flag on stop (line 623) and on error (line 599)

### 3. Enhanced Logging
**Files**:
- `media-server/src/index.ts` (lines 56-76, 509-606)
- `media-server/src/rtmp/compositor-pipeline.ts` (lines 148-327)

**Added**:
- Socket.io connection middleware logging
- Detailed start-rtmp event logging
- FFmpeg command line logging
- Comprehensive error logging with stdout/stderr
- Performance metrics logging (bitrate, fps)

### 4. Destination Deduplication
**Files**:
- `backend/src/api/broadcasts.routes.ts` (line 245)
- `frontend/src/hooks/studio/useStudioInitialization.ts`
- `frontend/src/components/DestinationsPanel.tsx`
- `frontend/src/hooks/studio/useBroadcast.ts`

**Changes**: Added `Array.from(new Set(destinationIds))` to prevent duplicate destinations

### 5. Environment Configuration Updates
**Files**:
- `docker-compose.yml` - Added missing media-server environment variables
- `.env.example` - Added MediaSoup configuration documentation

**New Required Variables**:
```bash
MEDIASOUP_ANNOUNCED_IP=127.0.0.1      # Server public IP for WebRTC
FRONTEND_URL=http://localhost:3002    # Frontend URL for CORS
EXTERNAL_FFMPEG=false                  # FFmpeg deployment mode
MEDIASOUP_WORKERS=2                    # Number of workers
MEDIASOUP_RTC_MIN_PORT=40000          # WebRTC port range start
MEDIASOUP_RTC_MAX_PORT=40100          # WebRTC port range end
LOG_LEVEL=info                         # Logging level
```

## Architecture Flow

```
Browser (WebRTC)
    ↓
MediaSoup Router
    ↓
Plain RTP Transports (video + audio)
    ↓ (RTP packets on localhost:videoPort, localhost:audioPort)
FFmpeg Process
    ├─ Input: RTP video stream
    ├─ Input: RTP audio stream
    ├─ Video: copy H264 (no re-encoding)
    ├─ Audio: transcode Opus → AAC
    └─ Output: Tee muxer → Multiple RTMP destinations
         ├─ rtmp://youtube-server/streamKey1
         ├─ rtmp://facebook-server/streamKey2
         └─ rtmp://twitch-server/streamKey3
```

## Testing Checklist

### Prerequisites
1. [ ] Docker and docker-compose installed
2. [ ] Ports available: 3000 (backend), 3001 (media-server), 3002 (frontend), 5432 (postgres), 6379 (redis)
3. [ ] WebRTC ports available: 40000-40100/udp
4. [ ] Valid RTMP destinations configured (YouTube, Twitch, Facebook, etc.)

### Environment Setup
1. [ ] Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```
2. [ ] Set `MEDIASOUP_ANNOUNCED_IP` to your server's public IP (or `127.0.0.1` for local testing)
3. [ ] Set `FRONTEND_URL` to match your frontend URL
4. [ ] Configure OAuth credentials for destination platforms

### Start Services
```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f media-server
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Test Cases

#### 1. Single Destination Streaming
**Objective**: Verify basic compositor pipeline works

1. [ ] Open frontend at http://localhost:3002
2. [ ] Create a new broadcast
3. [ ] Add ONE destination (e.g., YouTube)
4. [ ] Start webcam/screen share
5. [ ] Click "Go Live"
6. [ ] Check media-server logs for:
   - `Creating compositor pipeline for broadcast <id>`
   - `Plain transports created - Video: <port>, Audio: <port>`
   - `FFmpeg started for 1 destination(s)`
   - NO "Address already in use" errors
   - NO duplicate start-rtmp warnings
7. [ ] Verify stream appears on destination platform
8. [ ] Stop broadcast
9. [ ] Check logs for clean shutdown

**Expected Logs**:
```
[info] Creating compositor pipeline for broadcast abc123
[info] Plain transports created - Video: 50000, Audio: 50001
[info] FFmpeg deployment mode: LOCAL (same server)
[info] 🚀 FFmpeg started for 1 destination(s)
[info] ⚙️  Command: ffmpeg -protocol_whitelist file,rtp,udp ...
```

#### 2. Multiple Destination Streaming (Tee Muxer)
**Objective**: Verify tee muxer handles multiple destinations

1. [ ] Create new broadcast
2. [ ] Add THREE destinations (YouTube + Twitch + Facebook)
3. [ ] Start stream
4. [ ] Check logs for:
   - Single FFmpeg process
   - Tee muxer output with all 3 destinations
   - All destinations in command line
5. [ ] Verify stream appears on ALL platforms
6. [ ] Monitor CPU/memory usage (should be lower than 3 separate processes)

**Expected Logs**:
```
[info] Using tee muxer for 3 destinations
[info] 🚀 FFmpeg started for 3 destination(s)
[info]   📺 [1] youtube: rtmp://...
[info]   📺 [2] twitch: rtmp://...
[info]   📺 [3] facebook: rtmp://...
```

#### 3. Duplicate Event Protection
**Objective**: Verify duplicate start-rtmp events are ignored

1. [ ] Start broadcast
2. [ ] Open browser DevTools → Network tab
3. [ ] Click "Go Live" multiple times rapidly
4. [ ] Check media-server logs for:
   - Only ONE `Creating compositor pipeline` message
   - Warning messages: `RTMP already streaming, ignoring duplicate start-rtmp event`
   - Only ONE FFmpeg process started

**Expected Logs**:
```
[info] ✅ Marked broadcast as streaming
[warn] ⚠️  RTMP already streaming for broadcast abc123, ignoring duplicate start-rtmp event
```

#### 4. Error Recovery
**Objective**: Verify streaming flag is cleared on errors

1. [ ] Configure invalid RTMP destination (bad URL)
2. [ ] Start broadcast
3. [ ] Check logs for error
4. [ ] Verify `isRtmpStreaming` flag is cleared
5. [ ] Retry with valid destination
6. [ ] Should work on retry

**Expected Logs**:
```
[error] ❌ Start RTMP error: <error details>
[info] Cleared streaming flag due to error
```

#### 5. Destination Deduplication
**Objective**: Verify duplicate destinations are filtered

1. [ ] Add same destination twice in UI
2. [ ] Check browser console for warning: `Duplicate destinations detected`
3. [ ] Start stream
4. [ ] Verify only ONE stream to that destination
5. [ ] Check backend logs for deduplication

## Common Issues & Solutions

### Issue: "Address already in use" Error
**Symptom**: FFmpeg fails to start with EADDRINUSE error
```
[udp @ 0x...] bind failed: Address already in use
Error opening input file rtp://127.0.0.1:46404.
```

**Cause (FIXED in latest code)**:
- MediaSoup plain transport binds to RTP ports (e.g., 46404, 42132)
- FFmpeg using `rtp://127.0.0.1:46404` also tries to bind to same port
- Port binding conflict occurs

**Solution (Applied)**:
- Now using SDP (Session Description Protocol) files instead of direct RTP URLs
- SDP files describe the RTP streams without requiring FFmpeg to bind to ports
- MediaSoup sends RTP packets, FFmpeg receives them via SDP specification
- Check logs for: `SDP files created:` followed by paths to `/tmp/video_*.sdp` and `/tmp/audio_*.sdp`

**If issue persists**:
- Restart media-server container: `docker-compose restart media-server`
- Check for zombie FFmpeg processes: `ps aux | grep ffmpeg`
- Check for orphaned SDP files: `ls -la /tmp/*.sdp`

### Issue: No Video on RTMP Destination
**Symptom**: Stream starts but no video appears on platform
**Possible Causes**:
1. **Codec mismatch**: Check if platform supports H264 video
2. **Bitrate too high**: Platform may reject stream
3. **Invalid stream key**: Verify OAuth tokens are fresh

**Debug Steps**:
1. Check FFmpeg stderr output in logs
2. Verify RTP packets are flowing: Look for `bitrate=` and `fps=` in logs
3. Test RTMP URL with ffmpeg directly:
   ```bash
   ffmpeg -re -i test.mp4 -c copy -f flv rtmp://destination/streamKey
   ```

### Issue: Duplicate FFmpeg Processes
**Symptom**: Multiple FFmpeg processes for same broadcast
**Solution**: Verify duplicate guard is working (see Test Case 3)

### Issue: CORS Errors in Browser
**Symptom**: Socket.io connection fails with CORS error
**Solution**:
- Verify `FRONTEND_URL` in docker-compose matches actual frontend URL
- Check media-server logs for connection attempts

## Performance Monitoring

### Key Metrics to Watch
1. **CPU Usage**: Should be ~50-70% per stream with tee muxer (vs 150%+ with separate processes)
2. **Memory**: ~200-300MB per broadcast
3. **Network**: Monitor bitrate in logs (should be ~2-4 Mbps per destination)
4. **Frame Rate**: Should maintain 30 fps (check logs for fps metrics)

### Monitoring Commands
```bash
# CPU and memory usage
docker stats streamlick-media

# FFmpeg processes
docker exec streamlick-media ps aux | grep ffmpeg

# Real-time logs with metrics
docker-compose logs -f media-server | grep -E "bitrate=|fps="
```

## Next Steps for Debugging

If issues persist:

1. **Enable Debug Logging**:
   ```bash
   # In docker-compose.yml, set:
   LOG_LEVEL: debug
   ```

2. **Check Diagnostic Logs**:
   - Look for entries in diagnostic logger service
   - Check for RTP pipeline, FFmpeg, and transport errors

3. **Network Analysis**:
   ```bash
   # Monitor RTP traffic
   docker exec streamlick-media tcpdump -i lo -n udp port <videoPort>
   ```

4. **FFmpeg Direct Test**:
   ```bash
   # Test FFmpeg tee muxer directly
   ffmpeg -re -i test.mp4 \
     -c:v copy -c:a aac \
     -f tee \
     "[f=flv]rtmp://dest1/key1|[f=flv]rtmp://dest2/key2"
   ```

## Code References

- Compositor Pipeline: `media-server/src/rtmp/compositor-pipeline.ts`
- Socket Event Handlers: `media-server/src/index.ts:507-637`
- Broadcast Routes: `backend/src/api/broadcasts.routes.ts:245`
- Frontend Deduplication: `frontend/src/hooks/studio/useBroadcast.ts`

## Questions to Investigate

1. ✅ Does FFmpeg successfully connect to the RTP streams? **FIXED**: Now using SDP files
2. Are RTP packets being sent from mediasoup?
3. Is the tee muxer format correct?
4. Are all stream keys valid and fresh (OAuth tokens)?
5. Is the duplicate guard preventing race conditions?
6. ⚠️  **NEW**: Why are duplicate destinations appearing in logs? (See section below)

## Known Issue: Duplicate Destinations in Logs

### Observed Behavior
In recent testing, logs showed 11 destinations being sent to media-server, all with:
- Same destination ID: `8cc2531d-b3db-4c1d-9e88-781fb5a314ca`
- Same platform: `youtube`
- Different stream keys (11 different YouTube broadcast IDs)

### Expected Behavior
User selected ONE YouTube destination, should see:
- 1 destination in logs
- 1 YouTube broadcast created
- 1 stream key

### Deduplication Already In Place
Code has multiple layers of deduplication:
1. **Frontend - DestinationsPanel.tsx:147**: Deduplicates on toggle
2. **Frontend - useBroadcast.ts:133**: Deduplicates before API call
3. **Backend - broadcasts.routes.ts:275**: Deduplicates destinationIds array
4. **Frontend - useStudioInitialization.ts**: Deduplicates on load/save

### Investigation Needed
To debug this issue, we need to check:

1. **Frontend State Inspection**:
   ```javascript
   // In browser console on Studio page
   console.log('Selected destinations:', JSON.parse(localStorage.getItem('selectedDestinations')));
   ```

2. **Backend Logs** - Look for:
   ```
   [ASYNC IIFE] destinationIds: [...]
   [ASYNC IIFE] Processing X selected destinations
   [ASYNC IIFE] Found X active destinations in database
   ```
   Check if backend receives 11 IDs or just 1

3. **Network Tab** - Check POST request to `/broadcasts/start`:
   - Look at request payload
   - Check `destinationIds` array length
   - Verify no duplicate IDs in request

4. **Database Query**:
   ```sql
   SELECT destination_id, COUNT(*) as count
   FROM broadcast_destinations
   WHERE broadcast_id = '<broadcast-id>'
   GROUP BY destination_id
   HAVING COUNT(*) > 1;
   ```
   Check if database has duplicate BroadcastDestination records

### Possible Causes
1. **Frontend State Corruption**: selectedDestinations array has duplicates before deduplication runs
2. **Race Condition**: Multiple rapid clicks adding same destination
3. **LocalStorage Corruption**: Cached state has duplicates
4. **Backend Loop Bug**: YouTube broadcast creation happening in a loop

### Temporary Workaround
If you see multiple destinations when only one was selected:
1. Clear browser localStorage: `localStorage.clear()`
2. Refresh page
3. Reconnect destinations
4. Select destinations again

### Next Steps
1. Test with latest code (SDP fix applied)
2. Monitor browser console for deduplication warnings
3. Check backend logs for destinationIds array
4. Report back with findings
