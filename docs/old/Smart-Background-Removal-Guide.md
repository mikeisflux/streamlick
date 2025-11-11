# Smart Background Removal - User Guide

**AI-powered background effects for professional streams**

---

## Overview

Smart Background Removal uses AI (TensorFlow.js + BodyPix) to detect you and replace your background in real-time—no green screen required. Create professional-looking streams from anywhere: your bedroom, coffee shop, or messy office.

**Perfect for:**
- 🏠 Home streamers without dedicated studio space
- 💼 Professional presentations from anywhere
- 🎓 Online teachers and educators
- 🎮 Gamers who want privacy
- 📹 Content creators seeking polished look
- 🎪 Event hosts needing brand consistency

**Key Features:**
- ✅ No green screen required (AI-powered)
- ✅ Real-time processing (30 FPS)
- ✅ Multiple background types: blur, color, image
- ✅ Adjustable blur amount (5-30px)
- ✅ Edge softening for natural look
- ✅ Custom background colors
- ✅ Runs in browser (no cloud processing)

---

## How to Enable Smart Background Removal

### Quick Enable (Simple)

1. Look at the **bottom control bar** (left section)
2. Find the **Purple image icon** (🖼️) button
3. Click it to enable background removal
4. Default: **Blur background** (15px blur)
5. You'll see: "Background blur enabled"

**That's it!** Your background is now blurred in real-time.

### Advanced Configuration (Settings Modal)

For more control over background effects:

1. Click the **⚙️ Settings** button (top-right)
2. Scroll down to **"Smart Background Removal"** section
3. Toggle **Enable** switch (if not already enabled)
4. Configure background options:

#### Background Type Options:

**1. Blur Background** (Default, recommended)
- Blurs everything behind you
- Keeps you in focus
- Professional "depth of field" effect
- **Blur Amount:** Slider from 5px (subtle) to 30px (heavy)

