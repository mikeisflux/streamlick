# Vertical Video Simulcast - User Guide

**Auto-crop 16:9 to 9:16 for TikTok, Instagram Reels & YouTube Shorts**

---

## Overview

Vertical Video Simulcast automatically converts your horizontal 16:9 stream into a vertical 9:16 format in real-time, perfect for short-form vertical social media platforms. No need to manually crop or edit after streaming—Streamlick creates both formats simultaneously.

**Perfect for:**
- 📱 TikTok Live & TikTok clips
- 📸 Instagram Reels & Stories
- 🎬 YouTube Shorts
- 📲 Facebook/Meta vertical video
- 💬 Snapchat Stories
- 🎪 Any vertical social media content

**Key Features:**
- ✅ Real-time auto-cropping (16:9 → 9:16)
- ✅ Smart centering with smooth panning
- ✅ Multiple resolutions (1080x1920, 720x1280, 540x960)
- ✅ 30 FPS processing
- ✅ Separate MediaStream output
- ✅ Zero post-production required

**Competitive Advantage:**
StreamYard, Restream, and most competitors **DO NOT** support vertical simulcast. This feature is a **game-changer** for social media creators.

---

## How to Enable Vertical Simulcast

### Quick Enable (Bottom Control Bar)

1. **Find the pink phone icon** 📱 in the bottom-left control bar
2. **Click once** to enable vertical simulcast
3. **Success toast**: "Vertical simulcast enabled (1080x1920 9:16)"
4. **Pink button** turns bright when active

**That's it!** Your stream now outputs both 16:9 (horizontal) and 9:16 (vertical) simultaneously.

### Advanced Configuration (Settings Modal)

For resolution and quality settings:

1. **Click ⚙️ Settings** button (top-right corner)
2. **Scroll down** to "Vertical Video Simulcast (9:16)" section
3. **Toggle enable** if not already active
4. **Choose resolution:**

#### Resolution Options:

| Resolution | Quality | Use Case | File Size |
|-----------|---------|----------|-----------|
| **1080x1920** | Full HD | Best quality, TikTok/IG recommended | Large |
| **720x1280** | HD | Balanced quality & performance | Medium |
| **540x960** | SD | Lower-end devices, faster upload | Small |

**Recommended:** Use **1080x1920** for best quality on modern devices.

---

## Understanding Vertical Simulcast

### What Is Simulcast?

**Simulcast** means streaming multiple formats **simultaneously** from a single source.

**Traditional workflow (NO simulcast):**
1. Stream in 16:9 horizontal
2. Download recording
3. Manually crop to 9:16 in editor
4. Export vertical version
5. Upload to TikTok/Reels
6. **Total time:** 30-60 minutes of editing

**With Vertical Simulcast (Streamlick):**
1. Enable vertical simulcast
2. Stream once
3. **Both formats created instantly**
4. Download vertical version ready to upload
5. **Total time:** 0 minutes of editing

### How Auto-Cropping Works

**Input:** 16:9 horizontal stream (1920x1080)
```
┌────────────────────────────┐
│                            │
│     Horizontal Frame       │
│                            │
└────────────────────────────┘
```

**Output:** 9:16 vertical stream (1080x1920)
```
    ┌──────────┐
    │          │
    │          │
    │ Vertical │
    │  Crop    │
    │          │
    │          │
    │          │
    │          │
    └──────────┘
```

**Cropping Strategy:**
- **Center-focused:** Crops a 9:16 rectangle from the center
- **Subject detection:** Centers on faces/speakers (smart mode)
- **Smooth panning:** If subject moves, crop follows with smooth transition
- **No jarring cuts:** All movements are gradual

### Smart Centering

The vertical compositor uses **smart centering** to keep your content in frame:

**Example: Single speaker presentation**
```
Horizontal (16:9):        Vertical (9:16):
┌────────────────────────┐    ┌──────────┐
│       [Speaker]        │ →  │          │
│   Background stuff     │    │[Speaker] │
└────────────────────────┘    │          │
                              └──────────┘
                           (Centered on speaker)
```

