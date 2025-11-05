# 💰 Streamlick Scaling Costs & Strategy

**Updated: January 2025** | Pricing in USD (converted from EUR at 1.08 rate)

---

## 🎯 Quick Recommendation

**Start with CPX32 ($11.35/month) for API, scale with CCX13/CCX23 ($13.50-$26.50) for media**

- ✅ CPX32 + CCX23 combo = best performance for production
- ✅ CPX (newer AMD EPYC-Genoa) > CX (older hardware, resource-limited)
- ✅ Shared CPU perfect for API/Frontend (low CPU usage)
- ✅ Dedicated CPU required for media servers (high CPU encoding)
- ✅ Total 100 streams: **$249/month** (9× CCX23 + 1× CPX32)

---

## 📊 Hetzner Cloud Pricing (2025 - ACCURATE)

### Shared CPU (CPX Series) - **RECOMMENDED** for API/Frontend

**Best Performance:** Newer AMD EPYC-Genoa processors, 30%+ faster than CX

| Model | vCPU | RAM | Storage | Traffic | Price/Month | Use Case |
|-------|------|-----|---------|---------|-------------|----------|
| CPX11 | 2 | 2GB | 40GB NVMe | 20TB | €~5.00 (~$5.40) | Small testing |
| CPX22 | 3 | 4GB | 80GB NVMe | 20TB | €~7.00 (~$7.60) | Light API |
| **CPX32** | 4 | 8GB | 160GB NVMe | 20TB | **€10.49 (~$11.35)** | **API + Frontend** ⭐ |
| CPX42 | 8 | 16GB | 240GB NVMe | 20TB | €~20.00 (~$21.60) | High traffic API |
| CPX52 | 16 | 32GB | 360GB NVMe | 20TB | €~40.00 (~$43.20) | Enterprise API |

**Why CPX32 is recommended:**
- ✅ Newer AMD EPYC-Genoa processors (30%+ faster than CX)
- ✅ Better sustained performance
- ✅ 160GB storage (2× more than CX33)
- ✅ Better disk I/O
- ✅ Worth the extra $5/month over CX33

### Budget Option: CX Series (NOT Recommended for Production)

⚠️ **WARNING: CX runs on older/recycled hardware. Severely resource-limited. Use only for testing!**

| Model | vCPU | RAM | Storage | Traffic | Price/Month | Use Case |
|-------|------|-----|---------|---------|-------------|----------|
| CX23 | 2 | 4GB | 40GB NVMe | 20TB | €3.49 (~$3.80) | Testing only |
| CX33 | 4 | 8GB | 80GB NVMe | 20TB | €5.49 (~$6.00) | Testing only |
| CX43 | 8 | 16GB | 160GB NVMe | 20TB | €9.49 (~$10.30) | Testing only |

⚠️ **WARNING: DO NOT use CX/CPX series for media servers!** Shared CPU = dropped frames, stuttering, poor quality.

### Dedicated CPU (CCX Series) - For Media Servers

| Model | vCPU | RAM | Storage | Traffic | Price/Month | Streams | $/Stream |
|-------|------|-----|---------|---------|-------------|---------|----------|
| **CCX13** | 2 | 8GB | 80GB NVMe | 20TB | **€12.49 (~$13.50)** | 3-5 | $3.38 |
| **CCX23** | 4 | 16GB | 160GB NVMe | 20TB | **€24.49 (~$26.50)** | 8-12 | $2.65 ⭐ |
| **CCX33** | 8 | 32GB | 240GB NVMe | 30TB | **€48.49 (~$52.50)** | 20-25 | $2.33 |
| CCX43 | 16 | 64GB | 360GB NVMe | 40TB | €96.49 (~$104.50) | 40-50 | $2.32 |
| CCX53 | 32 | 128GB | 600GB NVMe | 50TB | €192.49 (~$208.50) | 80-100 | $2.35 |
| CCX63 | 48 | 192GB | 960GB NVMe | 60TB | €288.49 (~$312.50) | 120-150 | $2.34 |

**Note:** Stream capacity assumes 1080p @ 30fps, 6 Mbps bitrate with WebRTC + FFmpeg encoding.

### ARM64 Cost-Optimized (CAX Series) - For API/Frontend

| Model | vCPU | RAM | Storage | Traffic | Price/Month | Use Case |
|-------|------|-----|---------|---------|-------------|----------|
| CAX11 | 2 | 4GB | 40GB | 20TB | €3.79 (~$4.10) | API (ARM compatible apps) |
| CAX21 | 4 | 8GB | 80GB | 20TB | €6.49 (~$7.00) | API (good alternative to CX33) |
| CAX31 | 8 | 16GB | 160GB | 20TB | €12.49 (~$13.50) | API (high performance) |
| CAX41 | 16 | 32GB | 320GB | 20TB | €24.49 (~$26.50) | API (very high performance) |

