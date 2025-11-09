# Multi-Track Recording - User Guide

**Record each participant separately for professional post-production**

---

## Overview

Multi-Track Recording captures each participant's audio and video as separate files, giving you complete control during post-production editing. This is essential for professional podcasters, video editors, and producers who need to mix, edit, and master content after the live stream.

**Perfect for:**
- 🎙️ Professional podcasts with multiple hosts
- 🎬 Video productions requiring post-editing
- 🎵 Music collaborations and performances
- 📺 Interview shows and talk shows
- 🎓 Educational content with multiple speakers
- 🎪 Panel discussions and roundtables

**Key Features:**
- ✅ Separate files per participant (isolated tracks)
- ✅ Split audio/video option (separate .webm files)
- ✅ High quality: 5 Mbps video, 192 kbps audio
- ✅ Auto-naming: `session_Name_audio.webm`
- ✅ Real-time track monitoring
- ✅ Unlimited participants
- ✅ No cloud processing (instant download)

---

## How to Use Multi-Track Recording

### Step 1: Access Producer Mode

1. Start your stream in **Studio**
2. Click the **Producer Mode** button in the top control bar
3. Producer Mode panel opens on the right side
4. Scroll down to the **"🎬 Multi-Track Recording"** section

**Important:** Multi-Track Recording is only available in Producer Mode (not in regular Studio).

### Step 2: Configure Recording Options

Before starting recording, configure your preferences:

1. **Separate audio/video files:**
   - ☑️ **Checked:** Each participant gets 2 files (audio.webm + video.webm)
   - ☐ **Unchecked:** Each participant gets 1 file (combined.webm)

2. **When to use separate files:**
   - ✅ **Podcasts:** Separate audio for mixing in Audacity/Adobe Audition
   - ✅ **Video editing:** Separate tracks for Final Cut/Premiere Pro
   - ❌ **Quick edits:** Combined files are simpler

**Recommendation:** Use separate files for maximum post-production flexibility.

### Step 3: Start Recording

1. Ensure all participants are connected and live (not backstage)
2. Click **"Start Multi-Track Recording"** button
3. You'll see:
   - 🔴 Red "REC" indicator pulsing
   - Live duration counter: `00:00:15`
   - Track count: "4 tracks active"
4. **Visual confirmation:**
   - Each participant shows a red "REC" badge
   - Recording section turns red with border

**What's being recorded:**
- Only participants in **"Live"** status (role = host or guest)
- Backstage participants are NOT recorded
- Each participant's original stream (before mixing)

### Step 4: Monitor Recording

While recording:

**Duration Counter:**
```
Recording...
⏱️ 00:15:42
4 tracks active
```

**Participant Badges:**
- Each live participant shows: `🔴 REC` badge
- Backstage participants show no badge

**Track Count:**
- **Separate mode:** 2 tracks per participant (audio + video)
  - 3 participants = 6 tracks
- **Combined mode:** 1 track per participant
  - 3 participants = 3 tracks

### Step 5: Stop Recording

1. Click **"Stop Multi-Track Recording"** button
2. Processing takes 1-2 seconds
3. You'll see a green success box:
   ```
   ✅ 6 tracks ready (245.3 MB total)
   📥 Download All Tracks
   ```

**Important:** Tracks are held in memory until you download or start a new recording.

### Step 6: Download Tracks

1. Click **"Download All Tracks"** button
2. Files download to your **Downloads** folder
3. Each file is named automatically:

**Naming Convention:**
```
{sessionName}_{participantName}_{trackType}.webm
```

**Example files:**
```
producer-session_Host_audio.webm       (42.1 MB)
producer-session_Host_video.webm       (128.4 MB)
producer-session_Sarah_audio.webm      (38.2 MB)
producer-session_Sarah_video.webm      (115.8 MB)
producer-session_Mike_audio.webm       (41.5 MB)
producer-session_Mike_video.webm       (122.7 MB)
```

**Session name:** Defaults to broadcast ID or "producer-session"

---

## Understanding Multi-Track Recording

### What Does "Multi-Track" Mean?

**Traditional recording** (single-track):
- All participants mixed into one file
- Cannot edit individual voices
- Cannot adjust individual levels
- Cannot remove one person

**Multi-track recording:**
- Each participant = separate file
- Full control over each voice
- Adjust levels independently
- Remove/mute any participant
- Professional mixing capability

### Separate Audio/Video Explained

