# 🚀 Hetzner Cloud Deployment Guide

**Deploy Streamlick for €4.15/month (~$4.50/month)**

Total setup time: **30 minutes**

---

## Why Hetzner?

- ✅ **Cheapest**: €4.15/month vs $6+ on competitors
- ✅ **Better specs**: 4GB RAM vs 2GB on DigitalOcean for same price
- ✅ **Great performance**: Fast CPUs and SSD storage
- ✅ **No hidden costs**: Traffic included (20TB/month)
- ✅ **Simple billing**: Pay as you go, cancel anytime

---

## Step 1: Create Hetzner Account (5 minutes)

1. Go to https://www.hetzner.com/cloud
2. Click **"Sign Up"**
3. Fill in details and verify email
4. Add payment method (PayPal or credit card)
5. You'll get €20 free credit for first month!

---

## Step 2: Create Server (5 minutes)

1. **Click "New Project"**
   - Name: `Streamlick Production`

2. **Click "Add Server"**

3. **Select Location:**
   - 🇺🇸 US East (Ashburn) - Best for North America
   - 🇩🇪 Germany (Nuremberg/Falkenstein) - Best for Europe
   - 🇫🇮 Finland (Helsinki) - Good for EU/Russia

4. **Select Image:**
   - Ubuntu 22.04

5. **Select Type:**
   - **Shared vCPU** (cheapest)
   - **CX22**: €4.15/month
     - 2 vCPUs
     - 4GB RAM
     - 40GB SSD
     - 20TB traffic

6. **Networking:**
   - ✅ Public IPv4 (free)
   - ❌ Public IPv6 (optional, not needed)

7. **SSH Keys** (IMPORTANT for security)

   **On your local computer:**
   ```bash
   # Generate SSH key if you don't have one
   ssh-keygen -t ed25519 -C "your-email@example.com"

   # Copy public key
   cat ~/.ssh/id_ed25519.pub
   ```

   **In Hetzner:**
   - Click "Add SSH Key"
   - Paste your public key
   - Name it "My Laptop"

8. **Server Name:**
   - `streamlick-prod-1`

9. **Click "Create & Buy Now"**

**Server will be ready in 30-60 seconds!**

---

## Step 3: Configure DNS (5 minutes)

### Get Your Server IP

In Hetzner dashboard, you'll see:
```
Server IP: 116.203.123.45  (example)
```

### Add DNS Records

Go to your domain registrar (Cloudflare, Namecheap, GoDaddy, etc.):

```
Type    Name        Value               TTL
A       @           116.203.123.45      Auto
A       www         116.203.123.45      Auto
A       api         116.203.123.45      Auto
A       media       116.203.123.45      Auto
```

**Don't have a domain?** Use these free options:
- **FreeDNS**: https://freedns.afraid.org (free subdomain like `mystream.mooo.com`)
- **No-IP**: https://www.noip.com (free dynamic DNS)
- **Duck DNS**: https://www.duckdns.org (free subdomain)

---

## Step 4: Initial Server Setup (5 minutes)

### SSH into Server

```bash
# From your local computer
ssh root@116.203.123.45  # Use your server IP
```

You should see:
```
Welcome to Ubuntu 22.04 LTS
```

### Create Non-Root User (Security Best Practice)

```bash
# Create user
adduser streamlick

# Add to sudo group
usermod -aG sudo streamlick

# Copy SSH keys to new user
rsync --archive --chown=streamlick:streamlick ~/.ssh /home/streamlick

# Switch to new user
su - streamlick
```

### Test Sudo Access

```bash
sudo apt update
# Enter password when prompted
```

---

## Step 5: Install Dependencies (10 minutes)

### Download and Run Quick Deploy Script

```bash
# Clone repository
cd /home/streamlick
git clone https://github.com/yourusername/streamlick.git
cd streamlick

# Make script executable
chmod +x scripts/quick-deploy.sh

# Run installation (requires sudo)
sudo ./scripts/quick-deploy.sh
```

**What this installs:**
- Node.js 20
- PostgreSQL 16
- Redis 7
- FFmpeg 6
- Nginx
- Creates database and user

**Time: ~8-10 minutes**

You should see:
```
✅ ALL DEPENDENCIES INSTALLED SUCCESSFULLY!
```

---

## Step 6: Configure Environment Variables (5 minutes)

### Generate Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate encryption key
openssl rand -base64 32
```

### Configure Backend

```bash
cd /home/streamlick/streamlick
nano backend/.env
```

**Minimal production configuration:**

```bash
# Database
DATABASE_URL="postgresql://streamlick:streamlick_prod_password@localhost:5432/streamlick_prod"

