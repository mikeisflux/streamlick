# 💰 Streamlick Scaling Costs & Strategy

**Updated: 2025** | Pricing in USD (converted from EUR)

---

## 🎯 Quick Recommendation

**Start with CX22 ($4.50/month), scale with CCX13 ($13/month)**

- Most cost-effective for small to medium deployments
- Granular scaling (add 3-5 stream capacity per server)
- Better fault tolerance (more servers = less single point of failure)
- Lower entry cost when scaling up

---

## 📊 Hetzner Cloud Pricing (2025)

### Shared CPU (CX Series) - For API/Frontend

| Model | vCPU | RAM | Storage | Traffic | Price/Month | Use Case |
|-------|------|-----|---------|---------|-------------|----------|
| **CX22** | 2 | 4GB | 40GB | 20TB | **$4.50** | API + Frontend |
| CX32 | 4 | 8GB | 80GB | 20TB | $9.00 | API + Frontend (high traffic) |

### Dedicated CPU (CCX Series) - For Media Servers

| Model | vCPU | RAM | Storage | Traffic | Price/Month | Streams | $/Stream |
|-------|------|-----|---------|---------|-------------|---------|----------|
| **CCX13** | 2 | 8GB | 80GB | 20TB | **$13.00** | 3-5 | $3.25 |
| **CCX23** | 4 | 16GB | 160GB | 20TB | **$26.50** | 8-12 | $2.65 |
| **CCX33** | 8 | 32GB | 240GB | 20TB | **$54.00** | 20-25 | $2.40 |
| CCX43 | 16 | 64GB | 360GB | 20TB | $108.00 | 40-50 | $2.40 |

**Note:** Stream capacity assumes 1080p @ 30fps, 6 Mbps bitrate with WebRTC + FFmpeg encoding.

---

## 🚀 Scaling Strategies by Use Case

### Strategy 1: **Startup / Testing** (1-5 streams)

**Single Server: $4.50/month**

```
┌─────────────────────────┐
│   1× CX22 ($4.50/mo)   │
│  ┌─────────────────┐   │
│  │ API + Frontend  │   │
│  └─────────────────┘   │
│  ┌─────────────────┐   │
│  │  Media Server   │   │
│  └─────────────────┘   │
└─────────────────────────┘
Capacity: 1-3 streams
Cost/stream: ~$1.50
```

**Pros:**
- Cheapest possible setup
- Perfect for testing/development
- Single server to manage

**Cons:**
- Limited capacity
- No redundancy
- Not production-ready for scale

---

### Strategy 2: **Small Business** (5-20 streams)

**CCX13 Scaling: $17.50 - $56.50/month**

```
Phase 1: $17.50/month (3-5 streams)
┌─────────────┐     ┌─────────────┐
│  CX22       │────▶│  CCX13 #1   │
│  $4.50/mo   │     │  $13/mo     │
│ API + UI    │     │ 3-5 streams │
└─────────────┘     └─────────────┘

Phase 2: $30.50/month (6-10 streams)
┌─────────────┐     ┌─────────────┐
│  CX22       │────▶│  CCX13 #1   │
│  $4.50/mo   │  ┌─▶│  $13/mo     │
│ API + UI    │  │  └─────────────┘
└─────────────┘  │  ┌─────────────┐
                 └─▶│  CCX13 #2   │
                    │  $13/mo     │
                    └─────────────┘

Phase 3: $56.50/month (15-20 streams)
┌─────────────┐     ┌─────────────┐
│  CX22       │────▶│  CCX13 #1   │
│  $4.50/mo   │  ┌─▶│  CCX13 #2   │
│ API + UI    │  │  │  CCX13 #3   │
└─────────────┘  │  │  CCX13 #4   │
                 └─▶│  $52/mo     │
                    └─────────────┘
```

**Pros:**
- Gradual scaling ($13 increments)
- Good redundancy (4 servers)
- Easy to manage
- Low cost per stream ($2.65-3.25)

**Cons:**
- More servers to manage at scale
- Slightly higher cost than larger servers

---

### Strategy 3: **Medium Business** (20-50 streams)

**CCX23 Scaling: $31.00 - $84.50/month**

```
Phase 1: $31.00/month (8-12 streams)
┌─────────────┐     ┌─────────────┐
│  CX22       │────▶│  CCX23 #1   │
│  $4.50/mo   │     │  $26.50/mo  │
│ API + UI    │     │ 8-12 streams│
└─────────────┘     └─────────────┘

Phase 2: $84.50/month (32-48 streams)
┌─────────────┐     ┌─────────────┐
│  CX22       │────▶│  CCX23 #1   │
│  $4.50/mo   │  ┌─▶│  CCX23 #2   │
│ API + UI    │  │  │  CCX23 #3   │
└─────────────┘  │  │  $79.50/mo  │
                 └─▶└─────────────┘
```

**Pros:**
- Better cost per stream ($2.65)
- Fewer servers to manage
- Good for steady growth

**Cons:**
- Higher upfront cost per server
- Less granular scaling

---

### Strategy 4: **Large Platform** (50-100+ streams)

**CCX33 Scaling: $58.50 - $274.50/month**