#### Option 1: Separate Files (Recommended)

**What you get:**
```
Host_audio.webm    (audio only, 192 kbps)
Host_video.webm    (video only, 5 Mbps)
Sarah_audio.webm   (audio only)
Sarah_video.webm   (video only)
```

**Advantages:**
- Smaller audio files (easier to work with)
- Can replace audio without re-rendering video
- Can sync/adjust audio independently
- Standard workflow for professional editors
- Lower CPU usage during editing

**Use cases:**
- Podcast editing (import audio files into DAW)
- Video editing (sync in Premiere/Final Cut)
- Audio mixing (Audacity, Audition, Logic Pro)

#### Option 2: Combined Files

**What you get:**
```
Host_combined.webm    (audio + video)
Sarah_combined.webm   (audio + video)
```

**Advantages:**
- Simpler file management (fewer files)
- Easier for quick edits
- Faster import into basic editors

**Use cases:**
- Quick edits in iMovie/OpenShot
- Simple cuts and rearrangements
- Content that doesn't need audio mixing

### File Specifications

#### Audio Files (.webm)
- **Codec:** Opus
- **Bitrate:** 192 kbps (high quality)
- **Sample Rate:** 48 kHz
- **Channels:** Mono (1 channel per participant)
- **File size:** ~1.4 MB per minute

#### Video Files (.webm)
- **Codec:** VP9/VP8
- **Bitrate:** 5 Mbps (broadcast quality)
- **Resolution:** Matches stream (720p/1080p)
- **Frame rate:** 30 FPS
- **File size:** ~37.5 MB per minute

#### Example File Sizes (30-minute episode)

| Participants | Separate Mode | Combined Mode |
|--------------|---------------|---------------|
| 2 people | ~2.3 GB | ~2.3 GB |
| 3 people | ~3.5 GB | ~3.5 GB |
| 4 people | ~4.6 GB | ~4.6 GB |

**Note:** Separate vs Combined doesn't affect total size, just file organization.

---

## Use Cases & Workflows

### 1. Professional Podcast Production

**Scenario:** Weekly podcast with 2 hosts + 1 guest

**Workflow:**
1. Start multi-track recording at episode start (separate audio/video)
2. Record full 60-minute conversation
3. Stop recording, download all tracks
4. Import audio files into Audacity/Adobe Audition
5. Edit each track separately:
   - Remove "ums" and "ahs"
   - Balance volume levels
   - Remove background noise
   - Add music and effects
6. Export final mixed audio
7. Optionally: Sync edited audio back to video tracks

**Why multi-track:**
- Can remove one person's cough without affecting others
- Balance loud vs quiet speakers
- Remove cross-talk and interruptions
- Professional-quality final mix

**Pro Tip:** Use separate audio files for faster editing (smaller file sizes).

### 2. Interview Show / Talk Show

**Scenario:** Daily interview show with rotating guests

**Workflow:**
1. Enable multi-track recording before interview
2. Record full interview (30-45 minutes)
3. Download separate video files for each person
4. Import into Premiere Pro/Final Cut Pro
5. Create multi-angle editing:
   - Cut to host when asking questions
   - Cut to guest when answering
   - Picture-in-picture for reactions
6. Export final episode with professional cuts

**Why multi-track:**
- Each participant is a separate "camera angle"
- Can create dynamic cuts between speakers
- Can add overlays and graphics per person
- Professional TV-style production

**Pro Tip:** Use combined files if you don't need audio mixing.

### 3. Music Collaboration

**Scenario:** Virtual jam session with 3 musicians

**Workflow:**
1. Start multi-track recording (separate audio/video)
2. Record full performance
3. Download all audio tracks
4. Import into Logic Pro/Ableton/Pro Tools
5. Mix each instrument separately:
   - Adjust levels and panning
   - Add effects and EQ
   - Time-align performances
   - Master the final mix
6. Sync final audio to video for YouTube

**Why multi-track:**
- Full control over each instrument's mix
- Can fix timing issues per performer
- Professional studio-quality mixing
- Can create stems for remixes

**Pro Tip:** Record multiple takes and comp the best parts.

### 4. Educational Content / Panel Discussion

**Scenario:** 4-person panel discussion on industry topic

**Workflow:**
1. Enable multi-track recording (combined files for simplicity)
2. Record 90-minute discussion
3. Download all video files
4. Import into DaVinci Resolve/iMovie
5. Create highlight reel:
   - Pull best moments from each speaker
   - Cut out tangents and digressions
   - Add lower thirds and graphics
