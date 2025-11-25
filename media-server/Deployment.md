# StreamLick Ant Media Server Deployment Guide

## Quick Reference

| Service | URL |
|---------|-----|
| Frontend | https://streamlick.com |
| Backend API | https://api.streamlick.com |
| Media Server | https://media.streamlick.com |

## Server Requirements

### Minimum (Development/Testing)
- Ubuntu 20.04/22.04/24.04 LTS
- **Java 17+** (required - Java 11 will NOT work)
- Maven 3.6+
- 4+ CPU cores, 8GB+ RAM
- Ports: 5080, 5443, 1935, 5000-65000/UDP

### Recommended (Production - Maximum Stability)
- **8 vCPU** (for 1080p + RTMP push)
- **16GB RAM**
- **NVMe SSD**
- Dedicated NIC (cloud ENA or Azure Accelerated Networking)
- NVIDIA T4 GPU (optional, for hardware transcoding)

---

## 0. Build Prerequisites & Installation

### Step 1: Install Java 17+

```bash
# Install Java 17
sudo apt update
sudo apt install -y openjdk-17-jdk

# Verify version (must be 17+)
java -version

# If multiple Java versions, select Java 17+
sudo update-alternatives --config java
```

### Step 2: Install Maven

```bash
sudo apt install -y maven

# Verify
mvn -version
```

### Step 3: Build from Source

```bash
# Navigate to media-server directory
cd /home/streamlick/media-server

# Clean Maven cache (if previous build failed)
rm -rf ~/.m2/repository

# Build (skip tests for faster build)
mvn clean package -DskipTests

# Verify build output
ls -la target/*.war
```

### Step 4: Install Base Ant Media Server

```bash
# Download and install base Ant Media Server
cd /tmp
wget https://github.com/ant-media/Ant-Media-Server/releases/download/ams-v2.9.1/ant-media-server-2.9.1-community.zip
unzip ant-media-server-2.9.1-community.zip
cd ant-media-server
sudo ./install.sh

# Verify installation
ls /usr/local/antmedia/
```

### Step 5: Deploy Custom Build

```bash
# Stop Ant Media
sudo systemctl stop antmedia

# Deploy your custom WAR
sudo cp /home/streamlick/media-server/target/*.war /usr/local/antmedia/webapps/root/ROOT.war

# Create StreamLick application
sudo mkdir -p /usr/local/antmedia/webapps/StreamLick
sudo cp -r /usr/local/antmedia/webapps/LiveApp/* /usr/local/antmedia/webapps/StreamLick/

# Set permissions
sudo chown -R antmedia:antmedia /usr/local/antmedia/

# Start Ant Media
sudo systemctl start antmedia
```

---

## 1. Environment Configuration

Create `/usr/local/antmedia/.env`:

```bash
# StreamLick Ant Media Server Configuration
# ==========================================

# Host address for WebRTC (CRITICAL - must be resolvable domain or IP)
AMS_HOST_ADDRESS=media.streamlick.com

# Backend API integration
BACKEND_API_URL=https://api.streamlick.com
MEDIA_SERVER_SECRET=WINNQtUarXx+enelc2tWa7mbBPETQs4moYtqS12F14Q=

# Redis for session management
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=INFO
NODE_ENV=production
```

---

## 2. Server Configuration

Edit `/usr/local/antmedia/conf/red5.properties`:

```properties
# Server Identity
server.name=media.streamlick.com

# HTTP/HTTPS Ports
http.host=0.0.0.0
http.port=5080
https.port=5443

# SSL Certificates (Let's Encrypt paths)
http.ssl_certificate_file=conf/fullchain.pem
http.ssl_certificate_chain_file=conf/chain.pem
http.ssl_certificate_key_file=conf/privkey.pem

# RTMP Configuration
rtmp.host=0.0.0.0
rtmp.port=1935

# Use domain name for WebRTC
useGlobalIp=false

# Logging
logLevel=INFO
nativeLogLevel=ERROR
```

---

## 3. Application Configuration

Create/Edit `/usr/local/antmedia/webapps/StreamLick/WEB-INF/red5-web.properties`:

