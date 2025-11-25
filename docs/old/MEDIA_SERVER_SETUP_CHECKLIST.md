# Media Server Setup Checklist

This guide ensures your media server is properly configured for Streamlick.

## ✅ Prerequisites

- [ ] Node.js v22.x installed (`node --version` should show v22.x.x)
- [ ] TypeScript installed globally (`npm install -g typescript`)
- [ ] PM2 installed globally (`npm install -g pm2`)
- [ ] Server has a public IP address
- [ ] Ports 40000-40100 (UDP/TCP) are open in firewall

---

## 📝 Step 1: Environment Variables (.env file)

**Location:** `/home/streamlick/media-server/.env`

```bash
# Create .env file
cd /home/streamlick/media-server
nano .env
```

**Required Variables:**

```env
# CRITICAL: Server Port
MEDIA_SERVER_PORT=3001

# CRITICAL: Frontend URL (must match your actual frontend URL)
FRONTEND_URL=https://streamlick.com

# CRITICAL: Your server's PUBLIC IP address (NOT localhost!)
MEDIASOUP_ANNOUNCED_IP=178.156.200.171

# Worker Configuration
MEDIASOUP_WORKERS=2
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40100

# Redis
REDIS_URL=redis://localhost:6379

# Environment
NODE_ENV=production
LOG_LEVEL=info
```

