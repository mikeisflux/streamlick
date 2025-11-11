# Clip Recording - User Guide

**Create instant 30s/60s clips during your live stream**

---

## Overview

Clip Recording is like **instant replay** for live streams. It continuously records the last 60 seconds in memory, so when something amazing happens, you can instantly create a 30-second or 60-second clip and share it immediately.

**Perfect for:**
- 🎮 Gaming highlights and clutch moments
- 🎤 Podcast memorable quotes
- 📺 Talk show funny moments
- 🎓 Educational key takeaways
- 🎪 Event highlights
- 📱 Social media content creation

**Key Features:**
- ✅ 60-second rolling buffer (continuous background recording)
- ✅ Create 30s or 60s clips on demand
- ✅ Instant download to computer
- ✅ High quality: 2.5 Mbps video
- ✅ Auto-generates thumbnail
- ✅ Zero latency - clips available immediately
- ✅ No file size limits

---

## How to Use Clip Recording

### Step 1: Enable Rolling Buffer

1. Look at the **bottom control bar** (left section)
2. Find the **Film icon** (🎬) button
3. Click it to start the 60-second rolling buffer
4. Button turns **blue** when active
5. You'll see: "Clip recording buffer started (60s rolling buffer)"

**What's happening:**
- The system is now continuously recording the last 60 seconds
- This recording stays in memory (not saved yet)
- The buffer automatically discards anything older than 60 seconds
- Your stream continues normally - no performance impact

### Step 2: Wait for Buffer to Fill

- For the first **30 seconds**, you can only create 30s clips
- After **60 seconds**, you can create both 30s and 60s clips
- The longer the buffer runs, the more options you have

### Step 3: Create a Clip

When something amazing happens:

1. Click the **"✂️ Create Clip"** button (appears when buffer is active)
2. A popup shows with two options:
   - **30s** - Last 30 seconds
   - **60s** - Last 60 seconds (if available)
3. Each option shows:
   - Large duration number
   - "Last X seconds" description
   - Enabled/disabled state
4. Click your preferred duration
5. Wait 1-2 seconds for processing
6. Clip automatically downloads to your **Downloads** folder

**File naming:**
- Format: `streamlick-clip-{duration}s-{timestamp}.webm`
- Example: `streamlick-clip-30s-1699123456789.webm`

### Step 4: Stop Rolling Buffer (Optional)

- Click the Film icon again to stop the rolling buffer
- The button returns to gray
- Any buffered footage is discarded
- You can restart anytime

---

## Understanding the Buffer

### What is a Rolling Buffer?

Think of it like a DVR or TiVo for your stream:
- Continuously records the last 60 seconds
- Automatically deletes anything older
- Always ready to capture moments
- No storage used until you create a clip

### Buffer Status Indicator

When you click "Create Clip", the popup shows:
```
ℹ️ Buffer: 45s available
```

This tells you:
- **45s available:** You can create a 30s clip (but not 60s yet)
- **60s available:** You can create both 30s and 60s clips

### Buffer Limitations

- **Maximum buffer:** 60 seconds
- **Minimum clip:** 30 seconds
- **Memory usage:** ~50-100 MB (depends on quality)
- **No pre-buffer:** Can't capture moments before enabling

---

## Use Cases & Workflows

### 1. Gaming Highlights

**Scenario:** Playing competitive game, hit an amazing shot

**Workflow:**
1. Enable buffer at match start
2. Play normally
3. Hit the shot → **immediately** click "Create Clip"
4. Select 30s to capture just the moment
5. Share to Twitter/Discord instantly
6. Continue playing (buffer keeps running)

**Pro Tip:** Create multiple clips per match without stopping

### 2. Podcast Memorable Quotes

**Scenario:** Guest says something quotable during interview

**Workflow:**
1. Enable buffer when interview starts
2. When guest delivers great quote, click "Create Clip"
3. Select 30s for shareable soundbite
4. Upload to social media during break
5. Use clip for podcast promotion

**Pro Tip:** Create clips during ad breaks for immediate social posts

### 3. Educational Key Moments

**Scenario:** Teaching complex concept, want to create recap video

**Workflow:**
1. Enable buffer before demonstration
2. Complete your explanation
3. Create 60s clip with full explanation
4. Share clip with students after class
5. Students can rewatch difficult concepts