# Redis
REDIS_URL="redis://localhost:6379"

# Security (REPLACE WITH YOUR GENERATED VALUES!)
JWT_SECRET="your-generated-jwt-secret-from-openssl-rand-hex-32"
ENCRYPTION_KEY="your-generated-encryption-key-from-openssl-rand-base64-32"

# Server
PORT=3000
NODE_ENV=production

# Frontend URL (REPLACE WITH YOUR DOMAIN!)
FRONTEND_URL=https://streamlick.yourdomain.com
CORS_ORIGINS="https://streamlick.yourdomain.com"

# Media Server (REPLACE WITH YOUR SERVER IP!)
MEDIASOUP_ANNOUNCED_IP=116.203.123.45

# Email (Optional - can add later)
# SENDGRID_API_KEY=
# FROM_EMAIL=noreply@yourdomain.com

# Stripe (Optional - can add later)
# STRIPE_SECRET_KEY=
# STRIPE_PUBLISHABLE_KEY=

# Platform OAuth (Add when ready to connect platforms)
# YOUTUBE_CLIENT_ID=
# YOUTUBE_CLIENT_SECRET=
# TWITCH_CLIENT_ID=
# TWITCH_CLIENT_SECRET=
# FACEBOOK_APP_ID=
# FACEBOOK_APP_SECRET=
```

Save: `Ctrl+X`, `Y`, `Enter`

### Configure Frontend

```bash
nano frontend/.env
```

```bash
# API URLs (REPLACE WITH YOUR DOMAIN!)
VITE_API_URL=https://api.yourdomain.com
VITE_MEDIA_SERVER_URL=https://media.yourdomain.com
VITE_SOCKET_URL=https://api.yourdomain.com

VITE_NODE_ENV=production
```

Save: `Ctrl+X`, `Y`, `Enter`

### Configure Media Server

```bash
nano media-server/.env
```

```bash
PORT=3001
NODE_ENV=production

# REPLACE WITH YOUR SERVER IP!
MEDIASOUP_ANNOUNCED_IP=116.203.123.45
MEDIASOUP_LISTEN_IP=0.0.0.0

RTC_MIN_PORT=40000
RTC_MAX_PORT=40100

BACKEND_URL=http://localhost:3000
```

Save: `Ctrl+X`, `Y`, `Enter`

---

## Step 7: Install & Build Application (5 minutes)

```bash
# Install dependencies
npm install

# Run database migrations
cd backend
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed database (optional - creates admin user)
npx prisma db seed

# Build all services
cd ..
npm run build
```

**Admin credentials (if seeded):**
- Email: admin@streamlick.com
- Password: admin123 (CHANGE IMMEDIATELY!)

---

## Step 8: Configure Nginx Reverse Proxy (5 minutes)

```bash
sudo nano /etc/nginx/sites-available/streamlick
```

**Paste this configuration** (REPLACE `yourdomain.com`):

```nginx
# Main frontend
server {
    listen 80;
    server_name streamlick.yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API backend
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}

