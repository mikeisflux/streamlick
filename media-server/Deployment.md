# StreamLick Ant Media Server Deployment Guide

## Quick Reference

| Service | URL |
|---------|-----|
| Frontend | https://streamlick.com |
| Backend API | https://api.streamlick.com |
| Media Server | https://media.streamlick.com |

## Server Requirements

- Ubuntu 20.04/22.04 LTS
- Java 11+
- 4+ CPU cores, 8GB+ RAM
- Ports: 5080, 5443, 1935, 5000-65000/UDP

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

## Troubleshooting

### WebRTC not connecting
- Check `AMS_HOST_ADDRESS` is set correctly
- Verify UDP ports 5000-65000 are open
- Check SSL certificate is valid

### RTMP output failing
- Verify destination URL is correct
- Check firewall allows outbound 1935
- Look at logs: `tail -f /usr/local/antmedia/log/ant-media-server.log`

### High latency
- Reduce GOP size in settings
- Check network bandwidth
- Disable adaptive bitrate for lowest latency