⚠️ **Note:** Requires ARM64-compatible Docker images. Not recommended unless you're familiar with ARM architecture.

---

## ⚡ Why Shared CPU (CX) vs Dedicated CPU (CCX)?

### Shared CPU (CX/CAX) Characteristics

**Perfect for:**
- ✅ API servers (bursty, low average CPU)
- ✅ Web frontends (mostly idle, occasional spikes)
- ✅ Database queries
- ✅ WebSocket connections
- ✅ Background jobs

**NOT suitable for:**
- ❌ FFmpeg video encoding (continuous high CPU)
- ❌ Media streaming (can't tolerate CPU throttling)
- ❌ Real-time processing (inconsistent performance)

**Performance:**
- CPU is shared with other VMs on same host
- Can burst to 100% CPU temporarily
- Throttled during sustained high usage
- "Noisy neighbor" effects possible

### Dedicated CPU (CCX) Characteristics

**Required for:**
- ✅ FFmpeg encoding (smooth, no dropped frames)
- ✅ Live streaming (consistent performance)
- ✅ Real-time media processing
- ✅ Production-quality video

**Performance:**
- 100% CPU available at all times
- No throttling ever
- Predictable, consistent performance
- No "noisy neighbor" issues

---

## 🚀 Optimal Architecture for Streamlick

```
┌─────────────────────────────────────────────────────────┐
│                     RECOMMENDED SETUP                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  API + Frontend Server: CPX32 (Shared CPU)             │
│  ┌────────────────────────────────────────────┐        │
│  │  • Node.js backend API                      │        │
│  │  • React frontend                           │        │
│  │  • PostgreSQL database                      │        │
│  │  • Redis cache                              │        │
│  │  • Nginx reverse proxy                      │        │
│  │  • Low average CPU usage = perfect for CPX │        │
│  │  • AMD EPYC-Genoa = 30%+ faster than CX    │        │
│  └────────────────────────────────────────────┘        │
│                      ↓ Load balancer                    │
│  ┌─────────────────┬──────────────────┬───────────────┐│
│  │  Media Server 1 │  Media Server 2  │ Media Server 3││
│  │  CCX13/CCX23    │  CCX13/CCX23     │  CCX13/CCX23  ││
│  │  (Dedicated CPU)│  (Dedicated CPU) │ (Dedicated CPU)││
│  ├─────────────────┼──────────────────┼───────────────┤│
│  │ • Mediasoup SFU │ • Mediasoup SFU  │ • Mediasoup SFU│
│  │ • FFmpeg encode │ • FFmpeg encode  │ • FFmpeg encode│
│  │ • RTMP streaming│ • RTMP streaming │ • RTMP streaming│
│  │ • 100% CPU usage│ • 100% CPU usage │ • 100% CPU usage│
│  │ • Needs CCX!    │ • Needs CCX!     │ • Needs CCX!   │
│  └─────────────────┴──────────────────┴───────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Why this works:**
1. API server has LOW average CPU (mostly idle) → Shared CPU (CPX) saves money
2. CPX32 has newer AMD EPYC-Genoa processors → 30%+ faster than CX
3. Media servers have HIGH continuous CPU (encoding) → Dedicated CPU (CCX) required
4. Best of both worlds: Good performance + Reasonable cost

---

## 💰 Cost-Effective Scaling Path

### Phase 1: Testing ($3.80/month)

```
1× CX23 (all-in-one) - Budget option
├─ API + Frontend + Media Server (all on one box)
├─ Capacity: 1-2 test streams (low bitrate only)
└─ Cost: €3.49/month (~$3.80)
```

⚠️ **Note:** Shared CPU will struggle with encoding. Only for testing, not production!

---

### Phase 2: Production Start ($24.85/month)

```
1× CPX32 (API + Frontend) - $11.35
1× CCX13 (Media Server) - $13.50
────────────────────────────────
Total: $24.85/month
Capacity: 3-5 streams
Cost per stream: ~$6.21
```

**Perfect for:** Solo creators, small agencies starting out

---

### Phase 3: Small Business ($64.85/month)

```
1× CPX32 (API + Frontend) - $11.35
2× CCX13 (Media Servers) - $27.00
1× CCX23 (Media Server) - $26.50
────────────────────────────────
Total: $64.85/month
Capacity: 14-17 streams
Cost per stream: ~$4.32
```

**Perfect for:** Growing agencies with 5-15 active clients

---

### Phase 4: Medium Business ($117.35/month)

```
1× CPX32 (API + Frontend) - $11.35
4× CCX23 (Media Servers) - $106.00
────────────────────────────────
Total: $117.35/month
Capacity: 32-48 streams
Cost per stream: ~$2.93
```

**Perfect for:** Established agencies with 20-40 clients

---

### Phase 5: Large Scale - 100 Streams ($249.85/month)

```
1× CPX32 (API + Frontend) - $11.35
9× CCX23 (Media Servers) - $238.50
────────────────────────────────
Total: $249.85/month
Capacity: 72-108 streams (avg 90)
Cost per stream: ~$2.78
```

**Perfect for:** Large platforms with 60-100+ concurrent users

---

## 📈 Cost Comparison: 100 Concurrent Streams

| Architecture | Monthly Cost | Servers | Management | Redundancy |
|--------------|--------------|---------|------------|------------|
| **CPX32 + 9× CCX23** | **$249.85** | 10 | Medium | ⭐⭐⭐⭐ Excellent |
| CPX32 + 5× CCX33 | $273.85 | 6 | Easy | ⭐⭐⭐ Good |
| CPX32 + 20× CCX13 | $281.35 | 21 | Hard | ⭐⭐⭐⭐⭐ Maximum |

**Winner: CPX32 + 9× CCX23**
- Best cost per stream ($2.78)
- Good balance of management complexity
- Excellent redundancy (10 servers)
- Easy to scale up/down by 8-12 streams at a time
- CPX32 has 30%+ better performance than CX series

---

## 🎯 Decision Matrix

| Your Situation | Recommended Setup | Monthly Cost |
|----------------|-------------------|--------------|
| Just testing | 1× CX23 (budget) | $3.80 |
| 1-5 streams | **CPX32 + CCX13** | **$24.85** |
| 5-15 streams | CPX32 + 2× CCX13 + CCX23 | $64.85 |
| 15-30 streams | CPX32 + 2× CCX23 | $64.35 |
| 30-50 streams | CPX32 + 3× CCX23 | $90.85 |
| 50-80 streams | CPX32 + 5× CCX23 | $143.85 |
| 80-120 streams | CPX32 + 9× CCX23 | $249.85 |
| 120+ streams | CPX52 + CCX43/CCX53 | Custom |

---

## 💸 Total Cost of Ownership (TCO)

### Scenario 1: YouTube/Twitch Creator (5-10 streams)

```
Setup: CPX32 + 2× CCX13

Monthly Costs:
├─ Hosting: $38.35/month
├─ Domain: $1/month (amortized)
├─ SSL: FREE (Let's Encrypt)
└─ Total: $39.35/month

Alternative (Restream.io):
├─ Restream Pro: $41/month
├─ Less features
└─ No customization

You save: $1.65/month + full control + better performance
Annual savings: $19.80/year
```

---

### Scenario 2: Streaming Agency (50 clients, 30 concurrent)

```
Setup: CPX32 + 3× CCX23

Monthly Costs:
├─ Hosting: $90.85/month
├─ Domain: $1/month
├─ Monitoring: FREE (self-hosted)
└─ Total: $91.85/month

Revenue:
├─ 50 clients × $30/month = $1,500/month
└─ Annual revenue: $18,000

Profit: $18,000 - $1,102.20 = $16,897.80/year
Margin: 93.9%

Alternative (White-label Restream):
├─ Estimated cost: $500+/month for 50 clients
└─ Less customization, vendor lock-in

You save: $400+/month
Annual savings: $4,800+/year
```

---

### Scenario 3: Large Platform (100 concurrent streams)

```
Setup: CPX32 + 9× CCX23

Monthly Costs:
├─ Hosting: $249.85/month
├─ Domain: $1/month
├─ Monitoring: $10/month (optional DataDog)
└─ Total: $260.85/month

Revenue (if monetized):
├─ 200 users × $15/month = $3,000/month
└─ Annual revenue: $36,000

Profit: $36,000 - $3,130.20 = $32,869.80/year
Margin: 91.3%

Cost per stream: $2.60/stream/month
```

---

## 🔧 Technical Recommendations

### For API/Frontend Server (Shared CPU)

**CPX32** ($11.35/month): ⭐ **RECOMMENDED**
- 👍 Perfect for: Production deployments (5-200 streams)
- 👍 4 vCPU, 8GB RAM, 160GB storage
- 👍 Newer AMD EPYC-Genoa processors (30%+ faster than CX)
- 👍 Handles API + PostgreSQL + Redis + Nginx comfortably
- 👍 Best balance of performance and cost
- ✅ **This is the sweet spot for most deployments**

**CPX22** ($7.60/month):
- 👍 Perfect for: Very small production (1-10 streams)
- 👎 Only 4GB RAM may be tight for PostgreSQL + Redis

**CPX42** ($21.60/month):
- 👍 Perfect for: High traffic production (200+ streams)
- 👍 8 vCPU, 16GB RAM for complex queries and high concurrency
- 👎 Overkill for most deployments

**Budget Option: CX23** ($3.80/month):
- 👍 Perfect for: Testing only
- 👎 Severely resource-limited, old hardware
- ⚠️ NOT recommended for production

---

### For Media Servers (Dedicated CPU - CCX)

**CCX13** ($13.50/month):
- 👍 Perfect for: Granular scaling, maximum redundancy
- 👍 3-5 streams per server
- 👍 Start small, add servers as needed
- 👎 More servers to manage at scale

**CCX23** ($26.50/month): ⭐ **RECOMMENDED**
- 👍 Perfect for: Best cost per stream ($2.65)
- 👍 8-12 streams per server
- 👍 Sweet spot for most deployments
- 👍 Fewer servers to manage

**CCX33** ($52.50/month):
- 👍 Perfect for: Larger deployments wanting fewer servers
- 👍 20-25 streams per server
- 👎 More expensive per server
- 👎 Less redundancy (fewer servers)

**CCX43+** ($104.50+/month):
- 👎 Generally not recommended for horizontal scaling
- 👍 Consider only for >200 concurrent streams

---

## ⚡ Scaling Triggers (Auto-Recommendations)

The MediaServerPool service provides automatic scaling recommendations:

**🟢 Normal** (< 60% capacity):
- Average < 5 streams per CCX13
- Average < 9 streams per CCX23
- Average < 18 streams per CCX33
- CPU < 70%
- Action: No action needed

**🟡 Warning** (60-80% capacity):
- Average 5-6 streams per CCX13
- Average 9-11 streams per CCX23
- Average 18-22 streams per CCX33
- CPU 70-80%
- Action: Plan to add server soon

**🔴 Scale Up** (>80% capacity):
- Average > 6 streams per CCX13
- Average > 11 streams per CCX23
- Average > 22 streams per CCX33
- CPU > 80%
- Action: Add server immediately

---

## 🚀 Quick Start Guide

### 1. Deploy Initial Setup

```bash
# Deploy API + Frontend (CPX32)
./scripts/quick-deploy.sh

# Deploy first media server (CCX13 or CCX23)
# On new server:
cd streamlick/media-server
npm install && npm run build
npm run start:prod
```

### 2. Configure Media Server Pool

```bash
# backend/.env
MEDIA_SERVERS=http://media1.example.com:3001
```

### 3. Monitor & Scale

1. Login as admin
2. Navigate to `/admin/servers`
3. Watch real-time metrics
4. When you see 🟡 or 🔴 alerts, click "Scale Now"
5. Follow step-by-step instructions to add server
6. Add new server URL to pool via UI

---

## 🎓 Pro Tips

### Cost Optimization

1. **Use CPX for API, CCX for Media** - Don't waste money on dedicated CPU for low-CPU tasks
2. **Start with CCX13** - Add capacity in $13.50 increments as you grow
3. **Switch to CCX23** - When you have 3+ servers, consolidate to reduce management overhead
4. **Use Hetzner Block Storage** - If you need more disk space (€0.052/GB/month = ~$0.056/GB)
5. **Skip CX series** - CPX32 is only $5 more than CX33 but 30%+ faster

### Performance Optimization

1. **Colocate in same datacenter** - Reduces latency between API and media servers
2. **Use private networking** - Free 10 Gbps internal network between servers
3. **Enable monitoring** - Set up Prometheus + Grafana (runs on CPX32 for free)
4. **Use CDN for frontend** - Cloudflare free tier works great

### Scaling Strategy

1. **Scale horizontally, not vertically** - Better redundancy and flexibility
2. **Test with CX23** - Verify everything works before spending on production servers
3. **Production = CPX32 + CCX** - Always use CPX32 (not CX) for production API server
4. **Add CCX13/CCX23 incrementally** - Don't overbuy capacity upfront
5. **Monitor cost per stream** - Should stay between $2.50-$3.50

---

## 📞 Support & Resources

- **Setup Guide**: `/docs/SETUP.md`
- **Configuration**: `/docs/CONFIGURATION.md`
- **Deployment**: `/docs/HETZNER-DEPLOY.md`
- **Admin Panel**: Navigate to `/admin/servers` after deployment

---

**Last Updated:** January 2025 | **Pricing Source:** Hetzner.com official pricing
