# Ant Media Server - Maximum Stability Configuration Checklist

> Based on Ant Media Enterprise real-world deployments, engineer recommendations, and known best practices.

## Quick Status Legend
- [ ] Not Done
- [x] Completed
- [⚠️] Needs Verification

---

## 1. Core Configuration (`antmedia.conf`)

Location: `/usr/local/antmedia/conf/antmedia.conf`

### Core Stability
- [ ] `WebRTCEnabled=true`
- [ ] `RTMPEnabled=true`
- [ ] `EnabledWriteStatsToDatastore=true`

### Network Tuning (ICE/TURN)
- [ ] `ICEServers=stun:stun.l.google.com:19302`
- [ ] `UseExternalIceCandidate=true`
- [ ] TURN server configured (if NAT issues exist):
  - [ ] `TurnServerUrl=turn:media.streamlick.com:3478`
  - [ ] `TurnServerUsername=<your-user>`
  - [ ] `TurnServerPassword=<your-pass>`

### WebRTC Settings
- [ ] `WebRTCFrameRate=30`
- [ ] `WebRTCFrameSendingPeriod=33`
- [ ] `WebRTCMaxBandwidth=3500`
- [ ] `WebRTCMinBitrate=500`
- [ ] `WebRTCTcpCandidatesEnabled=true`
- [ ] `StaticAspectRatio=true`

### Encoder Stability
- [ ] `TranscoderEnabled=true`
- [ ] `EncodingThreads=0` (auto-detection)
- [ ] `EncoderKeyFrameInterval=2` (every 2 sec for YouTube/FB)
- [ ] `EncoderPreset=veryfast`
- [ ] `EncoderLevel=42`
- [ ] `EncoderProfile=high`

### Recording Pipeline
- [ ] `Mp4MuxingEnabled=true`
- [ ] `Mp4MuxingFinishTimeout=20000`

### Buffer Safety
- [ ] `JitterBufferEnabled=true`
- [ ] `JitterBufferSuccessfulSendThreshold=2`

### RTMP Push Reconnection
- [ ] `ReconnectionAttemptCount=10`
- [ ] `ReconnectionDelayMillis=3000`
- [ ] `PushPublishTimeoutSec=60`

### Security & Logging
- [ ] `TokenControlEnabled=false` (or true if needed)
- [ ] `ServerLogLevel=INFO`

---

## 2. Application Configuration (`red5-web.properties`)

Location: `/usr/local/antmedia/webapps/StreamLick/WEB-INF/red5-web.properties`

### Publishing Settings
- [ ] `settings.publishResolutionAdaptiveness=false`
- [ ] `settings.forceAspectRatio=true`
- [ ] `settings.maxResolution=1920x1080`
- [ ] `settings.allowedPublisherBitrate=6000000`

### Latency Optimization
- [ ] `settings.minLatency=true`

### Codec Settings
- [ ] `settings.vp8Enabled=false`
- [ ] `settings.h264Enabled=true`

### Existing Settings (verify present)
- [ ] `settings.webRTCEnabled=true`
- [ ] `settings.rtmpEnabled=true`
- [ ] `settings.webRTCFrameRate=30`

---

## 3. FFmpeg Encoder Settings (`encoder_settings.json`)

Location: `/usr/local/antmedia/conf/encoder_settings.json`

### Video Settings
- [ ] `codec: libx264`
- [ ] `preset: veryfast`
- [ ] `bitrate: 3500k`
- [ ] `max_rate: 3500k`
- [ ] `bufsize: 4000k`
- [ ] `g: 60` (GOP size)
- [ ] `keyint_min: 60`
- [ ] `pix_fmt: yuv420p`
- [ ] `profile:v: high`

### Audio Settings
- [ ] `codec: aac`
- [ ] `bitrate: 128k`
- [ ] `channels: 2`
- [ ] `sample_rate: 48000`

---

## 4. Linux System Tuning (`sysctl.conf`)

Location: `/etc/sysctl.d/99-antmedia-streaming.conf`

### Network Buffer Tuning
- [ ] `net.core.rmem_max = 2500000`
- [ ] `net.core.wmem_max = 2500000`
- [ ] `net.ipv4.tcp_rmem = 4096 87380 2500000`
- [ ] `net.ipv4.tcp_wmem = 4096 65536 2500000`

### TCP Stack Optimization
- [ ] `net.ipv4.tcp_max_syn_backlog = 8192`
- [ ] `net.ipv4.tcp_fin_timeout = 15`
- [ ] `net.ipv4.tcp_tw_reuse = 1`

### Apply Settings
```bash
sudo sysctl -p /etc/sysctl.d/99-antmedia-streaming.conf
```

---

## 5. Firewall Configuration

