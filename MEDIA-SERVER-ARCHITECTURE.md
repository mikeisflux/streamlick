# Media Server Architecture & Scaling Guide

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│  ┌──────────────┐                                          │
│  │ Compositor   │ canvas.captureStream(30)                 │
│  │ (Canvas)     │ ──────────────┐                          │
│  └──────────────┘                │                          │
│                                   ▼                          │
│                          ┌─────────────────┐                │
│                          │ WebRTC Producer │                │
│                          │  (video/audio)  │                │
│                          └────────┬────────┘                │
└─────────────────────────────────┼──────────────────────────┘
                                   │ WebRTC
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                     MediaSoup Server                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Router (manages guests + compositor stream)       │     │
│  │  - Creates Plain RTP transports                    │     │
│  │  - Forwards to Media Server(s)                     │     │
│  └──────────────────┬─────────────────────────────────┘     │
└─────────────────────┼───────────────────────────────────────┘
                      │ Plain RTP (video/audio)
                      ▼
┌──────────────────────────────────────────────────────────────┐
│              Media Server Pool (Load Balanced)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Media Server 1│  │Media Server 2│  │Media Server N│      │
│  │              │  │              │  │              │      │
│  │ Mode: Daily  │  │ Mode: Daily  │  │ Mode: FFmpeg │      │
│  │ Status: ●    │  │ Status: ●    │  │ Status: ●    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
    ┌─────────┐        ┌─────────┐       ┌─────────┐
    │Daily.co │        │Daily.co │       │ FFmpeg  │
    │  Room   │        │  Room   │       │ Process │
    └────┬────┘        └────┬────┘       └────┬────┘
         │                  │                  │
         │ RTMP             │ RTMP             │ RTMP
         ▼                  ▼                  ▼
    ┌─────────────────────────────────────────────────┐
    │      YouTube / Facebook / Twitch / etc          │
    └─────────────────────────────────────────────────┘
```

---

## 📦 Media Server Components

### 1. Daily Mode (Recommended)
- **Path**: RTP → Daily.co → RTMP → Platforms
- **Pros**: Zero CPU, managed reconnection, scalable
- **Cons**: Costs $0.015/min per stream
- **Use Case**: Production, high reliability needed

### 2. FFmpeg Mode (Legacy)
- **Path**: RTP → FFmpeg → RTMP → Platforms
- **Pros**: No external costs, full control
- **Cons**: High CPU, manual error handling
- **Use Case**: Development, cost-sensitive deployments

---

## ⚙️ Configuration

### Environment Variables

**Media Server** (`.env` in `media-server/`):
```bash
# Streaming Method: 'ffmpeg' or 'daily'
STREAMING_METHOD=daily

# Backend API URL (for Daily room creation)
BACKEND_API_URL=http://localhost:3000

# MediaSoup Configuration
MEDIASOUP_ANNOUNCED_IP=your.server.ip
MEDIASOUP_WORKERS=2

# External FFmpeg (for distributed setup)
EXTERNAL_FFMPEG=false
```

**Backend** (`.env` in `backend/`):
```bash
# Daily.co API Key (set via /admin/settings)
# Stored encrypted in system_settings table
```

---

## 🚀 Deployment Scenarios

### Single Media Server (Simple)

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://...
      - ENCRYPTION_KEY=...
    ports:
      - "3000:3000"

  media-server:
    build: ./media-server
    environment:
      - STREAMING_METHOD=daily
      - BACKEND_API_URL=http://backend:3000
      - MEDIASOUP_ANNOUNCED_IP=your.public.ip
    ports:
      - "3001:3001"
      - "40000-40100:40000-40100/udp"  # WebRTC
```

**Capacity**: ~10 concurrent broadcasts

---

### Multiple Media Servers (Load Balanced)

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"

  media-server-1:
    build: ./media-server
    environment:
      - STREAMING_METHOD=daily
      - BACKEND_API_URL=http://backend:3000
      - SERVER_ID=media-1
    ports:
      - "3001:3001"
      - "40000-40100:40000-40100/udp"

  media-server-2:
    build: ./media-server
    environment:
      - STREAMING_METHOD=daily
      - BACKEND_API_URL=http://backend:3000
      - SERVER_ID=media-2
    ports:
      - "3002:3001"
      - "40100-40200:40000-40100/udp"

  # Load balancer
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx-load-balancer.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
    depends_on:
      - media-server-1
      - media-server-2
```

**Capacity**: ~20+ concurrent broadcasts (scales linearly)

---

## 📊 Load Balancing Strategy

### Option 1: Round Robin (Simple)

**Nginx Config**:
```nginx
upstream media_servers {
    server media-server-1:3001;
    server media-server-2:3001;
    server media-server-3:3001;
}

