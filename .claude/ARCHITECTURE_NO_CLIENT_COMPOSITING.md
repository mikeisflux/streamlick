# CRITICAL ARCHITECTURE RULE: NO CLIENT-SIDE CANVAS COMPOSITING

## IMPORTANT - READ BEFORE MAKING ANY CHANGES

**StreamLick uses a SERVER-SIDE ONLY compositing architecture.**

All video compositing (combining multiple participant streams into a single output) is handled by the Ant Media Server via the Media Push Plugin, NOT in the browser.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ANT MEDIA SERVER                         │
│                                                                 │
│  Host Camera ─────► WebRTC Publish ─────► Participant Streams   │
│  Guest Cameras ───► WebRTC Publish ─────►        │              │
│                                                  ▼              │
│                              streamlick_composite.html          │
│                              (Headless Chrome via Media Push)   │
│                                       │                         │
│                                       ▼                         │
│                              Composite Stream                   │
│                              (${broadcastId}_composite)         │
│                                       │                         │
│                                       ▼                         │
│                              RTMP to YouTube/Twitch/etc         │
└─────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        HOST BROWSER                             │
│                                                                 │
│  CompositePreview.tsx ◄──── WebRTC Subscribe ◄── Composite      │
│  (Shows what viewers see)                         Stream        │
│                                                                 │
│  PreviewArea.tsx ◄──── Individual camera feeds for backstage    │
│  (Manage who is on stage)                                       │
│                                                                 │
│  *** NO CANVAS COMPOSITING IN BROWSER ***                       │
│  *** NO StudioCanvas.tsx ***                                    │
│  *** NO canvas.drawImage() for compositing ***                  │
└─────────────────────────────────────────────────────────────────┘
```

## DO NOT

1. **DO NOT** add any code that composites multiple video streams in the browser
2. **DO NOT** use `canvas.drawImage()` to combine participant videos
3. **DO NOT** use `canvas.captureStream()` to create an output stream
4. **DO NOT** re-enable or import `StudioCanvas.tsx`
5. **DO NOT** add any local canvas rendering for the main preview

## DO

1. **DO** use `CompositePreview.tsx` to display the server-side composite
2. **DO** use `PreviewArea.tsx` for individual camera previews (backstage management)
3. **DO** modify `media-server/webapps/LiveApp/streamlick_composite.html` for layout/rendering changes
4. **DO** send layout commands to the server composite via WebRTC data channel or REST API

## Why Server-Side Compositing?

1. **Consistent output** - Host sees exactly what viewers see
2. **CPU offload** - Host's browser doesn't burn CPU on compositing
3. **Independence** - Broadcast continues even if host disconnects
4. **Quality** - Server has stable resources for consistent output
5. **No flickering** - Server rendering is more stable than browser canvas

## Key Files

- `frontend/src/components/studio/canvas/CompositePreview.tsx` - Subscribes to server composite
- `media-server/webapps/LiveApp/streamlick_composite.html` - Server-side compositor
- `backend/src/api/antmedia.routes.ts` - Media Push Plugin control endpoints

## If You Need to Change Layouts/Effects

Modify the server-side compositor:
1. Edit `media-server/webapps/LiveApp/streamlick_composite.html`
2. Deploy to Ant Media server: `/usr/local/antmedia/webapps/LiveApp/`
3. The compositor receives commands via:
   - URL parameters (initial config)
   - WebRTC data channel (real-time updates)
   - REST API via Media Push Plugin

## Last Updated
- Date: 2026-01-17
- Reason: Removed all client-side canvas compositing, enforcing server-only architecture