### ⚠️ Common Mistakes:
- ❌ Using `127.0.0.1` for `MEDIASOUP_ANNOUNCED_IP` (clients can't connect)
- ❌ Using `http://localhost:3002` for `FRONTEND_URL` in production
- ❌ Forgetting to set `NODE_ENV=production`

---

## 📝 Step 2: Frontend Environment Variables

**Location:** `/home/streamlick/frontend/.env`

```bash
cd /home/streamlick/frontend
nano .env
```

**Required Variables:**

```env
# CRITICAL: Must point to your API server
VITE_API_URL=https://streamlick.com/api

# CRITICAL: Must point to your MEDIA SERVER (different from API!)
VITE_MEDIA_SERVER_URL=http://YOUR_MEDIA_SERVER_IP:3001

# Example if media server is on same domain:
# VITE_MEDIA_SERVER_URL=https://streamlick.com

# Example if media server is on different server:
# VITE_MEDIA_SERVER_URL=http://178.156.200.171:3001
```

### ⚠️ Common Mistakes:
- ❌ Setting `VITE_MEDIA_SERVER_URL` to the same as `VITE_API_URL`
- ❌ Not rebuilding frontend after changing env vars (`npm run build`)
- ❌ Forgetting the port (`:3001`) if media server is not on port 80/443

---

## 📝 Step 3: Firewall Configuration

### UFW (Ubuntu Firewall)

```bash
# Allow media server port
ufw allow 3001/tcp

# Allow WebRTC ports (CRITICAL!)
ufw allow 40000:40100/udp
ufw allow 40000:40100/tcp

# Check status
ufw status
```

### AWS Security Groups / Cloud Firewalls

If running on AWS/GCP/Azure/Hetzner:

1. **Inbound Rules:**
   - Port 3001 (TCP) from anywhere (or your frontend IP)
   - Ports 40000-40100 (UDP) from anywhere
   - Ports 40000-40100 (TCP) from anywhere

2. **Outbound Rules:**
   - Allow all outbound traffic

---

## 📝 Step 4: Install Dependencies

```bash
cd /home/streamlick/media-server

# Clean install
rm -rf node_modules package-lock.json
npm install
```

**Expected Output:**
- Should install `mediasoup`, `socket.io`, `express`, etc.
- mediasoup will download prebuilt binaries or compile from source
- No errors should occur

### ⚠️ Troubleshooting npm install:

**If mediasoup fails to build:**
```bash
# Install build dependencies
apt-get install -y python3 build-essential

# Try again
npm install
```

---

## 📝 Step 5: Build TypeScript

```bash
cd /home/streamlick/media-server
npm run build
```

**Expected Output:**
- Creates `dist/` directory
- No TypeScript errors
- File `dist/index.js` exists

### ⚠️ Troubleshooting Build Errors:

**If you see TypeScript errors:**
```bash
# Check TypeScript version
tsc --version  # Should be 5.3.x

# Check package.json has @types/node
cat package.json | grep @types/node  # Should show "@types/node": "^22.0.0"

# Clean and rebuild
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

---

## 📝 Step 6: Start with PM2

```bash
cd /home/streamlick/media-server

# Start the service
pm2 start dist/index.js --name streamlick-media-server

# Save PM2 configuration
pm2 save

# Enable startup on boot
pm2 startup
# (Run the command it outputs)

# Check status
pm2 status
```

**Expected Output:**
```
┌─────┬────────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name                   │ mode    │ status  │ cpu      │
├─────┼────────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ streamlick-media-server│ fork    │ online  │ 0%       │
└─────┴────────────────────────┴─────────┴─────────┴──────────┘
```

---

## 📝 Step 7: Verify Configuration

### Check Logs

```bash
pm2 logs streamlick-media-server --lines 50
```

**Expected Log Output:**
```
Environment validation passed
  MEDIASOUP_ANNOUNCED_IP: 178.156.200.171
  FRONTEND_URL: https://streamlick.com
  NODE_ENV: production
Creating 2 mediasoup workers...
Mediasoup worker created [pid:12345]
Mediasoup worker created [pid:12346]
🎥 Streamlick Media Server running on port 3001
Environment: production
```

### ⚠️ Look for These Errors:

❌ **"Environment validation failed"**
   - Fix your .env file

❌ **"MEDIASOUP_ANNOUNCED_IP cannot be localhost"**
   - Change to your public IP

❌ **"All mediasoup workers have died!"**
   - Check if ports 40000-40100 are available

### Test Health Endpoint

```bash
# Test locally
curl http://localhost:3001/health

# Test from outside (use your server's IP)
curl http://178.156.200.171:3001/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T...",
  "activeStreams": 0,
  "cpuUsage": 5,
  "memoryUsage": 23,
  "uptime": 45,
  "memory": {
    "used": 128,
    "total": 256,
    "external": 15
  },
  "system": {
    "platform": "linux",
    "cpuCount": 4,
    "totalMemory": 8,
    "freeMemory": 5
  }
}
```

---

## 📝 Step 8: Test WebRTC Connection

### From Browser Console (on your frontend):

```javascript
// Open browser console on streamlick.com
// Should see these logs:
"Connecting to media server: http://YOUR_IP:3001"
"Media server socket connected"
"WebRTC device initialized"
```

### ⚠️ Common Issues:

❌ **"Media server connection timeout"**
   - Check `VITE_MEDIA_SERVER_URL` in frontend .env
   - Check firewall allows port 3001
   - Check media server is running (`pm2 status`)

❌ **"Failed to get RTP capabilities"**
   - Check media server health endpoint
   - Check CORS settings (FRONTEND_URL in media server .env)

❌ **WebRTC fails to connect**
   - Check ports 40000-40100 are open in firewall
   - Check `MEDIASOUP_ANNOUNCED_IP` is your PUBLIC IP
   - Check browser console for ICE connection errors

---

## 📝 Step 9: Nginx Configuration (Optional)

If you want to proxy the media server through Nginx on port 443:

```nginx
server {
    listen 443 ssl http2;
    server_name streamlick.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/streamlick.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/streamlick.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Media Server HTTP endpoints
    location /broadcasts {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Media Server Socket.io (CRITICAL for WebRTC signaling)
    location /socket.io/media {
        proxy_pass http://localhost:3001/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

**Then update frontend .env:**
```env
VITE_MEDIA_SERVER_URL=https://streamlick.com
```

---

## 🔍 Debugging Checklist

If studio still won't load:

### 1. Check All Services Running
```bash
pm2 status
# Should show: streamlick-api, streamlick-frontend, streamlick-media-server all "online"
```

### 2. Check Frontend Environment
```bash
cd /home/streamlick/frontend
cat .env | grep MEDIA_SERVER
# Should show correct media server URL
```

### 3. Check Media Server Logs
```bash
pm2 logs streamlick-media-server --lines 100
```

### 4. Check Browser Console
Press F12 in browser, look for:
- ✅ "Media server socket connected"
- ✅ "WebRTC device initialized"
- ❌ Any errors about connection or timeouts

### 5. Test Network Connectivity
```bash
# From your local machine
curl http://YOUR_MEDIA_SERVER_IP:3001/health

# Test WebSocket connection
wscat -c ws://YOUR_MEDIA_SERVER_IP:3001/socket.io/?EIO=4&transport=websocket
```

### 6. Check Firewall
```bash
# On media server
ufw status | grep 3001
ufw status | grep 40000

# Should show ports allowed
```

---

## 📊 Performance Tuning

### Adjust Worker Count

For better performance with many concurrent streams:

```env
# In media-server/.env
# 1 worker per CPU core is good, but 2-4 is usually enough
MEDIASOUP_WORKERS=4
```

### Adjust Port Range

For more concurrent connections:

```env
# Each connection needs ~2 ports, so 200 ports = ~100 connections per worker
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40200
```

---

## ✅ Final Checklist

- [ ] Media server .env file created with correct values
- [ ] Frontend .env updated with media server URL
- [ ] Node.js v22 installed
- [ ] Dependencies installed (`npm install`)
- [ ] TypeScript compiled (`npm run build`)
- [ ] Firewall ports open (3001, 40000-40100)
- [ ] PM2 service running and online
- [ ] Health endpoint returns 200 OK
- [ ] Browser console shows "Media server socket connected"
- [ ] Studio page loads without errors

---

## 🆘 Still Having Issues?

1. Check PM2 logs: `pm2 logs streamlick-media-server --lines 200`
2. Check browser console for errors (F12)
3. Verify all environment variables are correct
4. Restart all services: `pm2 restart all`
5. Check this file for missed steps

**Common solution:** 99% of issues are caused by:
- Wrong `MEDIASOUP_ANNOUNCED_IP` (using localhost instead of public IP)
- Firewall blocking ports 40000-40100
- Frontend `.env` not pointing to correct media server URL
- Not rebuilding frontend after changing `.env`