server {
    listen 80;
    location /socket.io/ {
        proxy_pass http://media_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Option 2: Least Connections (Smart)

```nginx
upstream media_servers {
    least_conn;  # Route to server with fewest active connections
    server media-server-1:3001;
    server media-server-2:3001;
    server media-server-3:3001;
}
```

### Option 3: Redis-Based Discovery (Advanced)

**Backend registers media servers**:
```typescript
// backend/src/services/media-server-registry.service.ts
import Redis from 'ioredis';

const redis = new Redis();

export async function registerMediaServer(serverId: string, url: string) {
  await redis.hset('media-servers', serverId, JSON.stringify({
    url,
    registeredAt: Date.now(),
    activeStreams: 0,
  }));

  // Set expiry (heartbeat)
  await redis.expire(`media-server:${serverId}`, 60);
}

export async function getAvailableMediaServer(): Promise<string> {
  const servers = await redis.hgetall('media-servers');

  // Find server with lowest activeStreams
  let bestServer = null;
  let minStreams = Infinity;

  for (const [serverId, data] of Object.entries(servers)) {
    const parsed = JSON.parse(data);
    if (parsed.activeStreams < minStreams) {
      minStreams = parsed.activeStreams;
      bestServer = parsed.url;
    }
  }

  return bestServer || 'http://media-server-1:3001';
}
```

**Frontend uses dynamic URL**:
```typescript
const mediaServerUrl = await api.get('/media-servers/assign');
mediaServerSocketService.connect(mediaServerUrl.data.url);
```

---

## 🔥 Auto-Scaling (Kubernetes)

```yaml
# k8s/media-server-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: media-server
spec:
  replicas: 3  # Start with 3 instances
  selector:
    matchLabels:
      app: media-server
  template:
    metadata:
      labels:
        app: media-server
    spec:
      containers:
      - name: media-server
        image: streamlick/media-server:latest
        env:
        - name: STREAMING_METHOD
          value: "daily"
        - name: BACKEND_API_URL
          value: "http://backend:3000"
        ports:
        - containerPort: 3001
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: media-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: media-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # Scale up at 70% CPU
```

**Result**: Auto-scales from 2 to 10 media servers based on CPU load

---

## 📈 Health Monitoring

### Media Server Health Check

Add to `media-server/src/index.ts`:
```typescript
app.get('/health', (req, res) => {
  const activeStreams = broadcasts.size;
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  res.json({
    status: 'ok',
    activeStreams,
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    uptime: Math.round(process.uptime()),
  });
});
```

### Prometheus Metrics

```typescript
import prometheus from 'prom-client';

const activeStreamsGauge = new prometheus.Gauge({
  name: 'media_server_active_streams',
  help: 'Number of active streams',
});

const streamingMethodGauge = new prometheus.Gauge({
  name: 'media_server_streaming_method',
  help: 'Streaming method (0=ffmpeg, 1=daily)',
  labelNames: ['method'],
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

---

## 🔒 Security Considerations

### 1. Media Server Registration

**Problem**: Anyone can connect to media server
**Solution**: Require authentication token

```typescript
// media-server/src/index.ts
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  // Verify token with backend
  axios.post(`${process.env.BACKEND_API_URL}/api/verify-media-server-token`, {
    token,
  }).then(() => {
    next();
  }).catch(() => {
    next(new Error('Authentication failed'));
  });
});
```

### 2. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 💰 Cost Optimization

### Daily.co Mode

| Streams | Duration | Cost/Hour |
|---------|----------|-----------|
| 1 destination | 1 hour | $1.14 |
| 2 destinations | 1 hour | $2.04 |
| 3 destinations | 1 hour | $2.94 |

**Break-even vs VPS**: ~20 hours/month at $20/month VPS

### Hybrid Mode (Best of Both)

```typescript
// Use Daily for important streams, FFmpeg for testing
const streamingMethod = broadcast.isProd ? 'daily' : 'ffmpeg';
process.env.STREAMING_METHOD = streamingMethod;
```

---

## 🧪 Testing Guide

### Test Media Server Scaling

1. **Start 2 media servers**:
   ```bash
   # Terminal 1
   cd media-server
   SERVER_ID=media-1 PORT=3001 npm run dev

   # Terminal 2
   cd media-server
   SERVER_ID=media-2 PORT=3002 npm run dev
   ```

2. **Start 2 broadcasts simultaneously**:
   - Browser 1 → Broadcast A → Should connect to media-1
   - Browser 2 → Broadcast B → Should connect to media-2

3. **Verify load distribution**:
   ```bash
   # Check media-1
   curl http://localhost:3001/health

   # Check media-2
   curl http://localhost:3002/health
   ```

### Test Daily Mode

1. **Set environment**:
   ```bash
   cd media-server
   STREAMING_METHOD=daily npm run dev
   ```

2. **Start broadcast** → Check logs for:
   ```
   [Daily Pipeline] Creating Daily pipeline for broadcast...
   [Daily Media Server] Room created: streamlick-broadcast-xxx
   [Daily Media Server] Successfully joined Daily room
   [Daily Pipeline] ✅ Daily pipeline created successfully
   ```

3. **Verify on Daily dashboard**:
   - Visit https://dashboard.daily.co
   - Check active rooms
   - Monitor RTMP connections

---

## 🚨 Troubleshooting

### Issue: Media server not connecting to backend
**Solution**: Check `BACKEND_API_URL` and firewall rules

### Issue: Daily room creation fails
**Solution**: Verify Daily API key in `/admin/settings`

### Issue: High latency with multiple servers
**Solution**: Use geographic load balancing (route users to nearest server)

### Issue: Media server crashes under load
**Solution**:
1. Increase `MEDIASOUP_WORKERS` (2-4 per CPU core)
2. Add more media server instances
3. Enable auto-scaling

---

## 📚 References

- [Daily.co Server SDK](https://docs.daily.co/)
- [MediaSoup Documentation](https://mediasoup.org/)
- [Nginx Load Balancing](https://docs.nginx.com/nginx/admin-guide/load-balancer/)
- [Kubernetes HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
