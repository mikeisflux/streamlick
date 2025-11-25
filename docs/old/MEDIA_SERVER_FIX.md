# Media Server Configuration Fix

## Issues Found in .env

1. ❌ **Duplicate MEDIASOUP_ANNOUNCED_IP** - IPv6 overwrites IPv4
2. ❌ **Port conflict** - Both PORT=3003 and MEDIA_SERVER_PORT=3001 defined
3. ⚠️ **Small RTC port range** - Only 100 ports vs 10,000 in PM2 config

## Fix on Media Server (streamlick-media-1)

Run these commands on the media server:

```bash
# Navigate to media server directory
cd /home/streamlick/media-server

# Backup current .env
cp .env .env.backup

# Create fixed .env file
cat > .env << 'EOF'
# ====================================
# STREAMLICK MEDIA SERVER CONFIGURATION
# ====================================

# Server Configuration
MEDIA_SERVER_PORT=3001

# Frontend URL (for CORS)
FRONTEND_URL=https://streamlick.com

# MediaSoup WebRTC Configuration
# Use IPv4 for announced IP (most WebRTC clients prefer IPv4)
MEDIASOUP_ANNOUNCED_IP=178.156.200.171

# Number of mediasoup workers
MEDIASOUP_WORKERS=2

# UDP port range for WebRTC connections (matches PM2 config)
# Large range needed for concurrent streams
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Environment & Logging
NODE_ENV=production
LOG_LEVEL=info
EOF

# Restart media server to apply changes
cd /home/streamlick
pm2 restart streamlick-media-server

# Wait a moment for restart
sleep 3

# Check status
pm2 status
pm2 logs streamlick-media-server --lines 30
```

## Verify Fixed Configuration

After applying the fix, verify:

1. **Port listening**: `netstat -tulpn | grep 3001`
2. **Health check**: `curl http://localhost:3001/health`
3. **PM2 status**: Process should show "online" with no restarts

## What Was Fixed

### Before:
```env
MEDIA_SERVER_PORT=3001
MEDIASOUP_ANNOUNCED_IP=178.156.200.171
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40100      # Only 100 ports!
MEDIASOUP_ANNOUNCED_IP=2a01:4ff:f0:9c40::1  # Overwrites IPv4!
PORT=3003                          # Conflicts with MEDIA_SERVER_PORT
```

### After:
```env
MEDIA_SERVER_PORT=3001            # Single port definition
MEDIASOUP_ANNOUNCED_IP=178.156.200.171  # Single IP (IPv4)
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999      # 10,000 ports for concurrency
# No conflicting variables
```

## IPv6 Considerations

If you need IPv6 support:
1. Change `MEDIASOUP_ANNOUNCED_IP=2a01:4ff:f0:9c40::1`
2. Ensure firewall allows UDP ports 40000-49999 on IPv6
3. Test WebRTC clients support IPv6
4. You may need dual-stack (both IPv4 and IPv6)

For most deployments, **IPv4 is recommended** for better WebRTC compatibility.

## Firewall Rules Check

Ensure these ports are open on the media server:

```bash
# Check UFW status (if using UFW)
ufw status

# Required ports:
# - TCP 3001 (Media server HTTP/WebSocket)
# - UDP 40000-49999 (WebRTC media)

# Add rules if needed:
ufw allow 3001/tcp
ufw allow 40000:49999/udp
```

## Troubleshooting

If WebRTC still fails after fix:

1. **Check announced IP matches public IP**:
   ```bash
   curl ifconfig.me
   # Should return: 178.156.200.171
   ```

2. **Test WebSocket connection** from browser console:
   ```javascript
   const ws = new WebSocket('wss://media.streamlick.com');
   ws.onopen = () => console.log('Connected!');
   ws.onerror = (err) => console.error('Failed:', err);
   ```

3. **Check nginx proxy** for media.streamlick.com:
   ```bash
   nginx -t
   systemctl status nginx
   ```

4. **View real-time logs**:
   ```bash
   pm2 logs streamlick-media-server --lines 100
   ```