**Example: Two speakers side-by-side**
```
Horizontal (16:9):              Vertical (9:16):
┌─────────────────────────────┐    ┌──────────┐
│ [Speaker1]   [Speaker2]     │ →  │[Speaker1]│
│                             │    │[Speaker2]│
└─────────────────────────────┘    │ (stacked)│
                                   └──────────┘
```

**The compositor automatically:**
- Detects the most active area
- Centers the crop on that area
- Pans smoothly when focus changes
- Maintains subject in frame

---

## Use Cases & Workflows

### Use Case 1: TikTok Live Streaming

**Scenario:** Stream live on TikTok with vertical video

**Workflow:**
1. Enable vertical simulcast (pink button)
2. Select **1080x1920** resolution (TikTok recommended)
3. Add TikTok as streaming destination
4. Use vertical stream output for TikTok
5. Horizontal stream for YouTube/Twitch simultaneously

**Benefit:** Stream to **both** vertical (TikTok) and horizontal (YouTube) platforms at once.

### Use Case 2: Create Reels from Live Stream

**Scenario:** Stream horizontally, extract vertical Reels clips

**Workflow:**
1. Enable vertical simulcast during live stream
2. Enable **Clip Recording** (buffer feature)
3. During stream, hit "Create Clip" for highlights
4. Clips are automatically generated in **both** formats
5. Download vertical clips ready for Reels/Shorts

**Benefit:** Zero post-production. Clips are instant and vertical-ready.

### Use Case 3: Podcast Clips for Social Media

**Scenario:** Record podcast, create vertical highlight clips

**Workflow:**
1. Enable vertical simulcast before recording
2. Record full podcast (multi-track if needed)
3. Note timestamps of great moments
4. Create clips at those timestamps
5. Vertical clips ready for TikTok/Reels promotion

**Benefit:** Promote your podcast with vertical clips on social media without editing.

### Use Case 4: Educational Content

**Scenario:** Teach a lesson, share vertical clips on Instagram

**Workflow:**
1. Enable vertical simulcast
2. Teach lesson (horizontal camera)
3. Vertical crop centers on you (the teacher)
4. Export vertical version
5. Upload to Instagram Reels/Stories

**Benefit:** Reach younger audiences on their preferred platforms.

### Use Case 5: Product Launches

**Scenario:** Launch product demo, maximize reach on all platforms

**Workflow:**
1. Enable vertical simulcast
2. Simultaneously stream to:
   - YouTube (horizontal 16:9)
   - TikTok (vertical 9:16)
   - Instagram (vertical 9:16)
3. Single stream, three platform outputs
4. Maximize audience reach

**Benefit:** Reach audiences across **all** major platforms with one stream.

---

## Tips & Best Practices

### Camera Positioning for Vertical Crop

**✅ Do:**
- **Center yourself** in the horizontal frame
- **Stay in the middle third** of the screen
- Use **portrait orientation** lighting (light from sides)
- **Avoid wide shots** (subject too small)
- **Test the crop** before going live

