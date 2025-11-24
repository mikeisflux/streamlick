# Go Live Testing Plan

## Pre-Flight Checklist

### 1. Verify Media Server (on streamlick-media-1)
```bash
# SSH to media server
ssh root@streamlick-media-1

# Check PM2 status
pm2 status
# Expected: streamlick-media-server should show "online"

# Check logs for errors
pm2 logs streamlick-media-server --lines 50
# Expected: No error messages, should show "Media Server running on port 3001"

# Verify port is listening
ss -tuln | grep 3001
# Expected: tcp LISTEN on 0.0.0.0:3001

# Test health endpoint locally
curl http://localhost:3001/health
# Expected: JSON response with status "ok"
```

### 2. Verify Main Server (on streamlick)
```bash
# Check backend is running
pm2 status | grep streamlick-backend
# Expected: streamlick-backend should show "online"

# Test backend health
curl http://localhost:3000/api/health
# Expected: Success response

# Check nginx is proxying media server correctly
curl -I https://media.streamlick.com/health
# Expected: HTTP 200 OK (not 403)
```

---

## Frontend Testing Steps

### Step 1: Open Studio Page
1. Navigate to: `https://streamlick.com/studio/[broadcast-id]`
2. **Check browser console** for errors
3. **Expected console logs**:
   ```
   [Studio Init] Starting initialization for broadcast: xxx
   [Studio Init] Loading broadcast data...
   [Studio Init] Loading destinations...
   [Studio Init] Loaded destinations: N
   [Studio Init] Starting camera...
   [Studio Init] Loading devices...
   [Studio Init] Connecting socket...
   [Studio Init] Initialization complete
   ```

### Step 2: Connect Media Server WebSocket
**Check browser console for:**
```
Connecting to media server: https://media.streamlick.com
Media server socket connected
```

**If you see errors:**
```
WebSocket connection to 'wss://media.streamlick.com/socket.io/...' failed
```
→ This means nginx or media server config issue

### Step 3: Select Destination
1. Click **"Destinations"** button in header
2. **Connect a YouTube or Facebook destination** if not already connected
3. **Check the checkbox** to select the destination
4. **Set privacy** (try "Unlisted" for testing)
5. **Optionally set schedule** (leave empty for immediate start)

**Expected:**
- Privacy dropdown shows: Public, Unlisted, Private, Members Only (YouTube)
- Date/time picker appears below privacy settings

### Step 4: Test Go Live

#### 4A. Click "Go Live" Button
**Browser console should show:**
```
[Studio Init] WebRTC initialization started
Creating WebRTC transports...
Send transport created
Receive transport created
WebRTC initialization complete
```

#### 4B. Monitor Network Tab
1. Open DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. **Should see connection to**: `wss://media.streamlick.com/socket.io/...`
4. **Status**: 101 Switching Protocols (success)

#### 4C. Check Backend Logs
```bash
pm2 logs streamlick-backend --lines 50
```
**Expected to see:**
```
Creating YouTube live broadcast
YouTube broadcast created: [broadcast-id] (privacy: unlisted)
Broadcast prepared with N destinations
```

#### 4D. Check Media Server Logs
```bash
pm2 logs streamlick-media-server --lines 50
```
**Expected to see:**
```
Media socket connected: [socket-id]
Create transport: [transport-id]
Producer created: [producer-id]
```

---

## Common Issues & Fixes

### Issue 1: "Media server connection timeout after 10 seconds"
**Cause**: WebSocket cannot connect to media server
**Fix**:
```bash
# On media server, check nginx config
cat /etc/nginx/sites-enabled/streamlick | grep -A 20 "media.streamlick.com"

# Should include WebSocket upgrade:
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection 'upgrade';
```

### Issue 2: "Failed to create transport"
**Cause**: MEDIASOUP_ANNOUNCED_IP incorrect or firewall blocking
**Fix**:
```bash
# Verify announced IP matches public IP
cat /home/streamlick/media-server/.env | grep MEDIASOUP_ANNOUNCED_IP
curl ifconfig.me  # Should match!

# Check firewall allows UDP ports
ufw status | grep 40000:49999
```

### Issue 3: "Please select at least one destination"
**Cause**: No destinations checked in Destinations panel
**Fix**:
1. Open Destinations drawer
2. Click checkbox next to YouTube/Facebook destination
3. Ensure destination shows "Connected" status

### Issue 4: "Failed to go live"
**Cause**: Could be YouTube API, compositor, or RTMP issue
**Check**:
```bash
# Backend logs for specific error
pm2 logs streamlick-backend --lines 100 | grep -i error

# Common errors:
# - "YouTube token expired" → Reconnect destination
# - "No composite stream" → Compositor initialization failed
# - "Failed to produce" → WebRTC issue
```

---

## Success Indicators

✅ **WebSocket Connected**
```
Browser Console: "Media server socket connected"
```

✅ **WebRTC Transport Created**
```
Browser Console: "Send transport created"
Browser Console: "Receive transport created"
```

✅ **YouTube Broadcast Created**
```
Backend Logs: "YouTube broadcast created: xxx (privacy: unlisted)"
```

✅ **RTMP Streaming Started**
```
Media Server Logs: "RTMP streaming started for broadcast xxx"
```

✅ **Frontend Shows "LIVE"**
```
Red "LIVE" indicator appears in Studio header
```

---

## Test Matrix

| Feature | Test Case | Expected Result |
|---------|-----------|----------------|
| Privacy | Set YouTube to "Unlisted" | YouTube shows unlisted broadcast |
| Privacy | Set YouTube to "Private" | YouTube shows private broadcast |
| Privacy | Set YouTube to "Members Only" | YouTube shows members-only broadcast |
| Scheduling | Set future time | Broadcast created with scheduled time |
| Scheduling | Leave empty | Broadcast starts immediately |
| Multi-destination | Select YouTube + Facebook | Both platforms receive stream |

---

## Quick Verification Script

Run this on the main server to verify everything:

```bash
#!/bin/bash
echo "=== STREAMLICK GO LIVE VERIFICATION ==="
echo ""

echo "1. Checking backend..."
curl -s http://localhost:3000/api/health > /dev/null && echo "✅ Backend OK" || echo "❌ Backend FAIL"

echo "2. Checking media server connectivity..."
curl -s -o /dev/null -w "%{http_code}" https://media.streamlick.com/health | grep -q "200" && echo "✅ Media server OK" || echo "❌ Media server FAIL"

echo "3. Checking PM2 processes..."
pm2 status | grep -q "online" && echo "✅ PM2 processes OK" || echo "❌ PM2 processes FAIL"

echo ""
echo "=== If all checks pass, Go Live should work ==="
```

---

## Next Steps After Successful Test

1. Test with real YouTube account
2. Verify privacy settings reflect on YouTube
3. Test scheduled streams
4. Test multi-platform streaming
5. Test recording during live stream
6. Monitor performance under load
