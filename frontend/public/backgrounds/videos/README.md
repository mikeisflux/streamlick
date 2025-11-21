# StreamLick Intro Video

This directory contains the intro video that plays at the start of every broadcast.

## Required File

**File Name:** `StreamLick.mp4`
**Location:** `frontend/public/backgrounds/videos/StreamLick.mp4`
**Duration:** Approximately 10 seconds (to match the countdown timer)
**Recommended Specs:**
- Resolution: 1920x1080 (1080p) or 3840x2160 (4K)
- Format: MP4 (H.264 video codec, AAC audio codec)
- Frame Rate: 30fps or 60fps
- Bitrate: 5-10 Mbps for 1080p, 15-25 Mbps for 4K

## How It Works

1. When a user clicks "Go Live", the countdown starts (default: 10 seconds)
2. The intro video (`StreamLick.mp4`) plays automatically during the countdown
3. The intro video is overlaid on the compositor canvas
4. After 10 seconds (or when the video ends), the overlay is cleared
5. The stream transitions to the user's live feed (webcam/screen share)

The intro video plays for:
- ✅ RTMP streams to YouTube, Twitch, Facebook, etc.
- ✅ Local recordings
- ✅ All broadcasts, regardless of destination

## Upload Instructions

### Option 1: Direct Upload (Recommended)
```bash
# From your local machine, copy the video file to the server
scp /path/to/your/StreamLick.mp4 user@your-server:/path/to/streamlick/frontend/public/backgrounds/videos/

# Or if using Docker, copy to the container
docker cp /path/to/your/StreamLick.mp4 streamlick-frontend:/app/public/backgrounds/videos/
```

### Option 2: Using Git
```bash
# Add the video file to git (if it's not too large)
cd /path/to/streamlick
git add frontend/public/backgrounds/videos/StreamLick.mp4
git commit -m "Add StreamLick intro video"
git push
```

**Note:** Video files can be large. If your file is larger than 100MB, consider using Git LFS (Large File Storage) or Option 1 instead.

### Option 3: Download from a URL
```bash
# Download directly to the server
cd /path/to/streamlick/frontend/public/backgrounds/videos/
wget https://your-cdn.com/StreamLick.mp4
# or
curl -o StreamLick.mp4 https://your-cdn.com/StreamLick.mp4
```

## Customization

### Change Intro Video Duration
Edit the countdown timer in your `.env` file:
```bash
# Set countdown to match your intro video duration (in seconds)
BROADCAST_COUNTDOWN_SECONDS=10
```

### Use a Different Video
To use a different intro video:

1. **Replace the file:** Upload your video as `StreamLick.mp4` (same name)

2. **Or modify the code:** Edit `frontend/src/hooks/studio/useBroadcast.ts`:
   ```typescript
   // Change line ~182 from:
   compositorService.playIntroVideo('/backgrounds/videos/StreamLick.mp4', 10)

   // To your custom video:
   compositorService.playIntroVideo('/backgrounds/videos/YourCustomIntro.mp4', 15)
   ```

### Disable Intro Video
To disable the intro video completely:

**Option 1:** Remove or comment out the intro video line in `frontend/src/hooks/studio/useBroadcast.ts`:
```typescript
// compositorService.playIntroVideo('/backgrounds/videos/StreamLick.mp4', 10).catch(...);
```

**Option 2:** Set countdown to 0 seconds in `.env`:
```bash
BROADCAST_COUNTDOWN_SECONDS=0
```

## Troubleshooting

### Intro video doesn't play
- Check that the file exists: `ls -la frontend/public/backgrounds/videos/StreamLick.mp4`
- Check browser console for errors (F12 → Console tab)
- Verify file format is MP4 with H.264 video codec
- Check file permissions: `chmod 644 frontend/public/backgrounds/videos/StreamLick.mp4`

### Video is choppy or laggy
- Reduce video resolution (use 1080p instead of 4K)
- Reduce bitrate to 5 Mbps
- Ensure video is properly encoded with H.264 codec

### Audio doesn't play
- Check that audio codec is AAC
- Verify browser allows autoplay with audio
- Check compositor audio settings in browser

### Video doesn't match countdown
- Adjust `BROADCAST_COUNTDOWN_SECONDS` in `.env` to match video duration
- Or edit the duration parameter in `playIntroVideo()` call

## Technical Details

The intro video is rendered via the compositor service:
- **Service:** `frontend/src/services/compositor.service.ts`
- **Method:** `playIntroVideo()`
- **Overlay:** Uses `setMediaClipOverlay()` to render video on canvas
- **Transition:** Automatically clears overlay when video ends
- **Integration:** Called from `handleGoLive()` in `useBroadcast.ts`

The video is drawn on the compositor canvas at full resolution, maintaining aspect ratio and centered on the canvas (3840x2160 by default).
