# Streamlick – Full Architecture Documentation (2025)  
**The Privacy-First, Zero-Storage, No-OBS, Pure-Browser Live Studio**

## Overview
Streamlick is a complete multi-guest live streaming studio that runs **100 % in the browser** with **zero media ever touching your servers**.  
Everything — compositing, layouts, name tags, screen sharing, recording, and broadcasting — happens locally on each participant’s machine.

This is the same architecture used by Riverside.fm “Studio”, Tella Live, mmhmm Live, and the most advanced indie tools in 2025.

## High-Level Architecture Diagram

    Guests + Host (Chrome 118+ / Edge 118+ / Safari 17+)
               │
               │ HTTPS + WSS (only signaling & tiny JSON)
               ▼
    ┌─────────────────────────────────┐
    │   Signaling Server              │
    │   Node.js + Socket.IO or WS     │← Only SDP, ICE, room metadata, layout changes
    │   (a few KB/sec per user)       │
    └───────────────┬─────────────────┘
                    │
                    ▼
    ┌─────────────────────────────────┐          ┌─────────────────────┐
    │   Mediasoup SFU (or LiveKit)    │◄──────►│   coturn (TURN/STUN)│← NAT traversal only
    │   Docker/K8s or PM2 workers     │ P2P    │   Public UDP ports  │  No recording
    └───────┬──────────────────┬──────┘ fails  └─────────────────────┘
            │                  │
            ▼                  ▼
    Every participant receives ALL raw tracks (camera + mic + screen share)
            │
            ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │               React + TypeScript Frontend (identical in every browser)│
    │  • One master <canvas> (1920×1080 or 1280×720)                     │
    │  • Hidden <video> elements for every local & remote track         │
    │  • 60 fps requestAnimationFrame compositing loop                  │
    │  • Full layout engine (grid, spotlight, PiP, side-by-side, custom) │
    │  • Name tags, speaking indicators, virtual backgrounds            │
    │  • Host changes layout → instantly synced to everyone via signaling│
    └──────────────────────┬──────────────────────┬──────────────────────┘
                           │                      │
           LOCAL RECORDING │       LIVE BROADCAST │  (host or any participant)
      MediaRecorder on canvas│  canvas.captureStream()│
      → .webm/.mp4 downloaded│  → WHIP or RTMP direct  │
         to user’s machine   │     from browser        │
                           │                      │
                           ▼                      ▼
             YouTube • Facebook • Twitch • LinkedIn • TikTok • X • Custom CDN

## Feature Matrix – Streamlick vs StreamYard (2025)

| Feature                        | Streamlick | StreamYard | Notes |
|--------------------------------|------------|------------|-------|
| Multi-guest studio (10–20+)    | Yes        | Yes        | Mediasoup SFU |
| Screen sharing (multiple)      | Yes        | Yes        | getDisplayMedia() as separate tracks |
| Dynamic layouts & spotlight    | Yes        | Yes        | Host-controlled, synced via signaling |
| Name tags & lower-thirds       | Yes        | Yes        | Canvas-drawn |
| Virtual backgrounds            | Yes        | Yes        | BodyPix / MediaPipe or static image |
| Local high-quality recording   | Yes        | Yes (paid) | MediaRecorder on canvas → direct download |
| Live RTMP/WHIP broadcasting    | Yes        | Yes        | Direct from browser (no OBS) |
| Zero server-side media storage | Yes        | No         | Huge privacy win |
| No desktop app / OBS required  | Yes        | No         | Pure browser experience |

## Core Code Snippets

### Canvas Compositing Loop (runs in every browser)
```tsx
useEffect(() => {
  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    currentLayout.positions.forEach((pos, i) => {
      const participant = participants[i];
      if (!participant?.videoElement) return;

      ctx.drawImage(participant.videoElement, pos.x, pos.y, pos.w, pos.h);

      // Name tag + speaking indicator
      ctx.fillStyle = participant.isSpeaking ? '#00ff00' : '#1a1a1a';
      ctx.fillRect(pos.x, pos.y + pos.h - 50, 220, 50);
      ctx.fillStyle = 'white';
      ctx.font = '28px Inter';
      ctx.fillText(participant.name, pos.x + 16, pos.y + pos.h - 12);
    });
    requestAnimationFrame(render);
  };
  render();
}, [participants, currentLayout]);