**❌ Don't:**
- Position yourself on far left/right (will be cut off)
- Use ultra-wide shots (subject gets tiny in vertical)
- Place important content on edges (will be cropped)
- Move rapidly left-right (crop panning can't keep up)

### Framing Guidelines

**Rule of Thirds for Vertical:**
```
Horizontal Frame:          Vertical Crop Area:
┌──────────────────┐       ┌─────┐
│                  │       │     │ ← Top third (headroom)
│    [Subject]     │   →   │ [S] │ ← Middle third (face)
│                  │       │     │ ← Bottom third (body)
└──────────────────┘       └─────┘
```

**Best framing:**
- **Head/shoulders:** Fills frame nicely
- **Waist-up:** Good for talk shows
- **Full body:** Only if subject is large in frame

**Avoid:**
- **Tiny subjects:** Far away shots don't work well
- **Horizontal groups:** 3+ people side-by-side (gets cut off)

### Lighting for Vertical

**Horizontal lighting:**
- Light from left and right
- Creates depth and dimension

**Vertical-optimized lighting:**
- **Key light:** Front-facing, slightly elevated
- **Fill light:** Soft light to reduce shadows
- **Rim light:** Optional, adds separation

**Why:** Vertical format has less width, so side lighting is less effective.

### Content Strategy

**Best content for vertical simulcast:**
- ✅ Single-speaker presentations
- ✅ Interviews (2 people, stacked vertically)
- ✅ Product demos (product centered)
- ✅ Educational tutorials
- ✅ Gaming (with webcam in corner)

**Less ideal:**
- ❌ Wide panel discussions (4+ people)
- ❌ Landscape-heavy content (scenic views)
- ❌ Screen shares with lots of horizontal detail

### Resolution Selection Guide

**1080x1920 (Full HD):**
- **Best for:** Final uploads to TikTok, IG Reels, YouTube Shorts
- **Quality:** Highest, crisp and clear
- **Performance:** Requires modern CPU (i7+)
- **Upload size:** Large files (~40 MB/min)

**720x1280 (HD):**
- **Best for:** Balanced quality and performance
- **Quality:** Very good, acceptable for most platforms
- **Performance:** Works on mid-range CPUs (i5)
- **Upload size:** Medium files (~20 MB/min)

**540x960 (SD):**
- **Best for:** Older computers, quick sharing
- **Quality:** Acceptable for mobile viewing
- **Performance:** Low CPU usage
- **Upload size:** Small files (~10 MB/min)

**Recommendation:** Start with **1080x1920**, drop to **720x1280** if you experience lag.

---

## Technical Details

### Processing Pipeline

1. **Source Stream (16:9):**
   - Main horizontal stream (1920x1080 @ 30 FPS)
   - From camera or compositor

2. **Vertical Compositor:**
   - Analyzes each frame (30 times per second)
   - Calculates optimal 9:16 crop position
   - Applies smooth panning (15% interpolation)
   - Renders cropped frame to canvas

3. **Output Stream (9:16):**
   - Separate MediaStream (1080x1920 @ 30 FPS)
   - Ready for streaming or download
   - Includes audio from source stream

### Performance Impact

**CPU Usage:**
- **Baseline (no simulcast):** 10-15%
- **With vertical simulcast:** +10-15%
- **Total:** 20-30% CPU

**Memory Usage:**
- **Additional:** ~100-150 MB
- **Buffers:** ~50 MB

**Recommended Specs:**
- **CPU:** Intel i5/AMD Ryzen 5 or better
- **RAM:** 8 GB minimum, 16 GB recommended
- **GPU:** Integrated graphics sufficient (uses Canvas API)

### Codec & Quality

**Video:**
- **Codec:** VP9/VP8 (WebM)
- **Bitrate:** 2.5 Mbps (1080x1920)
- **Frame rate:** 30 FPS
- **Aspect ratio:** 9:16 (0.5625)

**Audio:**
- **Codec:** Opus
- **Bitrate:** 192 kbps
- **Sample rate:** 48 kHz
- **Channels:** Stereo

### Browser Support

| Browser | Support | Performance |
|---------|---------|-------------|
| **Chrome** | ✅ Full | Excellent |
| **Edge** | ✅ Full | Excellent |
| **Firefox** | ✅ Full | Good |
| **Safari** | ⚠️ Limited | Fair (Mac/iOS 14+) |

**Recommendation:** Use Chrome for best performance.

---

## Troubleshooting

### Vertical Simulcast Won't Start

**Problem:** Click pink button but simulcast doesn't enable

**Solutions:**
1. Check browser console (F12) for errors
2. Ensure camera/stream is active
3. Refresh page and try again
4. Use Chrome browser (best compatibility)
5. Check if GPU acceleration is enabled

### Low Frame Rate / Lag

**Problem:** Vertical stream is choppy or laggy

**Solutions:**
1. **Lower resolution:** Switch to 720x1280 or 540x960
2. **Close other apps:** Free up CPU resources
3. **Check CPU usage:** Should be <80%
4. **Disable other effects:** Turn off background removal temporarily
5. **Use hardware encoding:** Check browser GPU settings

### Crop Cuts Off Subject

**Problem:** Subject's head or body is cut off in vertical

**Solutions:**
1. **Center yourself** in horizontal frame (move to middle)
2. **Zoom out** camera slightly
3. **Adjust framing:** Keep within center third of screen
4. **Check preview:** Enable Settings → test vertical output

### Crop Doesn't Follow Subject

**Problem:** Smart centering doesn't pan with movement

**Solutions:**
1. Currently, **center mode is default** (static crop)
2. **Smart panning** planned for future update
3. **Workaround:** Position yourself in center, minimize movement
4. Update Streamlick to latest version

### Audio Out of Sync

**Problem:** Audio doesn't match vertical video

**Solutions:**
1. Refresh page (usually fixes sync issues)
2. Check if audio is properly routed (should auto-copy from source)
3. Restart simulcast (disable/enable)
4. Report bug if persists

### Vertical Stream Not Recording

**Problem:** Horizontal records but vertical doesn't

**Solutions:**
1. Vertical simulcast creates **separate stream**, not separate recording
2. To record vertical: Use **Clip Recording** or **Multi-Track Recording**
3. Vertical stream must be explicitly routed to recording/destination
4. Check stream routing in broadcast settings

---

## Combining with Other Features

### Vertical Simulcast + Clip Recording

**Perfect combination for social media creators:**

1. Enable **Vertical Simulcast** (pink button)
2. Enable **Clip Recording** (blue Film button)
3. During stream, hit "Create Clip" for highlights
4. **Result:** Clips in BOTH 16:9 and 9:16 formats instantly

**Use case:** Stream horizontally on YouTube, create vertical clips for TikTok/Reels promotion.

### Vertical Simulcast + AI Captions

**Accessibility + vertical format:**

1. Enable **Vertical Simulcast**
2. Enable **AI Captions** (Sparkles button)
3. Captions appear overlaid on vertical stream
4. **Result:** Accessible vertical content for deaf/hard-of-hearing viewers

**Use case:** Reach wider audiences on vertical platforms with captions.

### Vertical Simulcast + Background Removal

**Professional vertical content:**

1. Enable **Vertical Simulcast**
2. Enable **Smart Background Removal** (purple button)
3. Choose blur or solid color background
4. **Result:** Clean, professional vertical video without messy background

**Use case:** Create polished vertical content from home without studio setup.

### Vertical Simulcast + Multi-Track Recording

**Professional vertical post-production:**

1. Enable **Vertical Simulcast**
2. Enable **Multi-Track Recording** (Producer Mode)
3. Record separate tracks for each participant
4. **Result:** Separate vertical tracks for advanced editing

**Use case:** Record vertical podcast clips for each speaker separately.

---

## Platform-Specific Guidelines

### TikTok Live

**Optimal Settings:**
- Resolution: **1080x1920**
- Frame rate: 30 FPS
- Bitrate: 2.5 Mbps
- **RTMP URL:** (Get from TikTok Live Studio)

**Best practices:**
- Keep face/subject centered
- Use portrait lighting
- Add captions for accessibility
- Interact with chat

### Instagram Reels

**Optimal Settings:**
- Resolution: **1080x1920**
- Duration: 15-60 seconds (short clips)
- Format: MP4 or WebM

**Best practices:**
- Hook viewers in first 3 seconds
- Use trending audio (add in post)
- Add text overlays
- Keep under 60 seconds

### YouTube Shorts

**Optimal Settings:**
- Resolution: **1080x1920** or **720x1280**
- Duration: Under 60 seconds
- Format: MP4

**Best practices:**
- Loop content (encourage rewatching)
- Add captions (YouTube auto-captions also work)
- Include call-to-action
- Optimize thumbnail (first frame)

### Facebook/Meta Vertical Video

**Optimal Settings:**
- Resolution: **1080x1920**
- Frame rate: 30 FPS
- Format: MP4

**Best practices:**
- Native uploads perform better than links
- Add captions (80% watch muted)
- Optimize for mobile viewing
- Use square (1:1) as fallback if unsure

---

## FAQ

**Q: Can I stream vertical format to multiple platforms simultaneously?**
A: Yes! Enable vertical simulcast, then add multiple destinations (TikTok, Instagram) in the Destinations panel. Streamlick will route the vertical stream to each.

**Q: Does vertical simulcast work with screen sharing?**
A: Yes, but screen shares are typically horizontal content, so the crop may not be ideal. Best for face cam + screen share combos where the face cam is centered.

**Q: Can I preview the vertical output before going live?**
A: Not currently in a separate preview window, but you can see the crop area in the main preview. Future update will add split-screen preview.

**Q: Does vertical simulcast increase bandwidth usage?**
A: No, the vertical stream is generated locally. You only upload one stream (either horizontal or vertical) to each destination.

**Q: Can I customize the crop position (top, center, bottom)?**
A: Currently, crop is center-focused. Future updates will add manual crop positioning controls.

**Q: Will vertical simulcast work on mobile devices?**
A: Vertical simulcast is designed for desktop browsers (Chrome/Edge recommended). Mobile browser support is experimental.

**Q: Can I record both horizontal and vertical simultaneously?**
A: Yes, use Multi-Track Recording in Producer Mode to record both streams as separate files.

**Q: Does this work with OBS or other streaming software?**
A: Vertical simulcast is a Streamlick-native feature. To use with OBS, you'd need to manually set up a vertical scene with cropping.

**Q: Can I adjust the smoothing of the panning?**
A: Not currently in the UI, but the smoothing parameter can be adjusted in Settings (future update).

**Q: Is there a quality difference between horizontal and vertical?**
A: No, the vertical stream is cropped from the horizontal stream, so quality is identical within the cropped area.

---

## Competitive Comparison

| Feature | Streamlick | StreamYard | Restream | OBS |
|---------|-----------|-----------|----------|-----|
| **Vertical Simulcast** | ✅ Yes | ❌ No | ❌ No | ⚠️ Manual |
| **Auto-Cropping** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Smart Panning** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Multiple Resolutions** | ✅ 3 options | ❌ N/A | ❌ N/A | ⚠️ Manual |
| **Real-time Processing** | ✅ 30 FPS | ❌ N/A | ❌ N/A | ⚠️ Manual |
| **Zero Post-Production** | ✅ Yes | ❌ No | ❌ No | ❌ No |

**Key Advantages:**
1. **Only Streamlick** offers automatic vertical simulcast
2. **No competitors** have smart auto-cropping
3. **Zero manual setup** required (competitors need manual scene configuration)
4. **Instant output** ready for social media

---

## Future Enhancements

Planned features:
- [ ] Split-screen preview (horizontal + vertical side-by-side)
- [ ] Face tracking (AI follows speaker's face)
- [ ] Manual crop positioning (top/center/bottom override)
- [ ] Custom aspect ratios (1:1 square, 4:5 Instagram)
- [ ] Vertical overlays (lower thirds, logos)
- [ ] Multi-subject tracking (follows active speaker in panel)
- [ ] Crop presets (portrait, product demo, gaming)

---

## Related Documentation

- **Clip Recording:** Create instant clips in both formats
- **AI Captions:** Add captions to vertical streams
- **Multi-Track Recording:** Record vertical tracks separately
- **Smart Background Removal:** Polish vertical content

---

## Support

Having issues?
1. Check browser console (F12) for errors
2. Verify camera/stream is active
3. Try Chrome browser (best compatibility)
4. Lower resolution if experiencing lag
5. Report bugs via GitHub Issues

---

## Version History

- **v1.0.0** - Initial release
  - Auto-crop 16:9 to 9:16
  - Smart centering with smooth panning
  - Multiple resolutions (1080x1920, 720x1280, 540x960)
  - Real-time 30 FPS processing
  - Separate MediaStream output
  - Settings modal integration
