# 🚀 Streamlick Deployment Guide

This comprehensive guide covers deploying Streamlick to production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Docker Deployment](#docker-deployment)
5. [VPS Deployment](#vps-deployment)
6. [Cloud Deployment](#cloud-deployment)
7. [Domain & SSL](#domain--ssl)
8. [Monitoring](#monitoring)
9. [Backup & Recovery](#backup--recovery)
10. [Scaling](#scaling)

---

## Prerequisites

### Minimum Server Requirements

- **CPU**: 4 cores (8 recommended for production)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 100GB SSD
- **Network**: 1Gbps uplink
- **OS**: Ubuntu 22.04 LTS (recommended)

### Software Requirements

- Docker 24.0+
- Docker Compose 2.20+
- Node.js 20+ (for local development)
- PostgreSQL 16+
- Redis 7+
- FFmpeg 6+

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/streamlick.git
cd streamlick
```

### 2. Create Environment Files

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Configure Production Environment

Edit `.env` with production values:

```bash
# Database
DATABASE_URL=postgresql://streamlick:STRONG_PASSWORD@postgres:5432/streamlick_prod

# Redis
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=GENERATE_STRONG_SECRET_KEY_HERE
ENCRYPTION_KEY=GENERATE_32_BYTE_KEY_HERE

# Email (SendGrid)
SENDGRID_API_KEY=SG.your_api_key_here
FROM_EMAIL=noreply@yourdomain.com

# Stripe
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_public_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Domain
FRONTEND_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com

# Media Server
MEDIASOUP_ANNOUNCED_IP=YOUR_PUBLIC_IP_ADDRESS

# Platform OAuth
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_secret

# Environment
NODE_ENV=production
```

### Generate Secrets

```bash
# JWT Secret (32 characters)
openssl rand -hex 32

# Encryption Key (32 bytes)
openssl rand -base64 32
```

---

## Database Setup

### Option 1: Managed Database (Recommended for Production)

Use managed PostgreSQL services:

- **DigitalOcean Managed Database**
- **AWS RDS**
- **Google Cloud SQL**
- **Supabase**

Benefits:
- Automatic backups
- High availability
- Monitoring included
- Scaling built-in

### Option 2: Self-Hosted PostgreSQL

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE streamlick_prod;
CREATE USER streamlick WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE streamlick_prod TO streamlick;
\q
```

---

## Docker Deployment

### 1. Build Images

```bash
docker-compose build
```

### 2. Start Services

```bash
docker-compose up -d
```

### 3. Run Database Migrations

```bash
docker-compose exec backend npx prisma migrate deploy
```

### 4. Verify Services

```bash
docker-compose ps

# Check logs
docker-compose logs -f
```

---

## VPS Deployment

### DigitalOcean Droplet

#### 1. Create Droplet

- **Image**: Ubuntu 22.04 LTS
- **Plan**: Premium Intel 8GB RAM / 4 vCPUs / 160GB SSD ($48/month)
- **Datacenter**: Choose closest to your audience
- **Additional**: Enable monitoring, backups

#### 2. Initial Server Setup

```bash
# SSH into server
ssh root@your_droplet_ip

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser streamlick
usermod -aG sudo streamlick
su - streamlick

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again to apply group changes
exit
exit
ssh streamlick@your_droplet_ip
```

#### 3. Deploy Application

```bash
# Clone repository
git clone https://github.com/yourusername/streamlick.git
cd streamlick

# Configure environment
cp .env.example .env
nano .env  # Edit with your values

# Start services
docker-compose up -d --build

# Run migrations
docker-compose exec backend npx prisma migrate deploy
```

#### 4. Configure Firewall

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 1935/tcp    # RTMP
sudo ufw allow 40000:40100/udp  # WebRTC
sudo ufw enable
```

### AWS EC2

#### 1. Launch Instance

- **AMI**: Ubuntu Server 22.04 LTS
- **Instance Type**: t3.xlarge (4 vCPUs, 16GB RAM)
- **Storage**: 200GB gp3 SSD
- **Security Group**: Configure ports (see below)

#### 2. Security Group Rules

**Inbound:**
- SSH (22) - Your IP
- HTTP (80) - 0.0.0.0/0
- HTTPS (443) - 0.0.0.0/0
- RTMP (1935) - 0.0.0.0/0
- WebRTC (40000-40100 UDP) - 0.0.0.0/0

**Outbound:**
- All traffic

#### 3. Deploy

Same steps as DigitalOcean, plus:

```bash
# Associate Elastic IP (recommended)
# AWS Console → EC2 → Elastic IPs → Allocate → Associate
```

---

## Cloud Deployment

### Google Cloud Platform (Cloud Run)

1. Build container images
2. Push to Google Container Registry
3. Deploy to Cloud Run
4. Configure Cloud SQL (PostgreSQL)
5. Set up Cloud Memorystore (Redis)

See `docs/gcp-deployment.md` for full guide.

### Heroku

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create apps
heroku create streamlick-api
heroku create streamlick-media
heroku create streamlick-web

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Add Redis
heroku addons:create heroku-redis:premium-0

# Deploy
git push heroku main
```

---

## Domain & SSL

### 1. Point Domain to Server

Add A records in your DNS provider:

```
A    @              YOUR_SERVER_IP
A    www            YOUR_SERVER_IP
A    api            YOUR_SERVER_IP
A    media          YOUR_SERVER_IP
```

### 2. Install Nginx

```bash
sudo apt install nginx
```

### 3. Configure Nginx

Create `/etc/nginx/sites-available/streamlick`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name streamlick.com www.streamlick.com;
    return 301 https://$server_name$request_uri;
}

# Main application
server {
    listen 443 ssl http2;
    server_name streamlick.com www.streamlick.com;

    # SSL Configuration (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/streamlick.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/streamlick.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API endpoints
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}

# API subdomain
server {
    listen 443 ssl http2;
    server_name api.streamlick.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Media server subdomain
server {
    listen 443 ssl http2;
    server_name media.streamlick.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/streamlick /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Install SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d streamlick.com -d www.streamlick.com -d api.streamlick.com -d media.streamlick.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Monitoring

### 1. Application Monitoring

Use pm2 for process management:

```bash
npm install -g pm2

# Start services with pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

`ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'streamlick-api',
      script: 'npm',
      args: 'start --workspace=backend',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'streamlick-media',
      script: 'npm',
      args: 'start --workspace=media-server',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

### 2. System Monitoring

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Monitor resources
htop           # CPU/RAM
iotop          # Disk I/O
nethogs        # Network usage
```

### 3. Log Management

```bash
# View logs
pm2 logs

# Monitor Docker logs
docker-compose logs -f --tail=100

# Set up log rotation
pm2 install pm2-logrotate
```

### 4. External Monitoring

Recommended services:
- **UptimeRobot** (free tier available)
- **Datadog**
- **New Relic**
- **Sentry** (error tracking)

---

## Backup & Recovery

### Database Backups

```bash
# Create backup script
nano /home/streamlick/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/streamlick/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker-compose exec -T postgres pg_dump -U streamlick streamlick_prod > "$BACKUP_DIR/db_$DATE.sql"

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql"
```

```bash
chmod +x /home/streamlick/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /home/streamlick/backup-db.sh
```

### Restore Database

```bash
# Restore from backup
docker-compose exec -T postgres psql -U streamlick streamlick_prod < backups/db_20240101_020000.sql
```

---

## Scaling

### Horizontal Scaling

1. **Load Balancer**: Use Nginx or cloud LB
2. **Multiple API Servers**: Run multiple backend instances
3. **Media Server Clustering**: Deploy media servers in different regions
4. **Database Read Replicas**: For heavy read workloads

### Vertical Scaling

Upgrade server resources as needed:
- More CPU cores for encoding
- More RAM for concurrent streams
- Faster storage for recordings

---

## Performance Optimization

### 1. Enable Caching

```nginx
# Add to Nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=10g inactive=60m;

location /api {
    proxy_cache my_cache;
    proxy_cache_valid 200 60m;
    proxy_pass http://localhost:3000;
}
```

### 2. CDN Integration

Use Cloudflare or AWS CloudFront for:
- Static assets
- Recording downloads
- Global low-latency access

### 3. Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_broadcasts_user_id ON broadcasts(user_id);
CREATE INDEX idx_participants_broadcast_id ON participants(broadcast_id);
CREATE INDEX idx_broadcasts_status ON broadcasts(status);
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check Docker logs
docker-compose logs backend
docker-compose logs media-server

# Check system resources
df -h           # Disk space
free -h         # RAM
docker stats    # Container resources
```

### Database Connection Issues

```bash
# Test database connection
docker-compose exec postgres psql -U streamlick -d streamlick_prod -c "SELECT version();"

# Check database logs
docker-compose logs postgres
```

### WebRTC Connection Failures

1. Verify public IP is set correctly
2. Check firewall allows UDP 40000-40100
3. Test STUN/TURN server connectivity

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable firewall (ufw)
- [ ] Set up fail2ban for SSH
- [ ] Use SSL/HTTPS everywhere
- [ ] Configure Content Security Policy
- [ ] Enable rate limiting
- [ ] Regular security updates
- [ ] Database encryption at rest
- [ ] Encrypted environment variables
- [ ] Regular security audits

---

## Support

For deployment issues:
- Email: devops@streamlick.com
- Discord: https://discord.gg/streamlick
- Documentation: https://docs.streamlick.com

---

**Last Updated**: December 2024
