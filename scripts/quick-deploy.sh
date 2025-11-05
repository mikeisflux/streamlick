#!/bin/bash

##############################################
# Streamlick Quick Deployment Script
# For: Hetzner, DigitalOcean, or any Ubuntu VPS
# Installs: Node.js, PostgreSQL, Redis, FFmpeg, Nginx
# Time: ~10 minutes
##############################################

set -e  # Exit on error

echo "🚀 Starting Streamlick deployment..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use: sudo ./quick-deploy.sh)${NC}"
  exit 1
fi

echo -e "${GREEN}Step 1/7: Updating system...${NC}"
apt update && apt upgrade -y

echo -e "${GREEN}Step 2/7: Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo -e "${GREEN}Step 3/7: Installing PostgreSQL 16...${NC}"
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

echo -e "${GREEN}Step 4/7: Installing Redis...${NC}"
apt install -y redis-server
systemctl start redis-server
systemctl enable redis-server

echo -e "${GREEN}Step 5/7: Installing FFmpeg...${NC}"
apt install -y ffmpeg

echo -e "${GREEN}Step 6/7: Installing Nginx...${NC}"
apt install -y nginx certbot python3-certbot-nginx
systemctl start nginx
systemctl enable nginx

echo -e "${GREEN}Step 7/7: Setting up firewall...${NC}"
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 1935/tcp    # RTMP
ufw allow 40000:40100/udp  # WebRTC
ufw --force enable

echo ""
echo -e "${GREEN}✅ System dependencies installed!${NC}"
echo ""

# Create database and user
echo -e "${YELLOW}Creating PostgreSQL database...${NC}"
sudo -u postgres psql <<EOF
CREATE DATABASE streamlick_prod;
CREATE USER streamlick WITH ENCRYPTED PASSWORD 'streamlick_prod_password';
GRANT ALL PRIVILEGES ON DATABASE streamlick_prod TO streamlick;
\c streamlick_prod
GRANT ALL ON SCHEMA public TO streamlick;
EOF

echo -e "${GREEN}✅ Database created!${NC}"
echo ""

# Test connections
echo -e "${YELLOW}Testing services...${NC}"
node --version
psql --version
redis-cli ping
ffmpeg -version | head -n 1
nginx -v

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ ALL DEPENDENCIES INSTALLED SUCCESSFULLY!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Configure environment variables:"
echo "   cd /root/streamlick"
echo "   nano backend/.env"
echo ""
echo "2. Install Node.js dependencies:"
echo "   npm install"
echo ""
echo "3. Run database migrations:"
echo "   cd backend && npx prisma migrate deploy"
echo ""
echo "4. Build and start services:"
echo "   npm run build"
echo "   npm run start:prod"
echo ""
echo "5. Configure SSL (replace yourdomain.com):"
echo "   certbot --nginx -d streamlick.yourdomain.com -d api.yourdomain.com -d media.yourdomain.com"
echo ""
echo -e "${GREEN}Database Credentials:${NC}"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: streamlick_prod"
echo "  User: streamlick"
echo "  Password: streamlick_prod_password"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Change the database password in production!${NC}"
echo ""
