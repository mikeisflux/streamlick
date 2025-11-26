# Daily Bot Implementation Notes

## Overview

The Daily Bot service allows the media server to join a Daily room as a participant and stream the mediasoup composite to Daily for RTMP encoding.

## Architecture

```
Mediasoup RTP Streams → Daily Bot → Daily Room → RTMP → YouTube
```

## Current Status

### ✅ Completed
- Daily call object creation
- Room joining logic
- Event listeners
- startLiveStreaming() / stopLiveStreaming() methods

### ❌ Missing: RTP → MediaStreamTrack Bridge

**The critical missing piece is converting mediasoup RTP streams into MediaStreamTracks that Daily can consume.**

Daily's `setInputDevicesAsync()` expects:
- `videoSource`: MediaStreamTrack (video)
- `audioSource`: MediaStreamTrack (audio)

Mediasoup provides:
- Plain RTP transports sending raw RTP packets

## Implementation Options

### Option A: Use `wrtc` (node-webrtc)

Install `wrtc` to get WebRTC APIs in Node.js:

```bash
npm install wrtc
```

Then create MediaStreamTracks from RTP:

```typescript
import { nonstandard } from 'wrtc';
const { RTCAudioSource, RTCVideoSource } = nonstandard;

// Create sources
const videoSource = new RTCVideoSource();
const audioSource = new RTCAudioSource();

// Feed RTP packets from mediasoup to the sources
// (requires parsing RTP packets and extracting frames)

// Get tracks
const videoTrack = videoSource.createTrack();
const audioTrack = audioSource.createTrack();

// Set in Daily
await dailyBot.setCustomTracks(videoTrack, audioTrack);
```

**Challenges:**
- `wrtc` has native dependencies (requires compilation)
- Complex RTP packet parsing
- Performance overhead

### Option B: Use Frontend Integration (SIMPLER)

Instead of bridging RTP on the server, have the **frontend** send the canvas stream directly to Daily:

```typescript
// Frontend code
const call = DailyIframe.createCallObject();
await call.join({ url: roomUrl, token });

// Get canvas stream (already exists)
const canvasStream = canvas.captureStream(30);

// Set as Daily input
await call.setInputDevicesAsync({
  videoSource: canvasStream.getVideoTracks()[0],
  audioSource: mixedAudioStream.getAudioTracks()[0],
});

// Start streaming
await call.startLiveStreaming({ rtmpUrl: 'rtmp://...' });
```

**Advantages:**
- No server-side RTP bridging needed
- Uses Daily exactly as documented
- Much simpler and more reliable
- No native dependencies

**Disadvantages:**
- Streaming control is on frontend
- Need to handle frontend disconnections

### Option C: Use FFmpeg (Already Implemented)

The codebase already has a fully working FFmpeg pipeline that:
- Consumes RTP from mediasoup
- Encodes to RTMP
- Sends to YouTube directly

This is in `compositor-pipeline.ts` lines 42-548.

## Recommendation

**For production: Use Option B (Frontend Integration) or Option C (FFmpeg).**

The server-side Daily bot (Option A) is technically possible but adds significant complexity and fragility for little benefit.

If you must use Daily:
1. Create Daily room on server (already works)
2. Pass room URL + token to frontend
3. Frontend joins and streams using Daily.js
4. Frontend calls `startLiveStreaming()`

This is the approach Daily documents and supports.

## Installation

If you want to attempt Option A:

```bash
cd media-server
npm install wrtc
```

Then implement the RTP → MediaStreamTrack bridge in `daily-bot.service.ts` at the `TODO` comment.

## Usage

```typescript
import { dailyBotService } from './services/daily-bot.service';

// Join room
await dailyBotService.joinRoom({
  roomUrl: 'https://streamlick.daily.co/room-name',
  token: 'meeting-token-here',
  backendApiUrl: 'https://api.streamlick.com',
  broadcastId: 'broadcast-id',
});

// Set tracks (requires RTP bridge - see above)
await dailyBotService.setCustomTracks(videoTrack, audioTrack);

// Start streaming
await dailyBotService.startLiveStreaming([
  { rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2', streamKey: 'your-key' }
]);

// Stop streaming
await dailyBotService.stopLiveStreaming();

// Leave room
await dailyBotService.leaveRoom();
```