**Pro Tip:** Create clips of each major topic for study materials

### 4. Live Event Highlights

**Scenario:** Hosting live event with multiple speakers

**Workflow:**
1. Enable buffer at event start
2. After each speaker's key moment, create clip
3. Use 30s clips for quick social posts
4. Use 60s clips for event recap video
5. Compile clips post-event for highlight reel

**Pro Tip:** Assign someone to monitor and create clips during event

---

## Clip Quality & Technical Details

### Video Specifications

- **Codec:** VP9/VP8 (WebM format)
- **Bitrate:** 2.5 Mbps (high quality)
- **Resolution:** Matches stream (720p/1080p)
- **Frame rate:** 30 FPS
- **Audio:** Opus codec, 128 kbps

### File Sizes (Approximate)

| Duration | 720p | 1080p |
|----------|------|-------|
| 30s | ~10 MB | ~20 MB |
| 60s | ~20 MB | ~40 MB |

### Browser Compatibility

- ✅ **Chrome:** Full support (recommended)
- ✅ **Edge:** Full support
- ✅ **Firefox:** Full support
- ✅ **Safari:** Limited support (Mac/iOS 14.1+)

### Performance Impact

- **CPU:** <5% additional load
- **Memory:** ~50-100 MB for 60s buffer
- **Bandwidth:** 0 bytes (no upload)
- **Stream quality:** No impact on live stream

---

## Comparison with Other Platforms

| Feature | Streamlick | OBS Replay | StreamYard | Zoom |
|---------|-----------|------------|-----------|------|
| **Rolling Buffer** | ✅ 60s | ✅ Custom | ❌ No | ❌ No |
| **Instant Download** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **During Live** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **No Setup** | ✅ Zero | ❌ Complex | ❌ N/A | ❌ N/A |
| **Cloud Storage** | Optional | No | N/A | N/A |

**Unique Advantage:** Create clips **during** live stream without interruption (OBS requires stopping stream)

---

## Tips & Best Practices

### When to Enable Buffer

✅ **Enable at:**
- Start of gaming session
- Beginning of interview
- Before important presentation
- During Q&A sessions
- Live competitions

❌ **Don't enable during:**
- Private conversations (buffer records everything)
- Breaks/intermissions (wastes memory)
- Test streams (not needed)

### Creating Better Clips

**Timing is Everything:**
- Click "Create Clip" **immediately** after moment happens
- Don't wait more than 5-10 seconds
- Remember: clips go **backwards** from click time

**Example:**
- Great moment at 10:00
- You click at 10:05
- 30s clip = 9:35 to 10:05 (includes moment ✅)
- If you wait until 10:40 to click
- 30s clip = 10:10 to 10:40 (misses moment ❌)

**Duration Selection:**
- **30s clips:** Quick moments, social media, memes
- **60s clips:** Full context, complex plays, explanations

### Organizing Clips

Since clips are auto-named with timestamps:
```
streamlick-clip-30s-1699123456789.webm
streamlick-clip-60s-1699123498234.webm
```

**Recommended:**
1. Create clips during stream
2. Rename files after stream ends
3. Sort by timestamp to match stream order
4. Upload to dedicated folder for editing

### Social Media Strategy

**Twitter/X:**
- Maximum: 2 minutes 20 seconds ✅
- Use 30s clips for quick engagement
- Post during stream for live engagement

**Instagram:**
- Reels: 90 seconds ✅
- Stories: 60 seconds ✅
- Both clip durations work perfectly

**TikTok:**
- Maximum: 10 minutes ✅
- Use 30s clips as-is
- Vertical format may need editing

**YouTube Shorts:**
- Maximum: 60 seconds ✅
- 60s clips perfect for Shorts
- Consider adding text overlay

---

## Troubleshooting

### Buffer Not Starting

**Problem:** Click Film icon but buffer doesn't start

**Solutions:**
1. Check browser console (F12) for errors
2. Verify stream is active (camera/screen share on)
3. Close other tabs to free memory
4. Refresh page and try again
5. Try different browser (Chrome recommended)

### Clips Not Downloading

**Problem:** Click duration but no download happens

