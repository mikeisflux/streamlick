# Daily.co Deployment Quick Start Guide

## 🚀 Complete Flow: Browser → Media Server → Daily → Platforms

This guide shows how to deploy Streamlick with Daily.co integration for RTMP streaming.

---

## Architecture

```
┌─────────────────────────┐
│  Browser (Compositor)   │
│  - Canvas rendering     │
│  - Guest management     │
└───────────┬─────────────┘
            │ WebRTC
            ▼
┌─────────────────────────┐
│   MediaSoup Server      │
│  - WebRTC SFU           │
│  - Plain RTP output     │
└───────────┬─────────────┘
            │ RTP
            ▼
┌─────────────────────────┐
│    Media Server         │  ← You deploy via /admin/infrastructure
│  - Mode: Daily or FFmpeg│
│  - STREAMING_METHOD env │
└───────────┬─────────────┘
            │
    ┌───────┴────────┐
    ▼                ▼
┌─────────┐    ┌─────────┐
│ Daily.co│    │ FFmpeg  │
│  (NEW)  │    │(Legacy) │
└────┬────┘    └────┬────┘
     │              │
     │ RTMP         │ RTMP
     ▼              ▼
┌─────────────────────────┐
│  YouTube / Facebook     │
│  Twitch / LinkedIn      │
└─────────────────────────┘
```

---

## Step 1: Configure Backend

### Add Daily API Key

1. Go to `/admin/settings`
2. Scroll to **Infrastructure & Deployment**
3. Add **Daily.co API Key**
4. Save

```bash
# Or set via environment
DAILY_API_KEY=your-api-key-here
```

---

## Step 2: Deploy Media Server with Daily

### Via Admin UI (Recommended)

1. Go to `/admin/infrastructure?tab=media-server`
2. Click **"Deploy New Server"**
3. Fill in:
   - **Name**: `media-server-daily-01`
   - **Role**: Media Server
   - **Server Type**: CCX13 (2 vCPU, 8GB RAM)
   - **Location**: Nuremberg, Germany
   - **Streaming Method**: Daily.co (Recommended) ✅
   - **Backend API URL**: `https://api.streamlick.com`
4. Click **"Deploy Server"**

**Result**: Server deployed in ~2 minutes with Daily configured

### Manual Deployment

```bash
# SSH into server
ssh root@your-server-ip

# Clone repo
git clone https://github.com/your-org/streamlick.git
cd streamlick/media-server

# Install dependencies
npm install

# Configure environment
cat > .env <<EOF
STREAMING_METHOD=daily
BACKEND_API_URL=https://api.streamlick.com
MEDIASOUP_ANNOUNCED_IP=$(curl -s ifconfig.me)
PORT=3001
EOF

# Start server
npm run dev
```

---

## Step 3: Test the Flow

### 1. Create Broadcast

```bash
# Go to /studio
# Click "Create New Broadcast"
```

### 2. Connect Destinations

```bash
# Go to Destinations panel
# Connect YouTube/Facebook/Twitch
# Select which platforms to stream to
```

### 3. Go Live

```bash
# Click "Go Live"
# Wait for countdown
```

### Behind the Scenes:

1. **Browser** renders compositor canvas
2. **Browser** sends WebRTC to MediaSoup
3. **MediaSoup** creates Plain RTP transport
4. **Media Server** receives RTP
5. **Media Server** calls Daily API to create room
6. **Media Server** joins Daily room (server-side)
7. **Media Server** calls Daily API to start RTMP streaming
8. **Daily** handles RTMP output to all platforms
9. **Platforms** receive stable, reliable stream

---

## Step 4: Monitor Costs

### Daily.co Dashboard

Visit: https://dashboard.daily.co

**Usage Breakdown:**
- **Participant Minutes**: Only media server counts = $0.004/min
- **RTMP Output**: $0.015/min per destination
- **Total Example**: 1-hour stream to 2 platforms
  - 60 min × $0.004 = $0.24 (participant)
  - 60 min × $0.015 × 2 = $1.80 (RTMP)
  - **Total**: $2.04/hour

---

## Troubleshooting

### Issue: "Daily API key not configured"

**Solution**: Set key in `/admin/settings` → System Config

### Issue: Media server can't reach backend

**Solution**: Check `BACKEND_API_URL` in media server `.env`

### Issue: RTMP stream not starting

