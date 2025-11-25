#!/bin/bash
# StreamLick Ant Media Server - Stability Configuration Installer
# Run this on your production server as root

set -e

echo "=== StreamLick AMS Stability Configuration Installer ==="

# Create directories
mkdir -p /usr/local/antmedia/conf
mkdir -p /usr/local/antmedia/webapps/StreamLick/WEB-INF

# 1. Create sysctl configuration
echo "Creating sysctl configuration..."
cat > /etc/sysctl.d/99-antmedia-streaming.conf << 'EOF'
# StreamLick Ant Media Server - Linux Kernel Network Tuning
net.core.rmem_max = 2500000
net.core.wmem_max = 2500000
net.core.rmem_default = 1000000
net.core.wmem_default = 1000000
net.ipv4.tcp_rmem = 4096 87380 2500000
net.ipv4.tcp_wmem = 4096 65536 2500000
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fastopen = 3
net.core.netdev_max_backlog = 50000
vm.swappiness = 10
fs.inotify.max_user_watches = 524288
fs.file-max = 2097152
EOF

# Apply sysctl
echo "Applying sysctl settings..."
sysctl -p /etc/sysctl.d/99-antmedia-streaming.conf || true

# 2. Update file limits
echo "Updating file limits..."
if ! grep -q "antmedia soft nofile" /etc/security/limits.conf; then
    cat >> /etc/security/limits.conf << 'EOF'
antmedia soft nofile 65535
antmedia hard nofile 65535
antmedia soft nproc 65535
antmedia hard nproc 65535
EOF
fi

# 3. Create antmedia.conf
echo "Creating antmedia.conf..."
cat > /usr/local/antmedia/conf/antmedia.conf << 'EOF'
# StreamLick Ant Media Server - Maximum Stability Configuration

# Core
WebRTCEnabled=true
RTMPEnabled=true
EnabledWriteStatsToDatastore=true

# ICE/STUN
ICEServers=stun:stun.l.google.com:19302
UseExternalIceCandidate=true
WebRTCTcpCandidatesEnabled=true

# WebRTC Settings
WebRTCFrameRate=30
WebRTCFrameSendingPeriod=33
WebRTCMaxBandwidth=3500
WebRTCMinBitrate=500
StaticAspectRatio=true

# Encoder Stability
TranscoderEnabled=true
EncodingThreads=0
EncoderKeyFrameInterval=2
EncoderPreset=veryfast
EncoderLevel=42
EncoderProfile=high

# Recording
Mp4MuxingEnabled=true
Mp4MuxingFinishTimeout=20000

# Jitter Buffer
JitterBufferEnabled=true
JitterBufferSuccessfulSendThreshold=2

# RTMP Push Reconnection
ReconnectionAttemptCount=10
ReconnectionDelayMillis=3000
PushPublishTimeoutSec=60

# Security & Logging
TokenControlEnabled=false
ServerLogLevel=INFO
gopSize=60
EOF

# 4. Create encoder_settings.json
echo "Creating encoder_settings.json..."
cat > /usr/local/antmedia/conf/encoder_settings.json << 'EOF'
{
  "video": {
    "codec": "libx264",
    "preset": "veryfast",
    "bitrate": "3500k",
    "max_rate": "3500k",
    "bufsize": "4000k",
    "g": "60",
    "keyint_min": "60",
    "pix_fmt": "yuv420p",
    "profile:v": "high",
    "level": "4.2",
    "tune": "zerolatency",
    "x264opts": "keyint=60:min-keyint=60:no-scenecut"
  },
  "audio": {
    "codec": "aac",
    "bitrate": "128k",
    "channels": 2,
    "sample_rate": 48000,
    "profile:a": "aac_low"
  }
}
EOF

# 5. Create/Update red5-web.properties
echo "Creating red5-web.properties..."
cat > /usr/local/antmedia/webapps/StreamLick/WEB-INF/red5-web.properties << 'EOF'
webapp.contextPath=/StreamLick
webapp.virtualHosts=*

# Database
db.app.name=StreamLick
db.name=streamlick
db.type=mapdb
db.host=localhost

# WebRTC & RTMP
settings.webRTCEnabled=true
settings.rtmpEnabled=true
settings.webRTCFrameRate=30

# Stability Settings
settings.publishResolutionAdaptiveness=false
settings.forceAspectRatio=true
settings.maxResolution=1920x1080
settings.allowedPublisherBitrate=6000000
settings.minLatency=true

# Codec Settings
settings.vp8Enabled=false
settings.h264Enabled=true
settings.vp9Enabled=false
settings.av1Enabled=false
settings.preferH264=true

# Recording
settings.mp4MuxingEnabled=false
settings.hlsMuxingEnabled=false
settings.webMMuxingEnabled=false

# Security
settings.publishTokenControlEnabled=true
settings.playTokenControlEnabled=false
settings.acceptOnlyStreamsInDataStore=false

# Stability
settings.enableAdaptiveBitrate=false
settings.gopSize=60
settings.jitterBufferEnabled=true
settings.constantBitrate=true
settings.audioSampleRate=48000
settings.audioChannels=2
EOF

# 6. Set permissions
echo "Setting permissions..."
chown -R antmedia:antmedia /usr/local/antmedia/ 2>/dev/null || true

# 7. Restart Ant Media
echo "Restarting Ant Media Server..."
systemctl restart antmedia || echo "Note: Could not restart antmedia service"

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Verify with:"
echo "  systemctl status antmedia"
echo "  tail -f /usr/local/antmedia/log/ant-media-server.log"
echo ""
echo "Don't forget to configure firewall:"
echo "  ufw allow 5443/tcp"
echo "  ufw allow 1935/tcp"
echo "  ufw allow 50000:60000/udp"