6. Export 15-minute highlight video

**Why multi-track:**
- Can isolate each speaker's contributions
- Remove any speaker who went off-topic
- Create separate videos per speaker for social media
- Repurpose content in multiple ways

**Pro Tip:** Create speaker-specific clips for LinkedIn posts.

---

## Post-Production Editing

### Importing into Audio Editors

#### Audacity (Free)
1. **File → Open** → Select all audio .webm files
2. Each file opens in a separate track
3. Use **Tracks → Align Tracks → Align Together** to sync
4. Edit, mix, and export

#### Adobe Audition
1. **File → New → Multitrack Session**
2. Drag all audio .webm files into timeline
3. Files automatically align by timestamp
4. Use **Mixer Panel** to adjust levels
5. Export final mix

#### Logic Pro / Pro Tools
1. Create new project
2. Import audio files as separate tracks
3. Use **Identify Beat** to sync (if needed)
4. Mix and master as usual

### Importing into Video Editors

#### Adobe Premiere Pro
1. **File → Import** → Select all video .webm files
2. Create **Multicam Sequence:**
   - Select all clips in Project Panel
   - Right-click → **Create Multi-Camera Source Sequence**
   - Choose "Audio" for sync method
3. Edit by clicking angles in Program Monitor
4. Export final video

#### Final Cut Pro X
1. Import all video .webm files
2. Select all clips in Event Browser
3. **File → New → Multicam Clip**
4. Choose "Audio" for angle synchronization
5. Edit using **Angle Viewer**
6. Export final project

#### DaVinci Resolve
1. Create new project and timeline
2. Import all video .webm files
3. Right-click clips → **Create New Multicam Clip Using Selected Clips**
4. Use **Multicam Viewer** to switch angles
5. Export final video

### Common Editing Tasks

**Remove one participant entirely:**
1. Simply delete their track files
2. Re-import remaining participants
3. Continue editing

**Balance audio levels:**
1. Measure peak levels per speaker (use VU meters)
2. Apply gain adjustment to quieter speakers
3. Use compression to even out dynamic range
4. Normalize final mix to -3 dB

**Sync audio and video (if drift occurs):**
1. Use audio waveform alignment
2. Look for visual cues (claps, gestures)
3. Manual adjustment in 10ms increments
4. Most editors auto-sync via timecode

**Create speaker-specific videos:**
1. Import just one participant's video file
2. Add graphics, lower thirds, captions
3. Export as standalone clip
4. Perfect for social media teasers

---

## Tips & Best Practices

### Before Recording

✅ **Test first:**
- Do a 30-second test recording
- Download and verify all tracks
- Check audio quality and levels
- Ensure all participants are visible/audible

✅ **Check participant status:**
- Only "Live" participants are recorded
- Move backstage people out of frame
- Verify correct names (used in filenames)

✅ **Free up disk space:**
- Multi-track recordings can be large
- Ensure 5+ GB free in Downloads folder
- Close other downloads

❌ **Don't:**
- Start recording with participants backstage
- Forget to test participant names
- Record on low battery (laptop users)

### During Recording

✅ **Monitor the recording:**
- Check duration counter is increasing
- Verify all participants show "REC" badge
- Watch for disconnections (recording stops for that person)

✅ **Keep it running:**
- Avoid stopping/starting multiple times
- One long recording is easier to edit
- You can always trim in post-production

✅ **Note timestamps:**
- Write down when great moments happen
- Example: "15:30 - great quote from Sarah"
- Speeds up editing later

❌ **Don't:**
- Add/remove participants mid-recording (creates sync issues)
- Stop recording during brief pauses
- Worry about small mistakes (fix in post)

### After Recording

✅ **Download immediately:**
- Tracks are stored in browser memory
- Memory can be cleared by browser/system
- Download before closing browser

✅ **Verify downloads:**
- Check all expected files are present
- Verify file sizes are reasonable (not 0 KB)
- Test one file to ensure it plays

✅ **Organize files:**
- Create project folder: `2025-01-15_PodcastEp42/`
- Move all tracks into folder
- Keep original files as backup
- Work on copies for editing

✅ **Backup:**
- Upload to cloud storage (Dropbox, Google Drive)
- Multi-track recordings are irreplaceable
- Backup before starting heavy editing

---

## Troubleshooting

### Recording Not Starting

**Problem:** Click "Start Recording" but nothing happens

