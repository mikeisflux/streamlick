# ⚙️ Streamlick Configuration Guide

This comprehensive guide covers all configuration options for Streamlick, including environment variables, feature flags, and advanced settings.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Database Configuration](#database-configuration)
3. [Authentication & Security](#authentication--security)
4. [Platform Integrations](#platform-integrations)
5. [Media Server Configuration](#media-server-configuration)
6. [Email Configuration](#email-configuration)
7. [Payment Configuration](#payment-configuration)
8. [Feature Flags](#feature-flags)
9. [Advanced Settings](#advanced-settings)
10. [Production Recommendations](#production-recommendations)

---

## Environment Variables

Streamlick uses environment variables for configuration. Each service (backend, frontend, media-server) has its own `.env` file.

### Backend Environment Variables (`backend/.env`)

#### Core Settings

```bash
# Node Environment
NODE_ENV=development              # development | production | test
PORT=3000                         # Backend API port
```

**NODE_ENV Values:**
- `development`: Enables debug logging, detailed error messages, hot reload
- `production`: Optimized builds, error logging only, security hardened
- `test`: Enables test database, mocks external services

#### Database Configuration

```bash
# PostgreSQL Connection
DATABASE_URL="postgresql://user:password@host:port/database"

# Example formats:
# Local: postgresql://streamlick:password@localhost:5432/streamlick_dev
# With SSL: postgresql://user:pass@host:5432/db?sslmode=require
# With connection pool: postgresql://user:pass@host:5432/db?connection_limit=10

# Prisma Configuration
SHADOW_DATABASE_URL="postgresql://..."  # For schema migrations (optional)
```

**Database URL Parameters:**
- `sslmode`: `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`
- `connection_limit`: Max connections (default: 10)
- `pool_timeout`: Connection timeout in seconds
- `schema`: PostgreSQL schema name (default: public)

#### Redis Configuration

```bash
# Redis Connection
REDIS_URL="redis://host:port"

# Examples:
# Local: redis://localhost:6379
# With password: redis://:password@localhost:6379
# With DB: redis://localhost:6379/0
# Cloud: redis://username:password@host:port

# Redis Configuration
REDIS_TTL=3600                    # Default TTL in seconds (1 hour)
REDIS_MAX_RETRIES=3               # Connection retry attempts
```

**Redis Use Cases:**
- Session storage
- Rate limiting
- Caching API responses
- Socket.IO adapter (for horizontal scaling)
- Queue management

#### Security Settings

```bash
# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_EXPIRATION="7d"               # Token expiration (7d, 24h, 60m)
JWT_REFRESH_EXPIRATION="30d"     # Refresh token expiration

# Encryption
ENCRYPTION_KEY="32-byte-base64-encoded-key-here"
ENCRYPTION_ALGORITHM="aes-256-gcm"  # Encryption algorithm

# CORS
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS="http://localhost:5173,https://yourdomain.com"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window
```

**Security Best Practices:**
- Generate JWT_SECRET with: `openssl rand -hex 32`
- Generate ENCRYPTION_KEY with: `openssl rand -base64 32`
- Use strong passwords (min 16 characters)
- Enable HTTPS in production
- Set restrictive CORS_ORIGINS

#### Platform OAuth Configuration

##### YouTube/Google

```bash
YOUTUBE_CLIENT_ID="your-google-oauth-client-id.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="your-google-oauth-client-secret"
YOUTUBE_REDIRECT_URI="http://localhost:3000/auth/youtube/callback"

# Scopes (automatically used)
# - https://www.googleapis.com/auth/youtube
# - https://www.googleapis.com/auth/youtube.readonly
# - https://www.googleapis.com/auth/youtube.force-ssl
```

##### Twitch

```bash
TWITCH_CLIENT_ID="your-twitch-client-id"
TWITCH_CLIENT_SECRET="your-twitch-client-secret"
TWITCH_REDIRECT_URI="http://localhost:3000/auth/twitch/callback"

# Scopes (automatically used)
# - channel:manage:broadcast
# - channel:read:stream_key
# - user:read:email
```

##### Facebook/Meta

```bash
FACEBOOK_APP_ID="your-facebook-app-id"
FACEBOOK_APP_SECRET="your-facebook-app-secret"
FACEBOOK_REDIRECT_URI="http://localhost:3000/auth/facebook/callback"

# Scopes (automatically used)
# - public_profile
# - email
# - publish_video
# - pages_manage_posts
# - pages_read_engagement
```

##### LinkedIn

```bash
LINKEDIN_CLIENT_ID="your-linkedin-client-id"
LINKEDIN_CLIENT_SECRET="your-linkedin-client-secret"
LINKEDIN_REDIRECT_URI="http://localhost:3000/auth/linkedin/callback"

# Scopes (automatically used)
# - r_liteprofile
# - w_member_social
```

##### Twitter/X

```bash
TWITTER_API_KEY="your-twitter-api-key"
TWITTER_API_SECRET="your-twitter-api-secret"
TWITTER_BEARER_TOKEN="your-twitter-bearer-token"
TWITTER_REDIRECT_URI="http://localhost:3000/auth/twitter/callback"

# Scopes (automatically used)
# - tweet.read
# - tweet.write
# - users.read
```

#### Email Configuration

##### SendGrid (Recommended)

```bash
# SendGrid
SENDGRID_API_KEY="SG.your-sendgrid-api-key"
FROM_EMAIL="noreply@yourdomain.com"
FROM_NAME="Streamlick"

# Email Settings
EMAIL_VERIFICATION_ENABLED=true
PASSWORD_RESET_EXPIRATION=3600   # 1 hour in seconds
```

##### SMTP (Alternative)

```bash
# SMTP Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false                # true for 465, false for other ports
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

FROM_EMAIL="noreply@yourdomain.com"
FROM_NAME="Streamlick"
```

**Email Templates:**
- Welcome email
- Email verification
- Password reset
- Broadcast notifications
- Billing receipts

#### Payment Configuration (Stripe)

```bash
# Stripe Keys
STRIPE_SECRET_KEY="sk_test_your-secret-key"      # sk_test_ or sk_live_
STRIPE_PUBLISHABLE_KEY="pk_test_your-public-key" # pk_test_ or pk_live_
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret"

# Stripe Configuration
STRIPE_CURRENCY="usd"
STRIPE_TRIAL_PERIOD_DAYS=14

# Price IDs (from Stripe Dashboard)
STRIPE_STARTER_PRICE_ID="price_starter_monthly"
STRIPE_PRO_PRICE_ID="price_pro_monthly"
STRIPE_ENTERPRISE_PRICE_ID="price_enterprise_monthly"
```

**Stripe Webhook Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

#### Logging & Monitoring

```bash
# Logging
LOG_LEVEL="info"                 # error | warn | info | debug | trace
LOG_FORMAT="json"                # json | pretty
LOG_FILE="logs/app.log"

# Sentry (Error Tracking)
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
SENTRY_ENVIRONMENT="development"  # development | staging | production
SENTRY_TRACES_SAMPLE_RATE=1.0    # 0.0 to 1.0 (1.0 = 100%)

# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=90       # How long to keep metrics
```

#### Feature Flags

```bash
# Feature Toggles
ENABLE_REGISTRATION=true          # Allow new user registration
ENABLE_SOCIAL_LOGIN=true          # OAuth providers
ENABLE_EMAIL_VERIFICATION=true    # Require email verification
ENABLE_PAYMENTS=true              # Stripe integration
ENABLE_RECORDINGS=true            # Save broadcast recordings
ENABLE_CHAT_MODERATION=true       # Chat moderation features
ENABLE_ANALYTICS=true             # Usage analytics
ENABLE_WEBHOOKS=true              # Outgoing webhooks

# Limits
MAX_BROADCASTS_PER_USER=10        # Concurrent broadcasts
MAX_PARTICIPANTS_PER_BROADCAST=100
MAX_STREAM_DURATION=14400         # 4 hours in seconds
MAX_FILE_UPLOAD_SIZE=104857600    # 100MB in bytes
```

---

### Frontend Environment Variables (`frontend/.env`)

```bash
# API Endpoints
VITE_API_URL=http://localhost:3000
VITE_MEDIA_SERVER_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3000

# Environment
VITE_NODE_ENV=development

# Stripe (Public Key)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-public-key

# Feature Flags (Frontend)
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_CHAT=true
VITE_ENABLE_SCREEN_SHARE=true

# App Configuration
VITE_APP_NAME="Streamlick"
VITE_APP_VERSION="1.0.0"
VITE_APP_URL="http://localhost:5173"

# OAuth Redirect (for client-side flows)
VITE_OAUTH_REDIRECT_URI="http://localhost:5173/auth/callback"

# Debugging
VITE_DEBUG=false
VITE_LOG_LEVEL="info"
```

**Important Notes:**
- All frontend env vars must start with `VITE_`
- These are exposed to the browser (don't put secrets here!)
- Changes require restart of Vite dev server

---

### Media Server Environment Variables (`media-server/.env`)

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Mediasoup Configuration
MEDIASOUP_ANNOUNCED_IP=127.0.0.1     # Public IP for WebRTC
MEDIASOUP_LISTEN_IP=0.0.0.0          # Listen on all interfaces

# WebRTC Port Range
RTC_MIN_PORT=40000
RTC_MAX_PORT=40100

# Worker Settings
MEDIASOUP_NUM_WORKERS=4               # Number of CPU cores to use
MEDIASOUP_LOG_LEVEL="warn"           # debug | warn | error

# Backend Integration
BACKEND_URL=http://localhost:3000
BACKEND_API_KEY="your-internal-api-key"

# RTMP Configuration
RTMP_PORT=1935
RTMP_CHUNK_SIZE=60000
RTMP_GOP_CACHE=true
RTMP_PING=30
RTMP_PING_TIMEOUT=60

# Recording Configuration
ENABLE_RECORDING=true
RECORDING_PATH="/var/recordings"
RECORDING_FORMAT="mp4"                # mp4 | mkv | webm
RECORDING_QUALITY="high"              # low | medium | high | ultra

# Streaming Limits
MAX_BITRATE=8000000                   # 8 Mbps
MIN_BITRATE=600000                    # 600 Kbps
MAX_FRAMERATE=60
```

---

## Database Configuration

### Connection Pooling

For production, configure connection pooling:

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Connection pool settings
  pool {
    timeout = 20
    max = 20
  }
}
```

### Database URL Parameters

```bash
# Basic
DATABASE_URL="postgresql://user:pass@host:5432/db"

# With SSL
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# With connection limits
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=30"

# With schema
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=streamlick"

# Cloud providers
# Heroku
DATABASE_URL="${HEROKU_POSTGRESQL_URL}?sslmode=require"

# Supabase
DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres?pgbouncer=true"

# AWS RDS
DATABASE_URL="postgresql://user:pass@instance.region.rds.amazonaws.com:5432/db?sslmode=verify-full"
```

### Prisma Studio Configuration

```bash
# Access Prisma Studio
npx prisma studio --port 5555

# Environment-specific
npx prisma studio --schema=./prisma/schema.prisma
```

---

## Authentication & Security

### JWT Configuration

```bash
# Token settings
JWT_SECRET="minimum-32-character-secret-key"
JWT_EXPIRATION="7d"               # 7 days
JWT_REFRESH_EXPIRATION="30d"     # 30 days
JWT_ALGORITHM="HS256"             # HS256 | RS256

# Cookie settings
JWT_COOKIE_NAME="streamlick_token"
JWT_COOKIE_DOMAIN=".yourdomain.com"
JWT_COOKIE_SECURE=true            # HTTPS only
JWT_COOKIE_HTTPONLY=true          # No JavaScript access
JWT_COOKIE_SAMESITE="strict"      # strict | lax | none
```

### Password Requirements

```bash
# Password policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBER=true
PASSWORD_REQUIRE_SPECIAL=false
PASSWORD_MAX_AGE_DAYS=90          # Force reset after 90 days

# Hashing
BCRYPT_ROUNDS=10                  # 10-12 recommended
```

### Rate Limiting

```bash
# Global rate limit
RATE_LIMIT_WINDOW_MS=900000       # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100       # Max requests per window

# Auth endpoints (stricter)
AUTH_RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
AUTH_RATE_LIMIT_MAX_REQUESTS=5    # 5 login attempts

# API endpoints (per user)
API_RATE_LIMIT_WINDOW_MS=60000    # 1 minute
API_RATE_LIMIT_MAX_REQUESTS=60    # 60 requests per minute
```

### CORS Configuration

```bash
# Allowed origins
CORS_ORIGINS="http://localhost:5173,https://yourdomain.com,https://www.yourdomain.com"

# CORS settings
CORS_CREDENTIALS=true              # Allow cookies
CORS_MAX_AGE=86400                # Preflight cache (24 hours)
```

---

## Platform Integrations

### YouTube Live Streaming

```bash
# OAuth
YOUTUBE_CLIENT_ID="..."
YOUTUBE_CLIENT_SECRET="..."

# API Configuration
YOUTUBE_API_QUOTA_LIMIT=10000      # Daily quota
YOUTUBE_AUTO_START=true            # Auto-start stream
YOUTUBE_PRIVACY="public"           # public | unlisted | private
YOUTUBE_ENABLE_DVR=true            # Enable DVR for viewers
YOUTUBE_ENABLE_AUTO_CC=false       # Auto closed captions
```

### Twitch Streaming

```bash
# OAuth
TWITCH_CLIENT_ID="..."
TWITCH_CLIENT_SECRET="..."

# Streaming Configuration
TWITCH_MAX_BITRATE=6000           # 6000 Kbps (Twitch limit)
TWITCH_AUTO_HOST=true             # Auto-host when offline
TWITCH_SAVE_VOD=true              # Save broadcast as VOD
```

### Facebook Live

```bash
# OAuth
FACEBOOK_APP_ID="..."
FACEBOOK_APP_SECRET="..."

# Live Configuration
FACEBOOK_PRIVACY="EVERYONE"        # EVERYONE | FRIENDS | SELF
FACEBOOK_ENABLE_COMMENTS=true
FACEBOOK_ENABLE_REACTIONS=true
FACEBOOK_CROSSPOST_PAGES=[]       # Array of page IDs
```

---

## Media Server Configuration

### Mediasoup Settings

```bash
# Worker configuration
MEDIASOUP_NUM_WORKERS=4           # Number of CPU cores
MEDIASOUP_LOG_LEVEL="warn"
MEDIASOUP_LOG_TAGS="info,ice,dtls,rtp,srtp,rtcp"

# Port range
RTC_MIN_PORT=40000
RTC_MAX_PORT=40100

# Transport settings
MEDIASOUP_INITIAL_BITRATE=8000000  # 8 Mbps
MEDIASOUP_MIN_BITRATE=600000       # 600 Kbps
MEDIASOUP_MAX_BITRATE=12000000     # 12 Mbps

# Advanced
MEDIASOUP_MAX_INCOMING_BITRATE=12000000
MEDIASOUP_MAX_OUTGOING_BITRATE=8000000
```

### FFmpeg Encoding

```bash
# Encoder settings
FFMPEG_PRESET="veryfast"          # ultrafast | veryfast | fast | medium
FFMPEG_PROFILE="main"             # baseline | main | high
FFMPEG_LEVEL="4.0"                # 3.0 | 3.1 | 4.0 | 4.1

# Video
VIDEO_CODEC="libx264"             # libx264 | libx265
VIDEO_BITRATE=6000                # kbps
VIDEO_RESOLUTION="1920x1080"
VIDEO_FRAMERATE=30
VIDEO_GOP_SIZE=60                 # 2 seconds at 30fps
VIDEO_BUFSIZE_MULTIPLIER=2        # bufsize = bitrate * multiplier

# Audio
AUDIO_CODEC="aac"
AUDIO_BITRATE=160                 # kbps
AUDIO_SAMPLE_RATE=48000           # Hz
AUDIO_CHANNELS=2                  # Stereo
```

### Adaptive Bitrate

```bash
# ABR Configuration
ENABLE_ADAPTIVE_BITRATE=true
ABR_CHECK_INTERVAL=10000          # Check every 10 seconds
ABR_DOWNGRADE_THRESHOLD=3         # Bad readings before downgrade
ABR_UPGRADE_THRESHOLD=5           # Good readings before upgrade

# Quality thresholds
ABR_PACKET_LOSS_THRESHOLD=5       # 5% packet loss triggers downgrade
ABR_DROP_RATE_THRESHOLD=3         # 3% drop rate triggers downgrade
ABR_RTT_THRESHOLD=300             # 300ms RTT triggers downgrade
```

---

## Email Configuration

### SendGrid Setup

```bash
# API Key
SENDGRID_API_KEY="SG.your-api-key"

# Sender
FROM_EMAIL="noreply@yourdomain.com"
FROM_NAME="Streamlick"
REPLY_TO="support@yourdomain.com"

# Templates (SendGrid Template IDs)
SENDGRID_WELCOME_TEMPLATE="d-xxx"
SENDGRID_VERIFICATION_TEMPLATE="d-xxx"
SENDGRID_PASSWORD_RESET_TEMPLATE="d-xxx"
SENDGRID_BROADCAST_NOTIFICATION_TEMPLATE="d-xxx"

# Settings
EMAIL_BATCH_SIZE=1000             # Max emails per batch
EMAIL_RETRY_ATTEMPTS=3
```

### SMTP Setup

```bash
# Connection
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# TLS
SMTP_TLS_REQUIRED=true
SMTP_TLS_REJECT_UNAUTHORIZED=true

# Timeouts
SMTP_CONNECTION_TIMEOUT=30000     # 30 seconds
SMTP_SOCKET_TIMEOUT=30000
```

---

## Payment Configuration

### Stripe Setup

```bash
# Keys
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Configuration
STRIPE_CURRENCY="usd"
STRIPE_TRIAL_PERIOD_DAYS=14
STRIPE_PAYMENT_METHODS="card,us_bank_account"

# Products & Prices
STRIPE_STARTER_PRICE_ID="price_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_ENTERPRISE_PRICE_ID="price_..."

# Billing
STRIPE_INVOICE_DUE_DAYS=7
STRIPE_LATE_FEE=5.00
```

### Webhook Configuration

```bash
# Stripe Webhook
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_WEBHOOK_TOLERANCE=300      # 5 minutes

# Internal Webhooks
WEBHOOK_SECRET="your-webhook-secret"
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_TIMEOUT=10000             # 10 seconds
```

---

## Feature Flags

Feature flags allow enabling/disabling features without code changes.

```bash
# User Management
ENABLE_REGISTRATION=true
ENABLE_EMAIL_VERIFICATION=true
ENABLE_SOCIAL_LOGIN=true
ENABLE_PASSWORD_RESET=true
ENABLE_2FA=false

# Broadcasting
ENABLE_MULTI_PLATFORM_STREAMING=true
ENABLE_SCREEN_SHARING=true
ENABLE_GUEST_PARTICIPANTS=true
ENABLE_RECORDING=true
ENABLE_LIVE_CHAT=true
ENABLE_CHAT_MODERATION=true

# Analytics
ENABLE_ANALYTICS=true
ENABLE_REAL_TIME_METRICS=true
ENABLE_EXPORT_DATA=true

# Payments
ENABLE_PAYMENTS=true
ENABLE_SUBSCRIPTIONS=true
ENABLE_TRIALS=true

# Platform Integrations
ENABLE_YOUTUBE=true
ENABLE_TWITCH=true
ENABLE_FACEBOOK=true
ENABLE_LINKEDIN=true
ENABLE_TWITTER=true

# Advanced Features
ENABLE_WEBHOOKS=true
ENABLE_API_ACCESS=true
ENABLE_CUSTOM_RTMP=true
ENABLE_CDN_INTEGRATION=false
```

---

## Advanced Settings

### Performance Tuning

```bash
# Node.js
NODE_OPTIONS="--max-old-space-size=4096"  # 4GB heap
UV_THREADPOOL_SIZE=16             # libuv thread pool

# Clustering
CLUSTER_ENABLED=true
CLUSTER_WORKERS=4                 # Number of workers

# Caching
CACHE_ENABLED=true
CACHE_TTL=3600                    # 1 hour
CACHE_MAX_SIZE=1000               # Max items
```

### Monitoring & Observability

```bash
# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_PATH="/metrics"

# Health Checks
HEALTH_CHECK_PATH="/health"
HEALTH_CHECK_INTERVAL=30000       # 30 seconds

# Distributed Tracing
TRACING_ENABLED=false
JAEGER_ENDPOINT="http://localhost:14268/api/traces"
```

---

## Production Recommendations

### Essential Security Settings

```bash
NODE_ENV=production
JWT_COOKIE_SECURE=true            # HTTPS only
JWT_COOKIE_HTTPONLY=true
JWT_COOKIE_SAMESITE="strict"
CORS_ORIGINS="https://yourdomain.com"  # Specific domains
RATE_LIMIT_MAX_REQUESTS=100       # Strict rate limiting
LOG_LEVEL="warn"                  # Reduce log verbosity
```

### Performance Settings

```bash
# Database
DATABASE_URL="postgresql://...?connection_limit=20&pool_timeout=30"

# Redis
REDIS_URL="redis://...?max_clients=50"

# Node.js
NODE_OPTIONS="--max-old-space-size=4096"
CLUSTER_ENABLED=true
CLUSTER_WORKERS=4
```

### Monitoring Settings

```bash
# Error Tracking
SENTRY_DSN="https://..."
SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE=0.1     # 10% sampling

# Logging
LOG_LEVEL="warn"
LOG_FORMAT="json"
LOG_FILE="/var/log/streamlick/app.log"
```

---

## Configuration Checklist

### Development Setup
- [ ] Database connection configured
- [ ] Redis connection configured
- [ ] JWT secret generated
- [ ] CORS origins set for localhost
- [ ] At least one platform OAuth configured
- [ ] Email provider configured (or disabled)

### Production Deployment
- [ ] All secrets regenerated (don't use dev keys!)
- [ ] Database connection uses SSL
- [ ] HTTPS enabled everywhere
- [ ] CORS origins restricted to production domains
- [ ] All platform OAuth redirects updated to production URLs
- [ ] Email provider configured with real domain
- [ ] Payment provider in live mode
- [ ] Error tracking enabled (Sentry)
- [ ] Monitoring configured
- [ ] Backups configured
- [ ] Rate limiting enabled
- [ ] Log rotation configured

---

## Support

For configuration issues:
- Check logs: `docker-compose logs` or `pm2 logs`
- Verify environment: `printenv | grep VARIABLE_NAME`
- Test connections: Use provided health check endpoints
- Documentation: https://docs.streamlick.com
- Community: https://discord.gg/streamlick

---

**Last Updated**: December 2024