# Media server
server {
    listen 80;
    server_name media.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

Save: `Ctrl+X`, `Y`, `Enter`

**Enable site:**

```bash
sudo ln -s /etc/nginx/sites-available/streamlick /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 9: Install SSL Certificates (5 minutes)

```bash
# REPLACE yourdomain.com with your actual domain!
sudo certbot --nginx -d streamlick.yourdomain.com -d api.yourdomain.com -d media.yourdomain.com
```

**Follow prompts:**
1. Enter email: `your-email@example.com`
2. Agree to ToS: `Y`
3. Share email: `N` (optional)
4. Redirect HTTP to HTTPS: `2` (Yes)

**Test auto-renewal:**
```bash
sudo certbot renew --dry-run
```

---

## Step 10: Start Services (2 minutes)

### Install PM2 Process Manager

```bash
sudo npm install -g pm2
```

### Start All Services

```bash
cd /home/streamlick/streamlick

# Start backend
pm2 start --name "streamlick-backend" npm -- run start:prod --workspace=backend

# Start media server
pm2 start --name "streamlick-media" npm -- run start --workspace=media-server

# Start frontend (production build served)
pm2 start --name "streamlick-frontend" npm -- run preview --workspace=frontend

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Run the command it outputs (starts with 'sudo env')
```

### Check Status

```bash
pm2 status

# Should show:
# streamlick-backend   online
# streamlick-media     online
# streamlick-frontend  online
```

### View Logs

```bash
# All logs
pm2 logs

# Specific service
pm2 logs streamlick-backend
```

---

## ✅ Deployment Complete!

**Your platform is now live at:**
- Frontend: https://streamlick.yourdomain.com
- API: https://api.yourdomain.com
- Media Server: https://media.yourdomain.com

---

## 🔧 Post-Deployment Checklist

### 1. Test the Application

Visit: https://streamlick.yourdomain.com

- ✅ Create account
- ✅ Log in
- ✅ Create broadcast
- ✅ Test camera/mic access

### 2. Change Default Passwords

```bash
# Change database password
sudo -u postgres psql
ALTER USER streamlick WITH PASSWORD 'new-secure-password';
\q

# Update backend/.env with new password
nano backend/.env
# Update DATABASE_URL

# Restart backend
pm2 restart streamlick-backend
```

### 3. Set Up Platform OAuth

Follow SETUP.md to configure:
- YouTube OAuth
- Twitch OAuth
- Facebook OAuth
- LinkedIn OAuth
- Twitter/X OAuth

### 4. Configure Email (SendGrid)

1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Create API key
3. Add to `backend/.env`:
   ```bash
   SENDGRID_API_KEY=SG.your-api-key
   FROM_EMAIL=noreply@yourdomain.com
   ```
4. Restart backend: `pm2 restart streamlick-backend`

### 5. Set Up Stripe (Optional)

1. Create account at https://stripe.com
2. Get API keys (test mode first)
3. Add to `backend/.env`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_your-key
   STRIPE_PUBLISHABLE_KEY=pk_test_your-key
   ```
4. Update `frontend/.env`:
   ```bash
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-key
   ```
5. Rebuild frontend: `cd frontend && npm run build`
6. Restart: `pm2 restart all`

---

## 📊 Monitoring & Maintenance

### Check Service Status

```bash
pm2 status
pm2 monit  # Real-time monitoring
```

### View Logs

```bash
pm2 logs --lines 100
pm2 logs streamlick-backend --lines 50
```

### Restart Services

```bash
pm2 restart all
pm2 restart streamlick-backend
```

### Check Server Resources

```bash
htop  # Install with: sudo apt install htop
df -h  # Disk usage
free -h  # Memory usage
```

### Database Backup

```bash
# Create backup
sudo -u postgres pg_dump streamlick_prod > backup-$(date +%Y%m%d).sql

# Automate daily backups
crontab -e
# Add: 0 2 * * * sudo -u postgres pg_dump streamlick_prod > /home/streamlick/backups/backup-$(date +\%Y\%m\%d).sql
```

---

## 🚨 Troubleshooting

### Services Won't Start

```bash
# Check logs
pm2 logs streamlick-backend --lines 100

# Common issues:
# 1. Port already in use
sudo lsof -i :3000
sudo kill -9 <PID>

# 2. Database connection failed
sudo systemctl status postgresql
sudo systemctl restart postgresql

# 3. Redis not running
sudo systemctl status redis-server
sudo systemctl restart redis-server
```

### Can't Access Website

```bash
# Check Nginx
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx

# Check firewall
sudo ufw status

# Check DNS
dig streamlick.yourdomain.com
ping streamlick.yourdomain.com
```

### High CPU Usage

```bash
# Check processes
htop

# Restart services
pm2 restart all

# Check logs for errors
pm2 logs --lines 200
```

### Out of Memory

```bash
# Check memory
free -h

# Upgrade to CX32 (8GB RAM) for €8.21/month
# In Hetzner dashboard: Server → Resize → CX32
```

---

## 💰 Cost Breakdown

**Monthly Costs:**

- Hetzner CX22: €4.15/month
- Domain (optional): ~$10-15/year ($1/month)
- **Total: ~€4-5/month ($5-6/month)**

**Free tiers available:**
- SendGrid: 100 emails/day (free)
- Stripe: No monthly fee (just transaction fees)
- Platform APIs: All free for basic usage

**Upgrade path:**
- CX32 (8GB RAM): €8.21/month - For 10-20 concurrent streams
- CX42 (16GB RAM): €16.21/month - For 50+ concurrent streams

---

## 🎉 You're Live!

Your Streamlick platform is now running on Hetzner Cloud for **less than $5/month**!

**Next steps:**
1. Set up platform OAuth credentials (SETUP.md)
2. Test first live stream
3. Invite users
4. Monitor performance

**Need help?**
- Documentation: `/docs/SETUP.md`, `/docs/CONFIGURATION.md`
- Check logs: `pm2 logs`
- Community: https://discord.gg/streamlick (if available)

---

**Last Updated:** January 2025