**Solutions:**
1. Check browser download permissions
2. Verify Downloads folder isn't full
3. Disable pop-up blocker for Streamlick
4. Try different duration (30s vs 60s)
5. Check browser console for errors

### Buffer Status Shows "0s Available"

**Problem:** Buffer enabled but shows 0 seconds

**Solutions:**
1. Wait 5-10 seconds for buffer to fill
2. Verify stream is actually active
3. Check if you recently enabled buffer
4. Restart buffer (disable/enable)

### Clip Missing the Moment

**Problem:** Clip doesn't include the highlight

**Solutions:**
1. Click "Create Clip" sooner (immediately after moment)
2. Use 60s clips for more buffer room
3. Remember clips go backwards from click time
4. Practice timing on test streams

### Poor Clip Quality

**Problem:** Clips look pixelated or low quality

**Solutions:**
1. Check stream quality settings (Settings modal)
2. Ensure good internet connection
3. Use 1080p if bandwidth allows
4. Verify camera quality settings
5. Close bandwidth-heavy applications

---

## Advanced Features

### Combining with Other Features

**Clip Recording + AI Captions:**
- Enable both features
- Clips include embedded captions
- Great for accessibility

**Clip Recording + Multi-Track:**
- Use clips for quick shares
- Use multi-track for full episodes
- Best of both worlds

**Clip Recording + Background Removal:**
- Clips include background effects
- Professional-looking highlights
- No post-processing needed

---

## Keyboard Shortcuts

Currently no keyboard shortcuts available.

**Requested for future:**
- `Ctrl/Cmd + R` - Quick 30s clip
- `Ctrl/Cmd + Shift + R` - Quick 60s clip
- `Ctrl/Cmd + B` - Toggle buffer

---

## FAQ

**Q: Does the buffer affect stream performance?**
A: No, buffer runs in background with <5% CPU usage.

**Q: Can I create unlimited clips?**
A: Yes, no limits on clip creation.

**Q: Are clips saved to cloud?**
A: No, clips download directly to your computer. You can upload them manually.

**Q: Can I change clip duration after creation?**
A: No, choose duration before creating clip.

**Q: Does buffer work during Producer Mode?**
A: Yes, buffer is independent of Producer Mode.

**Q: Can someone else control the buffer?**
A: No, only the host controls clip recording.

**Q: What happens if my browser crashes during buffer?**
A: Buffer is lost (memory-only). Create clips frequently!

**Q: Can I create clips from past streams?**
A: No, clips are live-only. Use Multi-Track Recording for full sessions.

**Q: Do clips include audio?**
A: Yes, clips include both video and audio.

**Q: Can I pause the buffer?**
A: No, buffer runs continuously or not at all.

---

## Competitive Advantage

**Why Streamlick Clip Recording is Better:**

1. **Live Creation:** Create clips during stream (others require post-processing)
2. **Zero Setup:** One click to enable (OBS requires complex configuration)
3. **Instant Download:** No waiting for processing
4. **No Interruption:** Stream continues while creating clips
5. **High Quality:** 2.5 Mbps bitrate (higher than competitors)

**StreamYard:** ❌ No clip creation feature at all
**OBS Replay Buffer:** ⚠️ Must stop stream, complex setup
**Zoom:** ❌ No live clip creation
**Riverside.fm:** ⚠️ Cloud processing, slow downloads

---

## Future Enhancements

Planned features:
- [ ] Cloud upload integration (YouTube, Dropbox)
- [ ] Custom clip durations (15s, 45s, 90s)
- [ ] Clip preview before download
- [ ] Trim/edit clips before saving
- [ ] Keyboard shortcuts
- [ ] Clip naming in UI
- [ ] Multiple clips downloadable as ZIP
- [ ] Automatic clip detection (AI-powered)

---

## Related Documentation

- **Multi-Track Recording:** For full session recording
- **Producer Mode:** Advanced production controls
- **AI Captions:** Add captions to clips

---

## Support

Having issues?
1. Check browser console (F12) for errors
2. Verify browser supports MediaRecorder API
3. Test with Chrome (best compatibility)
4. Report bugs via GitHub Issues

---

## Version History

- **v1.0.0** - Initial release
  - 60-second rolling buffer
  - 30s and 60s clip creation
  - Instant download
  - Auto thumbnail generation
  - 2.5 Mbps high quality
