# 🚀 Streamlick Complete Setup Guide

This comprehensive guide will walk you through setting up Streamlick from scratch for local development and testing.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Database Configuration](#database-configuration)
4. [Environment Configuration](#environment-configuration)
5. [Platform API Setup](#platform-api-setup)
6. [Installation & Build](#installation--build)
7. [Running the Application](#running-the-application)
8. [Verification & Testing](#verification--testing)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

Before starting, ensure you have the following installed:

#### 1. Node.js & npm
```bash
# Check versions
node --version  # Should be 20.0.0 or higher
npm --version   # Should be 10.0.0 or higher

# Install Node.js 20 LTS (if needed)
# Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS (using Homebrew):
brew install node@20

# Windows: Download from https://nodejs.org
```

#### 2. PostgreSQL 16
```bash
# Ubuntu/Debian:
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS:
brew install postgresql@16
brew services start postgresql@16

# Windows: Download from https://www.postgresql.org/download/windows/

# Verify installation
psql --version  # Should be 16.x
```

#### 3. Redis 7
```bash
# Ubuntu/Debian:
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list
sudo apt-get update
sudo apt-get install redis

# macOS:
brew install redis
brew services start redis

# Windows: Use WSL2 or download from https://github.com/microsoftarchive/redis/releases

# Verify installation
redis-cli --version  # Should be 7.x
```

#### 4. FFmpeg 6
```bash
# Ubuntu/Debian:
sudo apt update
sudo apt install ffmpeg

# macOS:
brew install ffmpeg

# Windows: Download from https://ffmpeg.org/download.html

# Verify installation
ffmpeg -version  # Should be 6.x or higher
```

#### 5. Git
```bash
# Ubuntu/Debian:
sudo apt install git

# macOS:
brew install git

# Windows: Download from https://git-scm.com/download/win

# Verify installation
git --version
```

### Optional but Recommended

- **Docker & Docker Compose**: For containerized development
- **VSCode**: Recommended IDE with extensions:
  - ESLint
  - Prettier
  - Prisma
  - TypeScript Vue Plugin (Volar)
- **Postman**: For API testing

---

## Initial Setup

### 1. Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/yourusername/streamlick.git

# Or via SSH
git clone git@github.com:yourusername/streamlick.git

# Navigate to project directory
cd streamlick
```

### 2. Project Structure Overview

```
streamlick/
├── backend/              # Express.js REST API
│   ├── src/
│   │   ├── api/         # Route handlers
│   │   ├── services/    # Business logic
│   │   ├── socket/      # Socket.IO handlers
│   │   └── utils/       # Helper functions
│   ├── prisma/          # Database schema & migrations
│   └── package.json
├── frontend/            # React + Vite UI
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API clients
│   │   └── hooks/       # Custom React hooks
│   └── package.json
├── media-server/        # Mediasoup WebRTC server
│   ├── src/
│   │   ├── rtmp/        # RTMP streaming
│   │   ├── services/    # Media services
│   │   └── config/      # Mediasoup config
│   └── package.json
├── docs/                # Documentation
└── docker-compose.yml   # Docker configuration
```

---

## Database Configuration

### 1. Start PostgreSQL

```bash
# Ubuntu/Debian:
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS:
brew services start postgresql@16
```

### 2. Create Database and User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Or on macOS:
psql postgres
```

```sql
-- Create database
CREATE DATABASE streamlick_dev;

-- Create user with password
CREATE USER streamlick WITH ENCRYPTED PASSWORD 'streamlick_dev_password';

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE streamlick_dev TO streamlick;

-- Grant schema privileges (PostgreSQL 15+)
\c streamlick_dev
GRANT ALL ON SCHEMA public TO streamlick;

-- Exit
\q
```

### 3. Verify Database Connection

```bash
# Test connection
psql -h localhost -U streamlick -d streamlick_dev

# You should see the PostgreSQL prompt
streamlick_dev=>

# Exit with \q
```

### 4. Start Redis

```bash
# Ubuntu/Debian:
sudo systemctl start redis-server
sudo systemctl enable redis-server

# macOS:
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

---

## Environment Configuration

### 1. Copy Environment Files

```bash
# Root environment (optional for monorepo)
cp .env.example .env

# Backend environment
cp backend/.env.example backend/.env

# Frontend environment
cp frontend/.env.example frontend/.env

# Media server environment (if exists)
cp media-server/.env.example media-server/.env
```

### 2. Configure Backend Environment

Edit `backend/.env`:

```bash
# Database
DATABASE_URL="postgresql://streamlick:streamlick_dev_password@localhost:5432/streamlick_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# Security
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
ENCRYPTION_KEY="your-32-character-encryption-key-here-change-me"

# Server
PORT=3000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Email (Optional for development - use console transport)
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@localhost

# Payment (Optional for development)
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Platform OAuth (We'll set these up next)
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback

TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_REDIRECT_URI=http://localhost:3000/auth/facebook/callback

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback

TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_BEARER_TOKEN=
```

### 3. Configure Frontend Environment

Edit `frontend/.env`:

```bash
# API URLs
VITE_API_URL=http://localhost:3000
VITE_MEDIA_SERVER_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3000

# Stripe (Optional)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key

# Environment
VITE_NODE_ENV=development
```

### 4. Configure Media Server Environment

Edit `media-server/.env` (or create if doesn't exist):

```bash
# Server
PORT=3001
NODE_ENV=development

# Mediasoup
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
MEDIASOUP_LISTEN_IP=0.0.0.0

# WebRTC Port Range
RTC_MIN_PORT=40000
RTC_MAX_PORT=40100

# Backend URL
BACKEND_URL=http://localhost:3000
```

### 5. Generate Secret Keys

```bash
# Generate JWT secret (32 characters)
openssl rand -hex 32

# Generate encryption key (32 bytes base64)
openssl rand -base64 32

# Copy these values into your backend/.env file
```

---

## Platform API Setup

This section covers setting up OAuth applications for each streaming platform.

### YouTube API Setup

#### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: `Streamlick Dev`
4. Click "Create"

#### 2. Enable YouTube Data API v3

1. In the left sidebar, go to "APIs & Services" → "Library"
2. Search for "YouTube Data API v3"
3. Click on it and click "Enable"

#### 3. Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Configure consent screen (first time only):
   - User Type: External
   - App name: Streamlick Dev
   - User support email: your email
   - Developer contact: your email
   - Save and continue through all steps
4. Create OAuth client ID:
   - Application type: Web application
   - Name: Streamlick Dev
   - Authorized redirect URIs: `http://localhost:3000/auth/youtube/callback`
   - Click "Create"
5. Copy the **Client ID** and **Client Secret**
6. Add to `backend/.env`:
   ```bash
   YOUTUBE_CLIENT_ID=your_client_id_here
   YOUTUBE_CLIENT_SECRET=your_client_secret_here
   ```

#### 4. Add Test Users (Development)

1. Go to "OAuth consent screen"
2. Under "Test users", click "Add Users"
3. Add your Google account email
4. Click "Save"

### Twitch API Setup

#### 1. Create Twitch Developer Account

1. Go to [Twitch Developers](https://dev.twitch.tv/)
2. Log in with your Twitch account
3. Accept the developer agreement

#### 2. Register Application

1. Click "Your Console" (top right)
2. Click "Applications" → "Register Your Application"
3. Fill in details:
   - Name: `Streamlick Dev`
   - OAuth Redirect URLs: `http://localhost:3000/auth/twitch/callback`
   - Category: Broadcasting Suite
4. Click "Create"

#### 3. Get Credentials

1. Click "Manage" on your application
2. Copy the **Client ID**
3. Click "New Secret" and copy the **Client Secret**
4. Add to `backend/.env`:
   ```bash
   TWITCH_CLIENT_ID=your_client_id_here
   TWITCH_CLIENT_SECRET=your_client_secret_here
   ```

### Facebook/Meta API Setup

#### 1. Create Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Log in with your Facebook account
3. Click "Get Started" and complete registration

#### 2. Create App

1. Click "My Apps" → "Create App"
2. Select "Business" type
3. Fill in details:
   - App name: `Streamlick Dev`
   - App contact email: your email
4. Click "Create App"

#### 3. Add Facebook Login

1. In your app dashboard, click "Add Product"
2. Find "Facebook Login" and click "Set Up"
3. Select "Web"
4. Enter Site URL: `http://localhost:3000`

#### 4. Configure OAuth Settings

1. Go to "Facebook Login" → "Settings"
2. Valid OAuth Redirect URIs: `http://localhost:3000/auth/facebook/callback`
3. Click "Save Changes"

#### 5. Get Credentials

1. Go to "Settings" → "Basic"
2. Copy the **App ID** and **App Secret**
3. Add to `backend/.env`:
   ```bash
   FACEBOOK_APP_ID=your_app_id_here
   FACEBOOK_APP_SECRET=your_app_secret_here
   ```

#### 6. Add Test Users (Development)

1. Go to "Roles" → "Test Users"
2. Click "Add" to create test users
3. Use these for testing live streaming

### LinkedIn API Setup

#### 1. Create LinkedIn Developer Account

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Log in with your LinkedIn account

#### 2. Create App

1. Click "Create app"
2. Fill in details:
   - App name: `Streamlick Dev`
   - LinkedIn Page: Create or select a page
   - App logo: Upload a logo (optional)
3. Check "I have read and agree to the API Terms of Use"
4. Click "Create app"

#### 3. Request API Access

1. Go to the "Products" tab
2. Request access to "Share on LinkedIn"
3. Wait for approval (usually instant for development)

#### 4. Configure OAuth

1. Go to the "Auth" tab
2. Add Redirect URL: `http://localhost:3000/auth/linkedin/callback`
3. Copy the **Client ID** and **Client Secret**
4. Add to `backend/.env`:
   ```bash
   LINKEDIN_CLIENT_ID=your_client_id_here
   LINKEDIN_CLIENT_SECRET=your_client_secret_here
   ```

### Twitter/X API Setup

#### 1. Create Twitter Developer Account

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Log in with your Twitter/X account
3. Apply for developer access (if first time)

#### 2. Create Project & App

1. In the dashboard, click "Create Project"
2. Name your project: `Streamlick Dev`
3. Select use case: "Making a bot"
4. Provide project description
5. Create an app: `Streamlick Dev App`

#### 3. Configure OAuth

1. Go to your app settings
2. Click "Edit" under "Authentication settings"
3. Enable "OAuth 2.0"
4. Add Callback URL: `http://localhost:3000/auth/twitter/callback`
5. Add Website URL: `http://localhost:3000`
6. Save

#### 4. Get Credentials

1. Go to "Keys and tokens" tab
2. Copy **API Key**, **API Secret**, and generate **Bearer Token**
3. Add to `backend/.env`:
   ```bash
   TWITTER_API_KEY=your_api_key_here
   TWITTER_API_SECRET=your_api_secret_here
   TWITTER_BEARER_TOKEN=your_bearer_token_here
   ```

### Notes on Platform APIs

- **Development**: Most platforms require test users or approval for development
- **Quotas**: Free tiers have API quotas; monitor usage in developer consoles
- **Webhooks**: Some platforms require verified domains for webhooks (production only)
- **Permissions**: Request minimum required scopes/permissions

---

## Installation & Build

### 1. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Or install individually:
cd backend && npm install
cd ../frontend && npm install
cd ../media-server && npm install
```

This may take 5-10 minutes depending on your internet connection.

### 2. Generate Prisma Client

```bash
cd backend
npx prisma generate
```

### 3. Run Database Migrations

```bash
cd backend
npx prisma migrate dev --name init

# You should see output like:
# ✔ Generated Prisma Client
# ✔ Applied migration: 20241201_init
```

### 4. Seed Database (Optional)

```bash
cd backend
npx prisma db seed

# This will create:
# - Admin user (admin@streamlick.com / password)
# - Test users
# - Sample data
```

### 5. Build Frontend (Optional for Development)

```bash
cd frontend
npm run build

# For development, you'll use `npm run dev` instead
```

---

## Running the Application

### Option 1: Run All Services Individually

Open 3 terminal windows/tabs:

#### Terminal 1: Backend API
```bash
cd backend
npm run dev

# Should see:
# [INFO] Server running on http://localhost:3000
# [INFO] Socket.IO server initialized
# [INFO] Database connected
```

#### Terminal 2: Media Server
```bash
cd media-server
npm run dev

# Should see:
# [INFO] Media server running on http://localhost:3001
# [INFO] Mediasoup workers initialized: 4
# [INFO] WebRTC transport range: 40000-40100
```

#### Terminal 3: Frontend
```bash
cd frontend
npm run dev

# Should see:
# VITE v5.0.0  ready in 500 ms
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

### Option 2: Using Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 3: Using Process Manager (pm2)

```bash
# Install pm2 globally
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Monitor processes
pm2 monit

# Stop all
pm2 stop all
```

---

## Verification & Testing

### 1. Check All Services Are Running

```bash
# Backend API
curl http://localhost:3000/health
# Expected: {"status":"healthy","timestamp":"..."}

# Media Server
curl http://localhost:3001/health
# Expected: {"status":"healthy","workers":4}

# Frontend
open http://localhost:5173
# Should see the Streamlick landing page
```

### 2. Test Database Connection

```bash
cd backend
npx prisma studio

# Opens Prisma Studio in browser at http://localhost:5555
# You should see all your database tables
```

### 3. Test Redis Connection

```bash
redis-cli
127.0.0.1:6379> PING
PONG
127.0.0.1:6379> SET test "Hello"
OK
127.0.0.1:6379> GET test
"Hello"
127.0.0.1:6379> exit
```

### 4. Register a Test User

1. Go to http://localhost:5173
2. Click "Sign Up"
3. Fill in:
   - Name: Test User
   - Email: test@example.com
   - Password: testpassword123
4. Click "Create Account"
5. You should be redirected to the dashboard

### 5. Connect a Platform (YouTube Example)

1. Log in to your test account
2. Go to Settings → Platforms
3. Click "Connect YouTube"
4. Authorize with your Google test account
5. You should see "Connected" status

### 6. Test Creating a Broadcast

1. Go to Dashboard
2. Click "New Broadcast"
3. Fill in:
   - Title: Test Stream
   - Description: Testing Streamlick setup
   - Select platforms: YouTube
4. Click "Create"
5. You should see the studio page

### 7. Run Automated Tests (Optional)

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests (if available)
cd frontend
npm run test:e2e
```

---

## Troubleshooting

### Database Connection Issues

**Problem**: Cannot connect to PostgreSQL

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -h localhost -U streamlick -d streamlick_dev

# If connection refused:
sudo systemctl restart postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

**Problem**: Permission denied for schema public

```sql
-- Connect as superuser
sudo -u postgres psql streamlick_dev

-- Grant permissions
GRANT ALL ON SCHEMA public TO streamlick;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO streamlick;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO streamlick;
```

### Redis Connection Issues

**Problem**: Redis connection refused

```bash
# Check if Redis is running
sudo systemctl status redis-server

# Start Redis
sudo systemctl start redis-server

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

### Port Already in Use

**Problem**: Port 3000, 3001, or 5173 already in use

```bash
# Find process using port
lsof -i :3000
# or
sudo netstat -tulpn | grep 3000

# Kill process
kill -9 <PID>

# Or use different ports in .env files:
# backend/.env: PORT=3010
# frontend/.env: VITE_API_URL=http://localhost:3010
```

### Prisma Migration Errors

**Problem**: Migration failed or out of sync

```bash
cd backend

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or create new migration
npx prisma migrate dev --name fix_schema

# Generate client again
npx prisma generate
```

### Module Not Found Errors

**Problem**: Cannot find module or package errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force

# For Prisma client issues:
cd backend
rm -rf node_modules/.prisma
npx prisma generate
```

### FFmpeg Not Found

**Problem**: FFmpeg not found or wrong version

```bash
# Check FFmpeg installation
which ffmpeg
ffmpeg -version

# Ubuntu/Debian: Reinstall FFmpeg
sudo apt remove ffmpeg
sudo apt update
sudo apt install ffmpeg

# macOS: Reinstall FFmpeg
brew uninstall ffmpeg
brew install ffmpeg
```

### WebRTC Connection Fails

**Problem**: WebRTC transport fails to connect

```bash
# Check MEDIASOUP_ANNOUNCED_IP is correct
echo $MEDIASOUP_ANNOUNCED_IP

# For local development, use:
MEDIASOUP_ANNOUNCED_IP=127.0.0.1

# Check firewall allows UDP ports
sudo ufw status
sudo ufw allow 40000:40100/udp

# Check ports are not in use
sudo netstat -ulpn | grep 40000
```

### OAuth Redirect Mismatch

**Problem**: redirect_uri_mismatch error from OAuth providers

1. Check the redirect URI in your `.env` file matches exactly
2. Check the redirect URI in the platform developer console
3. Common issues:
   - http vs https
   - trailing slash
   - localhost vs 127.0.0.1
   - port number

**Example fix**:
```bash
# In backend/.env - must match exactly
YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback

# In Google Cloud Console:
# Authorized redirect URIs: http://localhost:3000/auth/youtube/callback
```

### CORS Errors

**Problem**: CORS policy blocking frontend requests

```bash
# In backend/.env, ensure frontend URL is correct:
FRONTEND_URL=http://localhost:5173

# Check backend CORS configuration in backend/src/index.ts
# Should include your frontend URL in allowed origins
```

### Environment Variables Not Loading

**Problem**: Environment variables undefined

```bash
# Check .env file exists
ls -la backend/.env
ls -la frontend/.env

# Check .env file format (no spaces around =)
# ✅ CORRECT: API_KEY=abc123
# ❌ WRONG: API_KEY = abc123

# Restart services after changing .env
```

### Build Errors

**Problem**: TypeScript or build errors

```bash
# Clear build cache
rm -rf backend/dist
rm -rf frontend/dist
rm -rf frontend/.vite

# Reinstall dependencies
npm install

# Check TypeScript version
npx tsc --version

# Run type checking
cd frontend
npm run type-check
```

---

## Next Steps

After successful setup:

1. **Read the Documentation**
   - [CONFIGURATION.md](./CONFIGURATION.md) - Detailed configuration guide
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
   - [API.md](./API.md) - API documentation

2. **Explore the Features**
   - Create test broadcasts
   - Connect multiple platforms
   - Try screen sharing
   - Test chat moderation
   - View analytics dashboard

3. **Development Workflow**
   - Make changes to code
   - Hot reload is enabled for frontend (Vite)
   - Backend requires restart after changes
   - Use Prisma Studio for database inspection

4. **Join the Community**
   - GitHub Issues: Report bugs or request features
   - Discord: https://discord.gg/streamlick
   - Documentation: https://docs.streamlick.com

---

## Quick Reference

### Useful Commands

```bash
# Start development
npm run dev                    # Run all services

# Database
npx prisma migrate dev         # Run migrations
npx prisma studio             # Open database GUI
npx prisma db push            # Push schema changes (dev only)

# Testing
npm test                      # Run tests
npm run test:watch           # Watch mode

# Code quality
npm run lint                  # Run ESLint
npm run format               # Format with Prettier
npm run type-check          # TypeScript checks

# Docker
docker-compose up            # Start services
docker-compose down          # Stop services
docker-compose logs -f       # View logs
docker-compose exec backend sh  # Shell into container
```

### Default Credentials

After seeding database:

**Admin User**
- Email: admin@streamlick.com
- Password: admin123

**Test User**
- Email: test@streamlick.com
- Password: test123

**Database**
- Host: localhost
- Port: 5432
- Database: streamlick_dev
- User: streamlick
- Password: streamlick_dev_password

---

**Setup Complete! 🎉**

You're now ready to start developing with Streamlick. If you encounter any issues, check the [Troubleshooting](#troubleshooting) section or reach out to the community.

**Last Updated**: December 2024