**Solutions:**
1. Verify at least one participant is **Live** (not backstage)
2. Check browser console (F12) for errors
3. Ensure participants have active streams (camera/mic on)
4. Refresh page and reconnect participants
5. Try Chrome browser (best compatibility)

### Missing Tracks After Stopping

**Problem:** Stopped recording but some tracks are missing

**Solutions:**
1. Check if participant disconnected during recording
2. Verify participant was **Live** (not backstage) when recording started
3. Check if participant's stream was active (not frozen)
4. Look for errors in browser console
5. Participants added mid-recording won't have full tracks

### Files Won't Download

**Problem:** Click "Download All Tracks" but downloads don't start

**Solutions:**
1. Check browser download permissions
2. Disable pop-up blocker for Streamlick
3. Ensure Downloads folder isn't full
4. Try downloading one track at a time (click individual files)
5. Check browser console for errors

### File Size Is Too Small

**Problem:** Downloaded file is only 50 KB (expected 500+ MB)

**Solutions:**
1. Recording may have failed to capture data
2. Check if participant's stream was frozen
3. Verify browser supports MediaRecorder API
4. Try re-recording with Chrome browser
5. Check if participant granted camera/mic permissions

### Audio/Video Out of Sync

**Problem:** Audio and video don't match in downloaded files

**Solutions:**
1. This is rare with WebM format (audio/video share timecode)
2. If using separate files, sync manually in editor
3. Use audio waveform alignment (look for speaking patterns)
4. Check if video dropped frames (system overload)
5. Re-record if sync is critical

### Huge File Sizes

**Problem:** Files are 5 GB+ for 30-minute recording

**Solutions:**
1. This is normal for 5 Mbps video bitrate
2. High quality requires large files
3. To reduce size: Use combined mode (not separate)
4. Or: Lower video resolution in stream settings
5. Or: Compress files after download (HandBrake)

### Participant Name Is Wrong

**Problem:** File is named "Unknown_audio.webm" or "Participant2_video.webm"

**Solutions:**
1. Participant names come from WebRTC connection
2. Set names before starting recording
3. Rename files manually after download
4. Use consistent naming in future sessions

---

## Comparison with Other Platforms

| Feature | Streamlick | Riverside.fm | Zoom | StreamYard |
|---------|-----------|--------------|------|-----------|
| **Multi-Track** | ✅ Free | ✅ $19/mo | ✅ Included | ❌ No |
| **Separate A/V** | ✅ Yes | ✅ Yes | ❌ No | N/A |
| **Quality** | 5 Mbps | 4 Mbps | 2 Mbps | N/A |
| **Processing** | Instant | Cloud (slow) | Instant | N/A |
| **File Naming** | Auto | Manual | Auto | N/A |
| **Participants** | Unlimited | 8 max | 1000 | N/A |
| **Download** | Instant | 10-30 min | Instant | N/A |