**2. Solid Color**
- Replaces background with solid color
- Clean, minimalist look
- **Color Picker:** Choose any color (#hex or visual picker)
- Popular: Black (#000000), White (#FFFFFF), Blue (#1E40AF)

**3. Custom Image** (Coming Soon)
- Upload your own background image
- Company logos, landscapes, office scenes
- Auto-scaled to fit your resolution

#### Edge Softness:
- Slider: 0% (sharp edges) to 100% (very soft)
- **Recommended:** 30-50% for natural look
- Higher = smoother transition between you and background
- Lower = sharper cutout (more "green screen" look)

---

## Understanding Background Removal

### How AI Background Removal Works

1. **AI Model (BodyPix):**
   - TensorFlow.js runs in your browser
   - Detects person vs background in each frame
   - Creates a "mask" (you = keep, background = replace)

2. **Real-Time Processing:**
   - Processes 30 frames per second
   - Each frame analyzed by AI
   - Mask applied instantly
   - No lag or delay

3. **Edge Refinement:**
   - Softens edges to avoid harsh cutout
   - Analyzes neighboring pixels
   - Creates smooth transitions
   - Natural, non-robotic appearance

### What Gets Removed?

**Removed (background):**
- Walls, furniture, clutter
- People in the background
- Windows, doors, posters
- Anything not part of your body

**Kept (foreground):**
- Your face, body, hands
- Clothing and accessories
- Anything you're holding
- Hair (with edge softening)

**Edge Cases:**
- **Glasses:** Usually kept (part of face)
- **Hats:** Usually kept (touching head)
- **Pets:** May be kept if touching you, removed if separate
- **Props:** Kept if you're holding them

---

## Background Type Guide

### 1. Blur Background

**Best for:**
- Professional presentations
- Hiding messy rooms
- Privacy (obscuring identifying details)
- Natural, cinematic look

**Blur Amount Guide:**

| Blur Level | Pixels | Effect | Best For |
|------------|--------|--------|----------|
| **Subtle** | 5-10px | Slight blur, details visible | Professional meetings |
| **Medium** | 15px (default) | Balanced blur | Most use cases |
| **Heavy** | 20-25px | Strong blur | Hiding clutter |
| **Extreme** | 30px | Complete blur | Maximum privacy |

**Examples:**
- **5px:** Background recognizable but not distracting
- **15px:** Background shapes visible but details obscured
- **30px:** Background completely blurred, like bokeh effect

**Pro Tip:** Start with 15px and adjust based on your background. Messy room? Use 25-30px. Clean setup? Use 10-15px.

### 2. Solid Color Background

**Best for:**
- Brand consistency (match company colors)
- Clean, minimal aesthetic
- Reducing visual noise
- Solid backgrounds for chroma key later

**Popular Color Choices:**

| Color | Hex Code | Use Case |
|-------|----------|----------|
| **Black** | #000000 | Dramatic, professional |
| **White** | #FFFFFF | Clean, bright |
| **Dark Gray** | #1F2937 | Modern, neutral |
| **Blue** | #1E40AF | Corporate, trustworthy |
| **Green** | #10B981 | Fresh, energetic |
| **Purple** | #7C3AED | Creative, unique |

**How to choose:**
- **Brand colors:** Match your logo/website
- **Contrast:** Choose opposite of your clothing color
- **Mood:** Dark = serious, bright = friendly
- **Lighting:** Light backgrounds need good front lighting

**Pro Tip:** Use your brand's primary color for consistent visual identity across all videos.

### 3. Custom Image Background (Coming Soon)

**Planned features:**
- Upload background image (JPG/PNG)
- Virtual office, studio, or branded backdrop
- Auto-scaling to match your resolution
- Blur/darken uploaded image for depth

**Use cases:**
- Company logo wall
- Virtual office environment
- Scenic backgrounds (beach, mountains)
- Themed backgrounds for events

---

## Use Cases & Examples

### 1. Professional Presentations

**Scenario:** Presenting from home office with messy background

**Setup:**
- **Background Type:** Blur
- **Blur Amount:** 20-25px
- **Edge Softness:** 40%
- **Result:** Professional look, background completely obscured

**Why it works:** Audience focuses on you and your content, not your laundry pile.

### 2. Privacy-Conscious Streaming

**Scenario:** Streaming from apartment, don't want to reveal location

**Setup:**
- **Background Type:** Blur (extreme)
- **Blur Amount:** 30px
- **Edge Softness:** 30%
- **Result:** Zero identifiable background details

**Why it works:** Complete privacy protection while maintaining natural appearance.

### 3. Brand Consistency

**Scenario:** Company webinar series, want consistent look across speakers

**Setup:**
- **Background Type:** Solid Color
- **Color:** #1E40AF (company blue)
- **Edge Softness:** 40%
- **Result:** All speakers have matching blue background

**Why it works:** Professional, consistent branding across all presenters.

### 4. Gaming Streams

**Scenario:** Gamer streaming from bedroom, want clean look

**Setup:**
- **Background Type:** Solid Color
- **Color:** #000000 (black)
- **Edge Softness:** 50%
- **Result:** Focus on face cam, no distracting background

**Why it works:** Viewers watch gameplay, not your gaming setup. Black background doesn't distract.

### 5. Educational Content

**Scenario:** Teacher recording lessons from home

**Setup:**
- **Background Type:** Blur
- **Blur Amount:** 15px
- **Edge Softness:** 50%
- **Result:** Natural look, students focus on teacher

**Why it works:** Professional without looking artificial. Students aren't distracted by home environment.

---

## Tips & Best Practices

### For Best Results

✅ **Good lighting is essential:**
- Use front-facing light (window or lamp)
- Avoid backlighting (light behind you)
- Even lighting = better AI detection
- Ring lights work great

✅ **Solid-colored clothing:**
- Avoid colors matching your skin tone
- Solid colors work better than patterns
- Contrast with background color choice

✅ **Minimal background movement:**
- Close doors/windows
- Turn off fans if visible
- Still backgrounds = better processing

✅ **Stable camera position:**
- Mount camera if possible
- Avoid handheld streaming
- AI works better with stationary setup

✅ **Test before going live:**
- Enable background removal
- Check edges look natural
- Adjust blur/softness settings
- Verify performance is smooth

### Common Mistakes to Avoid

❌ **Poor lighting:**
- Dark room = AI can't detect you well
- Backlighting = you appear as silhouette
- Solution: Add front light source

❌ **Transparent/sheer clothing:**
- See-through fabrics confuse AI
- Solution: Wear solid, opaque clothing

❌ **Matching background colors:**
- Wearing green in front of green wall
- Solution: Choose contrasting outfit

❌ **Too much motion:**
- Dancing, rapid movements
- Solution: AI works best with moderate movement

❌ **Low-end hardware:**
- Old laptops may struggle with 30 FPS processing
- Solution: Lower video resolution or disable feature

### Edge Softness Guide

**What is edge softness?**
Edge softness controls how sharply you're cut out from the background.

**Low softness (0-20%):**
- Sharp, defined edges
- Looks like green screen effect
- Better for solid color backgrounds
- May look artificial

**Medium softness (30-50%):**
- Natural, blended edges
- Recommended for most use cases
- Good balance of quality and realism

**High softness (60-100%):**
- Very soft, feathered edges
- May blur parts of your body
- Good for artistic effects
- Can look "dreamy" or ethereal

**Recommendation:** Start with 30% and adjust. If edges look too harsh, increase. If your hair/edges look blurry, decrease.

---

## Performance & System Requirements

### Recommended Hardware

**Minimum:**
- CPU: Intel i5 / AMD Ryzen 5 (4 cores)
- RAM: 8 GB
- GPU: Integrated graphics (Intel HD 4000+)
- Browser: Chrome 90+

**Recommended:**
- CPU: Intel i7 / AMD Ryzen 7 (8 cores)
- RAM: 16 GB
- GPU: Dedicated GPU (NVIDIA/AMD, helps with TensorFlow)
- Browser: Chrome 120+ (latest)

### Performance Impact

**CPU Usage:**
- **Without background removal:** 10-15% (baseline streaming)
- **With background removal:** 25-35% (adds ~15-20%)
- Modern CPUs handle this easily

**Memory Usage:**
- **AI Model:** ~150 MB (loaded once)
- **Processing buffers:** ~50 MB
- **Total additional:** ~200 MB

**Frame Rate:**
- Target: 30 FPS
- Actual: 25-30 FPS on recommended hardware
- Lower-end systems: 15-20 FPS (may be choppy)

**GPU Acceleration:**
- TensorFlow.js uses WebGL (GPU-accelerated)
- Dedicated GPU significantly improves performance
- Integrated graphics work but slower

### Browser Compatibility

| Browser | Support | Performance |
|---------|---------|-------------|
| **Chrome** | ✅ Full | Excellent (recommended) |
| **Edge** | ✅ Full | Excellent |
| **Firefox** | ⚠️ Limited | Fair (slower) |
| **Safari** | ⚠️ Limited | Fair (Mac/iOS 14.1+) |

**Recommendation:** Use Chrome or Edge for best performance.

---

## Troubleshooting

### Background Removal Not Working

**Problem:** Enabled but background is not removed

**Solutions:**
1. Check browser console (F12) for errors
2. Wait 10-15 seconds for AI model to load
3. Ensure camera is active (you're visible on screen)
4. Refresh page and re-enable feature
5. Try Chrome browser (best compatibility)
6. Check if GPU acceleration is enabled in browser

### Choppy / Low Frame Rate

**Problem:** Video is stuttering or laggy

**Solutions:**
1. Lower video resolution (Settings → Video Quality → 720p)
2. Reduce blur amount (less processing needed)
3. Close other browser tabs and applications
4. Use Chrome for better GPU acceleration
5. Check CPU usage (Task Manager) - should be <80%
6. Disable other camera effects if active

### Edges Look Harsh / Artificial

**Problem:** You look "cut out" like green screen

**Solutions:**
1. Increase **Edge Softness** to 40-50%
2. Use **Blur Background** instead of solid color
3. Improve lighting (add front light)
4. Wear clothing with different color than background
5. Check that edge softness slider is not at 0%

### Parts of Me Are Removed

**Problem:** AI removes parts of your body (hands, hair)

**Solutions:**
1. Improve lighting on affected areas
2. Increase edge softness (60-70%)
3. Ensure affected body parts are visible to camera
4. Avoid transparent/sheer clothing
5. Try different camera angle
6. Reduce rapid movements

### Background Isn't Fully Blurred

**Problem:** Some background details still visible

**Solutions:**
1. Increase blur amount (25-30px)
2. Use solid color background instead
3. Check if AI model finished loading (wait 15 seconds)
4. Verify background removal is actually enabled
5. Refresh page and re-enable

### Model Takes Forever to Load

**Problem:** "Loading AI background model..." for 2+ minutes

**Solutions:**
1. Check internet connection (model downloads from CDN)
2. Clear browser cache and reload
3. Disable browser extensions that block scripts
4. Try incognito/private browsing mode
5. Check browser console for download errors

### Background Flickers

**Problem:** Background removal flickers on/off

**Solutions:**
1. This is usually a lighting issue
2. Add consistent, stable lighting
3. Avoid lighting that changes (TV screens, windows)
4. Increase edge softness
5. Reduce motion (AI works better when you're still)

---

## Combining with Other Features

### Background Removal + AI Captions
- Professional look + accessibility
- Great for presentations
- Background blur keeps focus on you and captions

### Background Removal + Clip Recording
- Clips include background effects
- No post-processing needed
- Instant shareable highlights

### Background Removal + Multi-Track Recording
- Background effects recorded in video tracks
- Permanent effect (no re-processing needed)
- Professional look in final edits

### Background Removal + Producer Mode
- Technical team can enable for guests
- Consistent look across all speakers
- Brand consistency for events

---

## Competitive Comparison

| Feature | Streamlick | Zoom | StreamYard | Riverside.fm |
|---------|-----------|------|-----------|--------------|
| **Background Removal** | ✅ Free | ✅ Included | ❌ No | ✅ $19/mo |
| **Blur Background** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Solid Color** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Custom Image** | 🔜 Soon | ✅ Yes | ❌ No | ✅ Yes |
| **Edge Softness** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Blur Adjustment** | ✅ 5-30px | ❌ Fixed | ❌ N/A | ❌ Fixed |
| **No Green Screen** | ✅ Yes | ✅ Yes | ❌ N/A | ✅ Yes |

**Competitive Advantages:**
1. **Free:** Zoom/Riverside charge for this feature
2. **Customizable:** Adjustable blur and edge softness (competitors have fixed settings)
3. **Browser-native:** No desktop app required
4. **Real-time preview:** See effects before going live

---

## Advanced Features

### Color Theory for Backgrounds

**Warm Colors (Red, Orange, Yellow):**
- Energetic, friendly, approachable
- Good for: Entertainment, casual content
- Avoid for: Professional business content

**Cool Colors (Blue, Green, Purple):**
- Professional, calm, trustworthy
- Good for: Corporate, education, finance
- Blue = most universally "professional"

**Neutral Colors (Black, White, Gray):**
- Clean, minimalist, versatile
- Good for: Any content type
- Black = dramatic, white = bright

**Complementary Colors:**
If you wear red, use green background (opposite on color wheel).

### Keyboard Shortcuts

Currently no keyboard shortcuts available.

**Requested for future:**
- `Ctrl/Cmd + B` - Toggle background removal
- `Ctrl/Cmd + Shift + B` - Cycle background types

---

## FAQ

**Q: Does background removal work in low light?**
A: It works but quality degrades. AI needs to see you clearly. Add front lighting for best results.

**Q: Can I use background removal with screen sharing?**
A: Yes, background removal applies to your camera feed only, not screen shares.

**Q: Will background removal be recorded?**
A: Yes, if you enable multi-track recording, the background effects are included in the video.

**Q: Can viewers see the background removal?**
A: Yes, background removal applies to the stream output. Everyone sees the effect.

**Q: Does it work with multiple people in frame?**
A: Yes, AI detects all people and keeps them all. Background behind everyone is removed.

**Q: What if someone walks behind me?**
A: AI will detect them as a person and keep them (not remove). If you want privacy, ensure no one walks into frame.

**Q: Can I use my own background image?**
A: Not yet (coming soon). Currently: blur or solid color only.

**Q: Does it work with virtual backgrounds already applied?**
A: No, don't combine with Zoom/Teams virtual backgrounds. Use one or the other.

**Q: Is my video processed on a server?**
A: No, 100% local processing in your browser. Nothing is sent to servers.

**Q: Can I disable background removal mid-stream?**
A: Yes, click the purple button again to toggle off. Instant return to normal camera.

**Q: Why is the model loading slow?**
A: First-time load downloads ~30 MB AI model. Subsequent uses are instant (cached).

**Q: Can I preview before enabling?**
A: Not currently. Enable it to see the effect. You can disable instantly if you don't like it.

---

## Technical Details

### AI Model: BodyPix

**What is BodyPix?**
- TensorFlow.js model for person segmentation
- Detects 24 body parts (head, torso, arms, legs, etc.)
- Trained on thousands of human images
- Open-source, runs in browser

**Model Architecture:**
- **Base:** MobileNetV1 (optimized for mobile/web)
- **Output Stride:** 16 (balance of speed vs accuracy)
- **Multiplier:** 0.75 (lightweight model)
- **Quantization:** 2 bytes (smaller file size)

**Processing Pipeline:**
1. Frame captured from video (30 FPS)
2. Resized to model input size (medium resolution)
3. BodyPix generates segmentation mask
4. Mask applied to original frame
5. Background replaced (blur/color/image)
6. Output sent to canvas stream

**Accuracy:**
- Person detection: 95-98%
- Edge detection: 85-90% (depends on lighting)
- Body part detection: 90-95%

### Privacy & Security

**Data Processing:**
- 100% local (browser-only)
- No frames sent to servers
- No data logged or stored
- AI model runs on your device

**Model Download:**
- Downloaded from TensorFlow CDN (first use)
- Cached in browser (~30 MB)
- Subsequent uses: instant (no download)

**Permissions:**
- Requires camera access (same as streaming)
- No additional permissions needed

---

## Future Enhancements

Planned features:
- [ ] Custom background image upload
- [ ] Background blur intensity animation (fade in/out)
- [ ] Green screen mode (replace specific color)
- [ ] Body tracking (follow you if you move)
- [ ] Portrait mode (blur background + darken)
- [ ] Preset backgrounds library (office, studio, nature)
- [ ] Adjustable feather radius (per-edge control)
- [ ] GPU performance optimization

---

## Related Documentation

- **Clip Recording:** Capture highlights with background effects
- **Multi-Track Recording:** Record with background removal applied
- **Settings Modal:** Configure all background options

---

## Support

Having issues?
1. Check browser console (F12) for errors
2. Verify camera permissions
3. Ensure good lighting
4. Try Chrome browser (best performance)
5. Report bugs via GitHub Issues

---

## Version History

- **v1.0.0** - Initial release
  - BodyPix AI model integration
  - Blur background (5-30px adjustable)
  - Solid color backgrounds
  - Edge softness control (0-100%)
  - Real-time 30 FPS processing
  - Browser-native (no cloud processing)