```
Phase 1: $58.50/month (20-25 streams)
┌─────────────┐     ┌─────────────┐
│  CX22       │────▶│  CCX33 #1   │
│  $4.50/mo   │     │  $54/mo     │
│ API + UI    │     │ 20-25 stream│
└─────────────┘     └─────────────┘

Phase 2: $274.50/month (100-125 streams)
┌─────────────┐     ┌─────────────┐
│  CX22       │────▶│  CCX33 #1   │
│  $4.50/mo   │  ┌─▶│  CCX33 #2   │
│ API + UI    │  │  │  CCX33 #3   │
└─────────────┘  │  │  CCX33 #4   │
                 │  │  CCX33 #5   │
                 └─▶│  $270/mo    │
                    └─────────────┘
```

**Pros:**
- Best cost per stream at scale ($2.40)
- Fewer servers (easier management)
- High capacity per server

**Cons:**
- Expensive upfront ($54 per server)
- Less fault tolerance (fewer servers)
- Less granular scaling

---

## 📈 Cost Comparison: 100 Concurrent Streams

| Strategy | Server Count | Monthly Cost | Cost/Stream | Fault Tolerance |
|----------|--------------|--------------|-------------|-----------------|
| **CCX13** | 1 API + 20 media | **$264.50** | $2.65 | ⭐⭐⭐⭐⭐ Excellent |
| **CCX23** | 1 API + 9 media | **$243.00** | $2.43 | ⭐⭐⭐⭐ Very Good |
| **CCX33** | 1 API + 5 media | **$274.50** | $2.75 | ⭐⭐⭐ Good |

**Winner for 100 streams: CCX23** - Best balance of cost, management, and redundancy

---

## 💡 Recommended Strategy

### For Most Users: **Hybrid Approach**

Start small and scale smart:

```
Stage 1: Testing (1-5 streams)
└─ 1× CX22 all-in-one: $4.50/month

Stage 2: Early Production (5-15 streams)
├─ 1× CX22 (API + Frontend): $4.50
└─ 1-2× CCX13 (Media): $13-26/month
Total: $17.50 - $30.50/month

Stage 3: Growing (15-50 streams)
├─ 1× CX22 (API + Frontend): $4.50
└─ 3-6× CCX23 (Media): $79.50-159/month
Total: $84 - $163.50/month

Stage 4: Scale (50-100+ streams)
├─ 1× CX32 (API + Frontend): $9
└─ 4-8× CCX33 (Media): $216-432/month
Total: $225 - $441/month
```

---

## 🔧 Technical Notes

### Why Dedicated CPU (CCX) for Media Servers?

**Shared CPU (CX) issues:**
- ❌ Inconsistent performance (noisy neighbors)
- ❌ CPU throttling during peak usage
- ❌ Poor FFmpeg encoding quality
- ❌ Dropped frames and stuttering

**Dedicated CPU (CCX) benefits:**
- ✅ Consistent 100% CPU availability
- ✅ Smooth FFmpeg encoding
- ✅ No frame drops
- ✅ Production-ready quality

### Load Balancing Algorithm

The MediaServerPool uses **least-connections** algorithm:

1. Health check all servers every 10 seconds
2. Remove unhealthy servers from pool
3. Select server with fewest active streams
4. Distribute load evenly across healthy servers

### Scaling Triggers

**Automatic recommendations:**
- 🟢 **Normal**: < 15 streams/server, < 70% CPU
- 🟡 **Warning**: 15-20 streams/server OR 70-80% CPU
- 🔴 **Scale Up**: > 20 streams/server OR > 80% CPU

---

## 💸 Total Cost of Ownership (1 Year)

### Scenario: YouTube/Twitch Creator (10 average streams)

```
Year 1 Costs:
├─ Hosting: $30.50/month × 12 = $366
├─ Domain: $15/year
├─ SSL: FREE (Let's Encrypt)
└─ Total: $381/year = $31.75/month

Alternative (OBS + Restream.io):
├─ Restream Pro: $41/month × 12 = $492/year
└─ Less features, no customization
```

**You save:** $111/year + full control & branding

### Scenario: Agency (50 clients, 30 avg concurrent)

```
Year 1 Costs:
├─ Hosting: $84/month × 12 = $1,008
├─ Domain: $15/year
├─ SSL: FREE
└─ Total: $1,023/year = $85.25/month

Revenue:
├─ 50 clients × $20/month = $1,000/month
└─ Annual revenue: $12,000

Profit: $12,000 - $1,023 = $10,977/year
Margin: 91.5%
```

---

## 🎯 Quick Decision Matrix

| Your Situation | Recommendation | Monthly Cost |
|----------------|----------------|--------------|
| Just testing | 1× CX22 | $4.50 |
| < 5 streams | CX22 + CCX13 | $17.50 |
| 5-15 streams | CX22 + 2-3× CCX13 | $30-43 |
| 15-30 streams | CX22 + 2-4× CCX23 | $57-110 |
| 30-60 streams | CX22 + 2-3× CCX33 | $112-166 |
| 60-100 streams | CX32 + 4-5× CCX33 | $225-279 |
| 100+ streams | Contact for enterprise | Custom |

---

## ⚡ Quick Start

1. **Deploy Streamlick**: Follow `/docs/HETZNER-DEPLOY.md`
2. **Access Admin Panel**: Navigate to `/admin/servers`
3. **Monitor Load**: Watch real-time metrics and recommendations
4. **Scale When Needed**: Click "Add Server" when you see 🟡 or 🔴 alerts

---

**Questions?** Check `/docs/SETUP.md` and `/docs/CONFIGURATION.md` for detailed setup instructions.