```properties
webapp.contextPath=/StreamLick
webapp.virtualHosts=*

# Database
db.app.name=StreamLick
db.name=streamlick
db.type=mapdb
db.host=localhost

# Enable WebRTC
settings.webRTCEnabled=true

# Enable RTMP output for multi-destination
settings.rtmpEnabled=true

# Recording (optional)
settings.mp4MuxingEnabled=false
settings.hlsMuxingEnabled=false

# Token security for production
settings.publishTokenControlEnabled=true
settings.playTokenControlEnabled=false

# WebRTC frame rate
settings.webRTCFrameRate=30

# Accept streams only from authenticated sources
settings.acceptOnlyStreamsInDataStore=false
```

---

## 4. SSL Setup (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d media.streamlick.com

# Copy to Ant Media
sudo cp /etc/letsencrypt/live/media.streamlick.com/fullchain.pem /usr/local/antmedia/conf/
sudo cp /etc/letsencrypt/live/media.streamlick.com/chain.pem /usr/local/antmedia/conf/
sudo cp /etc/letsencrypt/live/media.streamlick.com/privkey.pem /usr/local/antmedia/conf/

# Set permissions
sudo chown -R antmedia:antmedia /usr/local/antmedia/conf/*.pem

# Or use the built-in SSL script
sudo /usr/local/antmedia/enable_ssl.sh -d media.streamlick.com
```

---

## 5. Firewall Configuration

```bash
# UFW
sudo ufw allow 5080/tcp   # HTTP Dashboard
sudo ufw allow 5443/tcp   # HTTPS Dashboard/WebRTC Signaling
sudo ufw allow 1935/tcp   # RTMP
sudo ufw allow 5000:65000/udp  # WebRTC Media

# Verify
sudo ufw status
```

---

## 6. Systemd Service

Create `/etc/systemd/system/antmedia.service`:

```ini
[Unit]
Description=Ant Media Server
After=network.target redis.service

[Service]
Type=simple
User=root
EnvironmentFile=/usr/local/antmedia/.env
WorkingDirectory=/usr/local/antmedia
ExecStart=/usr/local/antmedia/start.sh
ExecStop=/usr/local/antmedia/stop.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable antmedia
sudo systemctl start antmedia
```

---

## 7. Build and Deploy from Source

If deploying your modified version:

```bash
# Build
cd /home/streamlick/media-server
mvn clean package -DskipTests

# Stop current server
sudo systemctl stop antmedia

# Deploy WAR
sudo cp target/ant-media-server.war /usr/local/antmedia/webapps/root/ROOT.war

# Create StreamLick app
sudo mkdir -p /usr/local/antmedia/webapps/StreamLick
sudo cp -r /usr/local/antmedia/webapps/LiveApp/* /usr/local/antmedia/webapps/StreamLick/

# Start
sudo systemctl start antmedia
```

---

## 8. Verify Installation

```bash
# Check service status
sudo systemctl status antmedia

# Check logs
tail -f /usr/local/antmedia/log/ant-media-server.log

# Test HTTP endpoint
curl http://localhost:5080/StreamLick/rest/v2/version

# Test WebRTC endpoint (from browser)
# https://media.streamlick.com:5443/StreamLick/
```

---

## 9. API Endpoints

### Create Stream
```bash
curl -X POST "https://media.streamlick.com:5443/StreamLick/rest/v2/broadcasts/create" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-stream"}'
```

### Add RTMP Endpoint (Multi-Destination)
```bash
curl -X POST "https://media.streamlick.com:5443/StreamLick/rest/v2/broadcasts/{streamId}/rtmp-endpoint" \
  -H "Content-Type: application/json" \
  -d '{"rtmpUrl": "rtmp://a.rtmp.youtube.com/live2/YOUR-STREAM-KEY"}'
```

### Get Stream Info
```bash
curl "https://media.streamlick.com:5443/StreamLick/rest/v2/broadcasts/{streamId}"
```

### Get Publish Token
```bash
curl "https://media.streamlick.com:5443/StreamLick/rest/v2/broadcasts/{streamId}/token?expireDate=TIMESTAMP&type=publish"
```

---

## 10. Frontend Integration

Update frontend `.env`:

```bash
VITE_ANT_MEDIA_WEBSOCKET_URL=wss://media.streamlick.com:5443/StreamLick/websocket
VITE_ANT_MEDIA_REST_URL=https://media.streamlick.com:5443/StreamLick/rest/v2
```

WebRTC connection in browser:

```javascript
const webRTCAdaptor = new WebRTCAdaptor({
  websocket_url: "wss://media.streamlick.com:5443/StreamLick/websocket",
  mediaConstraints: { video: true, audio: true },
  peerconnection_config: {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  },
  callback: (info, obj) => console.log(info, obj),
  callbackError: (error, message) => console.error(error, message)
});

// Publish stream
webRTCAdaptor.publish("stream-id", token);
```

---

## 11. Backend Integration

Backend calls to media server:

```typescript
const ANT_MEDIA_URL = 'https://media.streamlick.com:5443/StreamLick/rest/v2';

// Create broadcast
const response = await fetch(`${ANT_MEDIA_URL}/broadcasts/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: broadcastName })
});

// Add RTMP destination
await fetch(`${ANT_MEDIA_URL}/broadcasts/${streamId}/rtmp-endpoint`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rtmpUrl: youtubeRtmpUrl })
});
```

---

## 12. Maximum Stability Configuration

> **IMPORTANT**: For production deployments streaming to YouTube/Facebook/Twitch, apply these stability settings.
> See `AMS-STABILITY-CHECKLIST.md` for a detailed verification checklist.

### Step 1: Apply Linux Kernel Tuning

```bash
# Copy sysctl configuration
sudo cp /home/streamlick/media-server/conf/99-antmedia-streaming.conf /etc/sysctl.d/

# Apply settings
sudo sysctl -p /etc/sysctl.d/99-antmedia-streaming.conf

# Update file limits
sudo bash -c 'cat >> /etc/security/limits.conf << EOF
antmedia soft nofile 65535
antmedia hard nofile 65535
antmedia soft nproc 65535
antmedia hard nproc 65535
EOF'
```

### Step 2: Install Stability Configuration Files

```bash
# Stop Ant Media
sudo systemctl stop antmedia

# Copy core configuration
sudo cp /home/streamlick/media-server/conf/antmedia.conf /usr/local/antmedia/conf/

# Copy encoder settings
sudo cp /home/streamlick/media-server/conf/encoder_settings.json /usr/local/antmedia/conf/

# Copy application properties (update existing)
sudo cp /home/streamlick/media-server/conf/red5-web.properties.template \
    /usr/local/antmedia/webapps/StreamLick/WEB-INF/red5-web.properties

# Set permissions
sudo chown -R antmedia:antmedia /usr/local/antmedia/

# Start Ant Media
sudo systemctl start antmedia
```

### Step 3: Configure Firewall for Stability

```bash
# Standard ports
sudo ufw allow 5080/tcp   # HTTP Dashboard
sudo ufw allow 5443/tcp   # HTTPS/WebSocket Signaling
sudo ufw allow 1935/tcp   # RTMP
sudo ufw allow 80/tcp     # HTTP (redirect)
sudo ufw allow 443/tcp    # HTTPS (Nginx)

# WebRTC Media - Use 50000-60000 for better stability
sudo ufw allow 50000:60000/udp

# TURN server (if configured)
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp

# Verify
sudo ufw status
```

### Step 4: Setup Nginx Reverse Proxy (Recommended)

```bash
# Install Nginx
sudo apt install -y nginx

# Copy configuration
sudo cp /home/streamlick/media-server/conf/nginx-antmedia.conf \
    /etc/nginx/sites-available/antmedia.conf

# Enable site
sudo ln -sf /etc/nginx/sites-available/antmedia.conf /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot certonly --webroot -w /var/www/html -d media.streamlick.com

# Reload Nginx
sudo systemctl reload nginx
```

### Step 5: Update Systemd Service for Stability

Update `/etc/systemd/system/antmedia.service`:

```ini
[Unit]
Description=Ant Media Server
After=network.target redis.service

[Service]
Type=simple
User=root
EnvironmentFile=/usr/local/antmedia/.env
WorkingDirectory=/usr/local/antmedia
ExecStart=/usr/local/antmedia/start.sh
ExecStop=/usr/local/antmedia/stop.sh
Restart=on-failure
RestartSec=10

# Stability settings
LimitNOFILE=65535
LimitNPROC=65535
Environment="JAVA_OPTS=-Xms4g -Xmx8g -XX:+UseG1GC -XX:MaxGCPauseMillis=50"

[Install]
WantedBy=multi-user.target
```

Apply:

```bash
sudo systemctl daemon-reload
sudo systemctl restart antmedia
```

### Step 6: Configure TURN Server (Optional but Recommended)

If users have NAT issues, configure a TURN server:

```bash
# Install coturn
sudo apt install -y coturn

# Edit /etc/turnserver.conf
realm=media.streamlick.com
listening-port=3478
external-ip=YOUR_PUBLIC_IP
user=streamlick:SECURE_PASSWORD
lt-cred-mech
fingerprint

# Enable and start
sudo systemctl enable coturn
sudo systemctl start coturn
```

Update `antmedia.conf`:
```
TurnServerUrl=turn:media.streamlick.com:3478
TurnServerUsername=streamlick
TurnServerPassword=SECURE_PASSWORD
```

---

## 13. Stability Configuration Reference

### Configuration Files in `/home/streamlick/media-server/conf/`:

| File | Purpose | Deploy To |
|------|---------|-----------|
| `antmedia.conf` | Core server settings | `/usr/local/antmedia/conf/` |
| `encoder_settings.json` | FFmpeg encoder tuning | `/usr/local/antmedia/conf/` |
| `red5-web.properties.template` | Application settings | `/usr/local/antmedia/webapps/StreamLick/WEB-INF/` |
| `99-antmedia-streaming.conf` | Linux kernel tuning | `/etc/sysctl.d/` |
| `nginx-antmedia.conf` | Nginx reverse proxy | `/etc/nginx/sites-available/` |

### Key Stability Settings:

| Setting | Value | Reason |
|---------|-------|--------|
| Frame Rate | 30fps | Lower CPU, more stable than 60fps |
| Keyframe Interval | 2 seconds | Required by YouTube/FB |
| Bitrate | 2500-3500 kbps | Sweet spot for 720p-1080p |
| Buffer Size | 4000k | Prevents rate spikes |
| Codec | H.264 High | Universal platform support |
| Preset | veryfast | Balance of speed/quality |
| Jitter Buffer | Enabled | Prevents drops under CPU load |
| Resolution Adaptiveness | Disabled | Prevents quality fluctuations |

---

## Troubleshooting

### WebRTC not connecting
- Check `AMS_HOST_ADDRESS` is set correctly
- Verify UDP ports 50000-60000 are open
- Check SSL certificate is valid
- Verify TURN server if behind NAT

### RTMP output failing
- Verify destination URL is correct
- Check firewall allows outbound 1935
- Verify keyframe interval is 2 seconds
- Look at logs: `tail -f /usr/local/antmedia/log/ant-media-server.log`

### High latency
- Reduce GOP size to 60 frames (2 sec at 30fps)
- Check network bandwidth
- Disable adaptive bitrate for lowest latency
- Enable jitter buffer

### "Stream is lagging" / Dropped Frames
- Enable jitter buffer in `antmedia.conf`
- Check CPU usage (should be < 80%)
- Verify encoder preset is `veryfast`
- Apply sysctl network tuning

### YouTube/Facebook "Unstable Stream" Warnings
- Verify keyframe interval is exactly 2 seconds
- Check bitrate is constant (use `max_rate` = `bitrate`)
- Ensure buffer size is set (4000k for 3500k bitrate)
- Disable resolution adaptiveness

### Packet Loss / JitterBuffer Overflow
- Enable `JitterBufferEnabled=true`
- Set `JitterBufferSuccessfulSendThreshold=2`
- Apply Linux sysctl tuning
- Increase network buffer sizes

---

## Quick Stability Check Script

Create `/home/streamlick/check-ams-stability.sh`:

```bash
#!/bin/bash
echo "=== Ant Media Server Stability Check ==="

# Check service status
echo -n "AMS Service: "
systemctl is-active antmedia

# Check sysctl settings
echo -n "Sysctl rmem_max: "
sysctl net.core.rmem_max | cut -d= -f2

# Check open ports
echo "Open UDP ports:"
sudo netstat -ulnp | grep -E "50000|60000"

# Check recent errors in logs
echo "Recent errors (last 5):"
grep -i "error\|exception\|failed" /usr/local/antmedia/log/ant-media-server.log | tail -5

# Check memory usage
echo "Memory usage:"
free -h | head -2

echo "=== Check Complete ==="
```

```bash
chmod +x /home/streamlick/check-ams-stability.sh
```