### Required TCP Ports
- [ ] `5443` - HTTPS/WebSocket Signaling
- [ ] `5080` - HTTP Dashboard
- [ ] `1935` - RTMP
- [ ] `80` - HTTP (redirect to HTTPS)
- [ ] `443` - HTTPS (Nginx proxy)

### Required UDP Ports
- [ ] `50000-60000` - WebRTC Media (minimum range)
- [ ] `3478` - TURN Server (if configured)

### UFW Commands
```bash
sudo ufw allow 5443/tcp
sudo ufw allow 5080/tcp
sudo ufw allow 1935/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 50000:60000/udp
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
```

---

## 6. Nginx Reverse Proxy (Recommended)

Location: `/etc/nginx/sites-available/antmedia.conf`

### Configuration Checklist
- [ ] SSL certificate configured
- [ ] HTTP/2 enabled
- [ ] WebSocket upgrade headers set
- [ ] Proxy to 127.0.0.1:5443
- [ ] Proper timeout settings

---

## 7. Browser/Client WebRTC Settings

### Recommended Publishing Configuration
```javascript
const webRTCAdaptor = new WebRTCAdaptor({
  websocket_url: "wss://media.streamlick.com:5443/StreamLick/websocket",
  mediaConstraints: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 }
    },
    audio: true
  },
  peerconnection_config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:media.streamlick.com:3478",
        username: "user",
        credential: "pass"
      }
    ]
  }
});
```

### Canvas Streaming
- [ ] Use `canvas.captureStream(30)` - NOT 60fps
- [ ] Add audio track LAST to stream
- [ ] Maintain consistent frame timing

---

## 8. RTMP Push Destinations

### YouTube
- URL: `rtmp://a.rtmp.youtube.com/live2/KEY`
- Requires: 2-second keyframe interval

### Facebook
- URL: `rtmps://live-api.facebook.com:443/rtmp/KEY`
- Requires: CBR-like behavior, stable bitrate

### Reconnection Settings
- [ ] `ReconnectionAttemptCount=10`
- [ ] `ReconnectionDelayMillis=3000`
- [ ] `PushPublishTimeoutSec=60`

---

## 9. Hardware Requirements

### Minimum for 1080p + RTMP Push
- [ ] 8 vCPU
- [ ] 16GB RAM
- [ ] NVMe SSD
- [ ] Dedicated NIC (cloud ENA or Azure Accelerated Networking)

### GPU Transcoding (Optional)
- [ ] NVIDIA T4 or better
- [ ] `UseGPUTasks=true` in config

---

## 10. JVM Configuration

Location: `/usr/local/antmedia/conf/antmedia.env` or systemd service

### Recommended Settings
```bash
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ANT_MEDIA_HOME=/usr/local/antmedia
JAVA_OPTS="-Xms4g -Xmx8g -XX:+UseG1GC -XX:MaxGCPauseMillis=50"
```

### File Limits (systemd service)
- [ ] `LimitNOFILE=65535`
- [ ] `LimitNPROC=65535`

---

## 11. Verification - Success Indicators

### Logs Should Show:
- ✅ `New WebRTC publisher connected for streamId XYZ`
- ✅ `Incoming video resolution: 1280x720`
- ✅ `Outgoing RTMP: bitrate stable ~3500kbps`
- ✅ `No jitter or packet loss detected`
- ✅ `RTMP push alive: YouTube OK, Facebook OK`

### Logs Should NOT Show:
- ❌ `Packet loss detected`
- ❌ `JitterBuffer overflow`
- ❌ `Encoder overloaded`
- ❌ `Missed keyframe for RTMP`
- ❌ `Stream is lagging`

---

## 12. Quick Apply Scripts

### Apply All System Settings
```bash
# Copy sysctl config
sudo cp /home/streamlick/media-server/conf/99-antmedia-streaming.conf /etc/sysctl.d/
sudo sysctl -p /etc/sysctl.d/99-antmedia-streaming.conf

# Copy encoder settings
sudo cp /home/streamlick/media-server/conf/encoder_settings.json /usr/local/antmedia/conf/

# Update antmedia.conf
sudo cp /home/streamlick/media-server/conf/antmedia.conf /usr/local/antmedia/conf/

# Restart Ant Media
sudo systemctl restart antmedia
```

---

## Summary: Critical Settings for Maximum Stability

| Category | Key Settings |
|----------|-------------|
| **Bitrate** | 2500-3500 kbps constant |
| **Keyframe** | 2 seconds (every 60 frames at 30fps) |
| **Frame Rate** | 30 fps (NOT 60) |
| **Resolution** | 1280x720 or 1920x1080 |
| **Codec** | H.264 High Profile |
| **Preset** | veryfast (balance speed/quality) |
| **Buffer** | 4000k bufsize |
| **Jitter Buffer** | Enabled |
| **UDP Ports** | 50000-60000 open |
| **TURN Server** | Configured for NAT traversal |