**Key Advantages:**
1. **Instant download:** No waiting for cloud processing (Riverside: 30 min wait)
2. **Free:** No monthly fees (Riverside: $19/mo)
3. **Separate audio/video:** Professional editing workflow (Zoom doesn't offer this)
4. **Unlimited participants:** Scale to large panels (Riverside: 8 max)

---

## Advanced Features

### Combining with Other Features

**Multi-Track + Clip Recording:**
- Multi-track: Full episode for editing
- Clip recording: Instant highlights during stream
- Best of both worlds: Archive + social media

**Multi-Track + AI Captions:**
- Captions visible during recording
- Embedded in video tracks
- Can extract captions for subtitles file
- Accessibility + editing

**Multi-Track + Background Removal:**
- Background effects recorded in video tracks
- Professional look without green screen
- No post-production needed for backgrounds

### Session Management

**Multiple recordings per stream:**
- You can start/stop recording multiple times
- Each session downloads separately
- Useful for:
  - Multi-segment shows
  - Before/after guest segments
  - Separate Q&A from main content

**File organization strategies:**

**Option 1: By Date**
```
/Recordings/2025-01-15/
  - producer-session_Host_audio.webm
  - producer-session_Host_video.webm
  - producer-session_Sarah_audio.webm
  - producer-session_Sarah_video.webm
```

**Option 2: By Episode**
```
/Podcast/Episode-042/
  - raw/
    - ep42_Host_audio.webm
    - ep42_Sarah_audio.webm
  - edited/
    - ep42_final_mix.mp3
  - notes.txt
```

**Option 3: By Speaker**
```
/Content/Sarah-Interview/
  - sarah_video.webm
  - sarah_audio.webm
  - host_video.webm
  - host_audio.webm
```

---

## Keyboard Shortcuts

Currently no keyboard shortcuts available.

**Requested for future:**
- `Ctrl/Cmd + Shift + R` - Start/stop multi-track recording
- `Ctrl/Cmd + D` - Download all tracks

---

## FAQ

**Q: Does multi-track recording affect stream performance?**
A: No, recording runs in background with minimal CPU impact (<5%).

**Q: Can I add participants mid-recording?**
A: Yes, but they'll only be recorded from the moment they join. Existing participants continue recording.

**Q: Are recordings saved to the cloud?**
A: No, recordings download directly to your computer. Upload manually if you want cloud backup.

**Q: What happens if my browser crashes?**
A: Recording is lost (memory-only). Download tracks immediately after stopping recording.

**Q: Can I record just audio (no video)?**
A: Yes, use separate mode and only import audio files into your editor. Video files can be ignored.

**Q: Do recordings include screen shares?**
A: Yes, if a participant is sharing their screen, that's what gets recorded for their track.

**Q: What's the maximum recording duration?**
A: Limited only by browser memory. Most browsers handle 2-3 hours comfortably.

**Q: Can guests control recording?**
A: No, only the host with Producer Mode access can start/stop multi-track recording.

**Q: Do tracks stay synced?**
A: Yes, WebM format includes timecode. Tracks should sync automatically in most editors.

**Q: Can I preview tracks before downloading?**
A: Not currently. Tracks must be downloaded to be played.

**Q: Why WebM format instead of MP4?**
A: WebM is browser-native (no conversion needed). Most editors support WebM. You can convert to MP4 after download if needed.

**Q: Can I record in stereo?**
A: Current implementation is mono (1 channel per participant). Stereo support planned for future.

---

## Converting to Other Formats

### WebM to MP4 (HandBrake - Free)
1. Download HandBrake: https://handbrake.fr
2. Open HandBrake, select .webm file
3. Choose **Fast 1080p30** preset
4. Click **Start Encode**
5. Output: .mp4 file (widely compatible)

### WebM to MP3 (Audacity - Free)
1. Open .webm file in Audacity
2. **File → Export → Export as MP3**
3. Choose bitrate (192 kbps recommended)
4. Output: .mp3 file (podcast standard)

### WebM to WAV (FFmpeg - Advanced)
```bash
ffmpeg -i input.webm -vn -acodec pcm_s16le output.wav
```

### Batch Conversion (FFmpeg)
```bash
for f in *.webm; do
  ffmpeg -i "$f" "${f%.webm}.mp4"
done
```

---

## Performance & System Requirements

### Recommended Specs

**Minimum:**
- CPU: Intel i5 / AMD Ryzen 5 (4 cores)
- RAM: 8 GB
- Storage: 10 GB free (for 1 hour recording)
- Browser: Chrome 90+

**Recommended:**
- CPU: Intel i7 / AMD Ryzen 7 (8 cores)
- RAM: 16 GB
- Storage: 50 GB free (SSD preferred)
- Browser: Chrome 120+ (latest)

### Resource Usage (per participant)

**Memory:**
- ~200 MB per track
- 4 participants (separate mode) = ~1.6 GB

**Storage:**
- ~38 MB per minute (video)
- ~1.4 MB per minute (audio)
- 60-minute episode, 3 people = ~7 GB

**CPU:**
- ~3-5% per participant
- 4 participants = ~15-20% CPU
- Modern multi-core CPUs handle this easily

**Bandwidth:**
- Recording uses 0 bandwidth (local only)
- Streaming bandwidth is separate (unchanged)

---

## Related Documentation

- **Clip Recording:** For instant highlights during stream
- **Producer Mode:** Advanced production controls
- **AI Captions:** Add captions to recordings

---

## Support

Having issues?
1. Check browser console (F12) for errors
2. Verify participants are connected and live
3. Test with Chrome (best compatibility)
4. Ensure sufficient disk space
5. Report bugs via GitHub Issues

---

## Version History

- **v1.0.0** - Initial release
  - Separate audio/video file option
  - Auto-naming with participant names
  - Real-time track monitoring
  - Instant download (no cloud processing)
  - 5 Mbps video, 192 kbps audio
  - Unlimited participants
