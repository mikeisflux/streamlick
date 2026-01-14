# TURN Server Setup for Streamlick

TURN (Traversal Using Relays around NAT) servers are required for WebRTC connections when guests are behind symmetric NATs or restrictive firewalls. Without TURN, approximately 10-15% of connections will fail.

## Server Requirements

### Recommended Server Specs

| Users | CPU | RAM | Bandwidth | Storage |
|-------|-----|-----|-----------|---------|
| 1-10 concurrent | 1 vCPU | 1 GB | 100 Mbps | 10 GB |
| 10-50 concurrent | 2 vCPU | 2 GB | 500 Mbps | 20 GB |
| 50-200 concurrent | 4 vCPU | 4 GB | 1 Gbps | 40 GB |
| 200+ concurrent | 8+ vCPU | 8+ GB | 2+ Gbps | 80+ GB |

### Key Considerations

1. **Bandwidth is Critical**: TURN servers relay ALL media traffic for users who can't connect directly. Each video stream can use 1-5 Mbps.

2. **Location Matters**: Deploy TURN servers close to your users. Consider multiple regions for global coverage.

3. **UDP Ports**: TURN requires UDP ports 49152-65535 to be open. Some cloud providers restrict this.

## Recommended Cloud Providers

### Best Value Options

| Provider | Spec | Price/Month | Notes |
|----------|------|-------------|-------|
| **Hetzner** | CX21 (2 vCPU, 4GB, 20TB) | ~$6 | Best value, EU/US locations |
| **Vultr** | High Frequency (2 vCPU, 4GB) | ~$24 | Good global coverage |
| **DigitalOcean** | Basic (2 vCPU, 4GB) | ~$24 | Easy setup, good docs |
| **Linode** | Shared 4GB | ~$24 | Reliable, good support |
| **OVH** | VPS Starter | ~$6 | Very cheap, EU focused |

### For Production (High Availability)

| Provider | Spec | Price/Month | Notes |
|----------|------|-------------|-------|
| **AWS EC2** | t3.medium | ~$30 | Easy auto-scaling |
| **Google Cloud** | e2-medium | ~$25 | Global load balancing |
| **Azure** | B2s | ~$30 | Enterprise features |

### My Recommendation

**Start with Hetzner CX21** (~$6/month):
- 2 vCPU, 4 GB RAM, 20 TB bandwidth
- Excellent for up to 50 concurrent TURN users
- Locations in Germany, Finland, and US (Virginia, Oregon)
- URL: https://www.hetzner.com/cloud

## Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Clone this directory to your server
scp -r turn/ user@your-server:/opt/turn

# 2. SSH into your server
ssh user@your-server

# 3. Install Docker
curl -fsSL https://get.docker.com | sh

# 4. Configure and start
cd /opt/turn
cp .env.example .env
nano .env  # Edit with your domain and credentials

docker compose up -d
```

### Option 2: Direct Installation

```bash
# Ubuntu/Debian
apt update && apt install -y coturn

# Copy config
cp turnserver.conf /etc/turnserver.conf
nano /etc/turnserver.conf  # Edit settings

# Start
systemctl enable coturn
systemctl start coturn
```

## Configuration

### Required Settings

Edit `.env` or `turnserver.conf`:

```
TURN_REALM=turn.yourdomain.com
TURN_USERNAME=streamlick
TURN_PASSWORD=<generate-strong-password>
EXTERNAL_IP=<your-server-public-ip>
```

### Firewall Rules

Open these ports:

```bash
# UFW example
ufw allow 3478/tcp   # TURN TCP
ufw allow 3478/udp   # TURN UDP
ufw allow 5349/tcp   # TURN TLS
ufw allow 5349/udp   # TURN DTLS
ufw allow 49152:65535/udp  # Relay ports
```

### SSL/TLS (Recommended for Production)

For TURNS (TLS-encrypted TURN):

```bash
# Using certbot
certbot certonly --standalone -d turn.yourdomain.com

# Update config
TURN_TLS_CERT=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
TURN_TLS_KEY=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
```

## Connect to Streamlick

After your TURN server is running, update your Streamlick frontend `.env`:

```
VITE_TURN_URL=turn:turn.yourdomain.com:3478
VITE_TURN_USERNAME=streamlick
VITE_TURN_PASSWORD=your-password

# For TLS (recommended):
VITE_TURN_TLS_URL=turns:turn.yourdomain.com:5349
```

## Testing

### Test Your TURN Server

Use Trickle ICE to verify your TURN server is working:
https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

Enter:
- STUN or TURN URI: `turn:your-server-ip:3478`
- Username: your username
- Credential: your password

Click "Gather candidates" - you should see "relay" candidates.

### Monitor Usage

```bash
# Check logs
docker compose logs -f turn

# Check active sessions
docker exec turn turnadmin -l
```

## Scaling

### For Global Coverage

Deploy TURN servers in multiple regions:
- US East (for Americas)
- EU West (for Europe/Africa)
- Asia Pacific (for Asia/Oceania)

Use DNS-based routing (Route53, Cloudflare) to direct users to nearest server.

### Load Balancing

For high traffic, use multiple TURN servers behind a load balancer:

```
         ┌─────────────┐
         │   DNS/LB    │
         └──────┬──────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼───┐   ┌───▼───┐   ┌───▼───┐
│ TURN1 │   │ TURN2 │   │ TURN3 │
└───────┘   └───────┘   └───────┘
```

## Alternatives to Self-Hosted

If you don't want to manage your own TURN server:

| Service | Free Tier | Paid | Notes |
|---------|-----------|------|-------|
| **Twilio** | 500 free | $0.40/GB | Easy API integration |
| **Metered.ca** | 500MB free | $0.10/GB | Cheapest paid option |
| **Xirsys** | None | $50/month | Enterprise features |

## Troubleshooting

### Connection Still Failing?

1. Check firewall allows UDP 49152-65535
2. Verify external IP is correct in config
3. Test with Trickle ICE tool
4. Check server logs for errors

### High CPU Usage?

- TURN server is CPU-bound for many users
- Consider upgrading or adding more servers
- Enable `no-software-attribute` in config to reduce overhead

### Bandwidth Exceeded?

- Monitor with `vnstat` or provider dashboard
- Consider upgrading plan or adding rate limiting
- Use TURN only when STUN fails (this is default behavior)