**Check:**
1. Daily API key is valid
2. Media server logs: `journalctl -u media-server -f`
3. Daily dashboard for active rooms
4. Destinations are properly connected

### Issue: High costs

**Solution**:
- Use FFmpeg mode for development/testing
- Daily mode only for production streams
- Set `STREAMING_METHOD=ffmpeg` to switch

---

## Comparison: FFmpeg vs Daily

| Aspect | FFmpeg Mode | Daily Mode |
|--------|-------------|------------|
| **CPU Usage** | High (transcoding) | Zero (offloaded) |
| **Cost** | VPS only (~$20/mo) | Pay-per-use (~$1-2/hour) |
| **Reliability** | Manual error handling | Auto-reconnection |
| **Scalability** | Limited by VPS | Unlimited |
| **Setup** | Simple | Requires API key |
| **Best For** | Development, testing | Production streams |

---

## Deployment Scenarios

### Single Media Server (Simple)

```yaml
# Good for: 1-10 concurrent broadcasts
services:
  media-server:
    environment:
      - STREAMING_METHOD=daily
      - BACKEND_API_URL=https://api.streamlick.com
```

**Cost**: ~$15/month VPS + Daily usage

### Multiple Media Servers (Load Balanced)

```yaml
# Good for: 10+ concurrent broadcasts
services:
  media-server-1:
    environment:
      - STREAMING_METHOD=daily
      - SERVER_ID=media-1

  media-server-2:
    environment:
      - STREAMING_METHOD=daily
      - SERVER_ID=media-2

  nginx-lb:
    # Load balances between servers
```

**Cost**: ~$30/month VPS + Daily usage
**Capacity**: 20+ concurrent broadcasts

### Kubernetes Auto-Scaling

```yaml
# Good for: Variable load, enterprise
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: media-server-hpa
spec:
  minReplicas: 2
  maxReplicas: 10
  # Scales based on CPU usage
```

**Cost**: Variable based on load
**Capacity**: Virtually unlimited

---

## Advanced Configuration

### Hybrid Mode (Best of Both Worlds)

Use Daily for production, FFmpeg for testing:

```typescript
// backend/src/services/broadcast.service.ts
const streamingMethod = broadcast.environment === 'production'
  ? 'daily'   // Production: Use Daily
  : 'ffmpeg'; // Dev/Test: Use FFmpeg

await mediaServer.configure({ streamingMethod });
```

### Geographic Load Balancing

Deploy media servers in multiple regions:

```bash
# US East
media-server-us-east-1 (Ashburn)

# EU
media-server-eu-central-1 (Frankfurt)

# Route users to nearest server
```

---

## Monitoring

### Health Checks

```bash
# Check media server health
curl http://media-server-ip:3001/health

# Response:
{
  "status": "ok",
  "activeStreams": 3,
  "streamingMethod": "daily",
  "memory": { "used": 512, "total": 8192 },
  "uptime": 86400
}
```

### Daily Dashboard Metrics

Monitor at https://dashboard.daily.co:
- Active rooms
- RTMP connections
- Bandwidth usage
- Cost breakdown
- Error rates

---

## Security Checklist

- ✅ Daily API key stored encrypted
- ✅ Media server requires authentication
- ✅ RTMP stream keys encrypted
- ✅ Backend API uses HTTPS
- ✅ Firewall rules configured
- ✅ Rate limiting enabled

---

## Next Steps

1. ✅ Configure Daily API key
2. ✅ Deploy media server via infrastructure UI
3. ✅ Test with single broadcast
4. ✅ Monitor costs on Daily dashboard
5. ⏭️ Scale to multiple servers if needed
6. ⏭️ Set up geographic load balancing
7. ⏭️ Configure auto-scaling (K8s)

---

## Support Resources

- **Architecture Guide**: `MEDIA-SERVER-ARCHITECTURE.md`
- **Integration Guide**: `DAILY-INTEGRATION-GUIDE.md`
- **Daily Docs**: https://docs.daily.co
- **Hetzner Console**: https://console.hetzner.cloud

---

## TL;DR

```bash
# 1. Add Daily API key in /admin/settings
# 2. Deploy media server in /admin/infrastructure
#    → Select "Daily.co (Recommended)"
# 3. Start broadcast in /studio
# 4. Monitor costs at daily.co/dashboard
# 5. Scale by deploying more media servers
```

**Done!** 🎉
