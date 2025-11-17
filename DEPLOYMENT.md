# Streamlick Deployment & Workflow Guide

**Last Updated**: 2025-11-17
**Branch**: `claude/fix-prisma-import-018XoZFCnF48ov1xZqyRMkei`

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Frontend Deployment](#frontend-deployment)
3. [Backend Deployment](#backend-deployment)
4. [nginx Configuration](#nginx-configuration)
5. [Common Issues & Fixes](#common-issues--fixes)
6. [Security Fixes Applied](#security-fixes-applied)
7. [Development Workflow](#development-workflow)

---

## Architecture Overview

### Production Stack
- **Frontend**: React + Vite, served as **static files** via nginx
- **Backend**: Node.js/Express, managed by **PM2**
- **Database**: PostgreSQL with Prisma ORM
- **Web Server**: nginx (reverse proxy + static file serving)
- **Domains**:
  - `streamlick.com` → Frontend (static files)
  - `api.streamlick.com` → Backend API (proxied to localhost:3000)

### Key Principle
**❌ DO NOT use PM2 for frontend**
**✅ Frontend is pre-built and served as static files by nginx**

---

## Frontend Deployment

### Current Setup (CORRECT)
```
Frontend Code → npm run build → dist/ → nginx serves static files
```

### Deployment Process

#### 1. Build Frontend
```bash
cd /home/streamlick/frontend
npm run build
```

**Build Output:**
- Creates `/home/streamlick/frontend/dist/`
- Contains: `index.html`, `assets/`, compiled JS/CSS bundles

#### 2. nginx Serves Static Files
nginx is configured to serve directly from `dist/`:
```nginx
server {
    server_name streamlick.com www.streamlick.com;
    root /home/streamlick/frontend/dist;
    index index.html;

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 3. No Process Management Needed
- **No PM2 process** for frontend
- **No `npm run preview`** or dev server
- nginx serves files directly (fastest, most reliable)

### Making Frontend Changes

```bash
# 1. Make code changes
cd /home/streamlick/frontend

# 2. Build
npm run build

# 3. That's it! nginx automatically serves new files from dist/
```

**No server restart needed** - nginx serves the updated static files immediately.

---

## Backend Deployment

### Current Setup
Backend runs as a PM2 process: `streamlick-backend`

### PM2 Configuration
Located at: `/home/streamlick/ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'streamlick-backend',
    script: 'node',
    args: '-r dotenv/config dist/server.js',
    cwd: '/home/streamlick/backend',
    env: {
      NODE_ENV: 'production',
      DOTENV_CONFIG_PATH: '/home/streamlick/backend/.env'
    },
    // ... other config
  }]
}
```

### Deployment Process

#### 1. Build Backend
```bash
cd /home/streamlick/backend
npm run build
```

#### 2. Restart Backend Process
```bash
pm2 restart streamlick-backend
# or
pm2 reload streamlick-backend  # zero-downtime reload
```

#### 3. Verify
```bash
pm2 status
pm2 logs streamlick-backend --lines 50
curl http://localhost:3000/api/health
```

### Backend Port
- Runs on `localhost:3000`
- nginx proxies `api.streamlick.com` to this port

---

## nginx Configuration

### File Location
`/etc/nginx/sites-enabled/streamlick`

### Complete Configuration

```nginx
# Frontend - Serve static files
server {
    server_name streamlick.com www.streamlick.com;

    # Serve static files from build directory
    root /home/streamlick/frontend/dist;
    index index.html;

    # SPA routing: serve index.html for all non-file routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy uploads to backend (user-uploaded backgrounds, etc.)
    location /uploads/ {
        proxy_pass http://localhost:3000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/streamlick.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/streamlick.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# Backend API
server {
    server_name api.streamlick.com;

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

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/streamlick.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/streamlick.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# HTTP to HTTPS redirects
server {
    if ($host = www.streamlick.com) {
        return 301 https://$host$request_uri;
    }
    if ($host = streamlick.com) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name streamlick.com www.streamlick.com;
    return 404;
}

server {
    if ($host = api.streamlick.com) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name api.streamlick.com;
    return 404;
}
```

### Updating nginx Config

```bash
# 1. Edit config
sudo nano /etc/nginx/sites-enabled/streamlick

# 2. Test config (ALWAYS do this before reload!)
sudo nginx -t

# 3. Reload nginx
sudo systemctl reload nginx

# 4. Check status
sudo systemctl status nginx
```

---

## Common Issues & Fixes

### Issue 1: Frontend 404 on Routes (e.g., /dashboard)

**Symptoms:**
- `streamlick.com/dashboard` shows "HTTP ERROR 404"
- Works on `streamlick.com` but not sub-routes

**Cause:**
- nginx looking for actual files instead of serving `index.html`
- Missing SPA routing configuration

**Fix:**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Issue 2: Frontend Build Fails with TypeScript Errors

**Symptoms:**
```
error TS2304: Cannot find name 'JSX'
error TS2339: Property 'IntrinsicElements' does not exist
```

**Cause:**
Missing React type definitions

**Fix:**
```bash
cd /home/streamlick/frontend
npm install --save-dev @types/react @types/react-dom
npm run build
```

### Issue 3: Prisma Import Errors in Backend

**Symptoms:**
```
Error: Cannot find module '@prisma/client'
```

**Cause:**
Prisma client not generated or NODE_PATH issues

**Fix:**
```bash
cd /home/streamlick/backend
npx prisma generate
npm run build
pm2 restart streamlick-backend
```

### Issue 4: Backend Environment Variables Not Loading

**Symptoms:**
- Backend fails to start
- "Missing required environment variables" errors

**Fix:**
Ensure PM2 ecosystem.config.js loads .env:
```javascript
{
  script: 'node',
  args: '-r dotenv/config dist/server.js',
  env: {
    DOTENV_CONFIG_PATH: '/home/streamlick/backend/.env'
  }
}
```

### Issue 5: WebSocket Connection Failures

**Symptoms:**
- Socket.IO disconnect errors
- Real-time features not working

**Fix:**
Check nginx WebSocket proxy config:
```nginx
location /socket.io {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
}
```

---

## Security Fixes Applied

### 1. File Upload MIME Type Validation

**Files Modified:**
- `backend/src/api/branding.routes.ts` (lines 87-98)
- `backend/src/api/assets.routes.ts` (lines 28-82)
- `backend/src/api/admin-assets.routes.ts`
- `backend/src/api/backgrounds.routes.ts`

**Fix:**
Added strict MIME type validation to prevent malicious file uploads:

```typescript
// Example from branding.routes.ts
const allowedMimeTypes = /image\/(x-icon|vnd\.microsoft\.icon|png)/;
const mimetype = allowedMimeTypes.test(file.mimetype);

if (!extname || !mimetype) {
  return cb(new Error('Invalid file type'));
}
```

**Allowed MIME Types:**
- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
- Videos: `video/mp4`, `video/webm`, `video/ogg`
- Audio: `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/webm`
- Max size: 2GB (configurable per route)

### 2. WebRTC Resource Cleanup on Disconnect

**File Modified:**
- `backend/src/socket/index.ts` (lines 801-838)

**Fix:**
Added comprehensive cleanup to prevent memory leaks:

```typescript
socket.on('disconnect', () => {
  const { broadcastId, participantId } = socket.data;

  if (broadcastId) {
    // Stop health monitoring
    streamHealthMonitor.stopMonitoring(broadcastId);

    // Clean up chat manager if last participant
    const roomSize = io.sockets.adapter.rooms.get(`broadcast:${broadcastId}`)?.size || 0;
    if (roomSize <= 1) {
      const chatManager = activeChatManagers.get(broadcastId);
      if (chatManager) {
        chatManager.stopAll();
        activeChatManagers.delete(broadcastId);
      }
    }

    // Notify others
    if (participantId) {
      socket.to(`broadcast:${broadcastId}`).emit('participant-disconnected', {
        participantId,
      });
    }
  }
});
```

### 3. Chat Moderation Interval Cleanup

**File Modified:**
- `backend/src/services/chat-moderation.service.ts` (lines 45-46, 741-754)

**Fix:**
Added interval cleanup to prevent memory leaks:

```typescript
private expirationCheckInterval: NodeJS.Timeout | null = null;

private constructor() {
  this.expirationCheckInterval = setInterval(() => this.checkExpiredTimeouts(), 60000);
}

cleanup(): void {
  // Clear expiration check interval
  if (this.expirationCheckInterval) {
    clearInterval(this.expirationCheckInterval);
    this.expirationCheckInterval = null;
  }

  // Clear all timeout timers
  this.timeoutTimers.forEach(timer => clearTimeout(timer));
  this.timeoutTimers.clear();
  this.activeTimeouts.clear();
}
```

### 4. Input Validation on Asset Upload

**File Modified:**
- `backend/src/api/assets.routes.ts`

**Validations Added:**
```typescript
// Required fields
if (!type || !name || !fileUrl) {
  return res.status(400).json({ error: 'Missing required fields' });
}

// MIME type validation
if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
  return res.status(400).json({ error: 'Invalid MIME type' });
}

// File size validation (max 2GB)
if (fileSizeBytes && fileSizeBytes > 2 * 1024 * 1024 * 1024) {
  return res.status(400).json({ error: 'File size exceeds maximum' });
}

// URL format validation
if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
  return res.status(400).json({ error: 'Invalid file URL format' });
}
```

---

## Development Workflow

### Starting Fresh on a New Branch

#### 1. Switch/Create Branch
```bash
git checkout -b claude/feature-name-SESSION_ID
# or
git checkout existing-branch
```

#### 2. Install Dependencies
```bash
# Frontend
cd /home/streamlick/frontend
npm install

# Backend
cd /home/streamlick/backend
npm install
npx prisma generate
```

#### 3. Build Both Applications
```bash
# Backend
cd /home/streamlick/backend
npm run build

# Frontend
cd /home/streamlick/frontend
npm run build
```

#### 4. Start/Restart Services
```bash
# Backend (via PM2)
pm2 restart streamlick-backend
# or if not running
pm2 start ecosystem.config.js

# Frontend (no action needed - nginx serves dist/)

# Check status
pm2 status
pm2 logs streamlick-backend --lines 50
```

### Making Changes

#### Frontend Changes
```bash
cd /home/streamlick/frontend
# ... make changes ...
npm run build  # Rebuild
# nginx automatically serves new files
```

#### Backend Changes
```bash
cd /home/streamlick/backend
# ... make changes ...
npm run build  # Rebuild
pm2 restart streamlick-backend  # Restart process
pm2 logs streamlick-backend  # Check logs
```

### Pre-Commit Checklist

- [ ] Backend builds without errors: `npm run build`
- [ ] Frontend builds without errors: `npm run build`
- [ ] Backend tests pass (if applicable): `npm test`
- [ ] No console errors in browser
- [ ] PM2 backend process running: `pm2 status`
- [ ] nginx config valid: `sudo nginx -t`
- [ ] All files committed: `git status`

### Git Workflow

```bash
# Check status
git status

# Stage changes
git add .

# Commit (let Claude handle commit messages)
git commit -m "feat: descriptive message"

# Push to current branch
git push -u origin $(git branch --show-current)
```

---

## Quick Reference Commands

### PM2 Commands
```bash
pm2 list                          # List all processes
pm2 status                        # Process status
pm2 logs streamlick-backend       # View logs
pm2 restart streamlick-backend    # Restart backend
pm2 reload streamlick-backend     # Zero-downtime reload
pm2 stop streamlick-backend       # Stop backend
pm2 delete streamlick-frontend    # Remove old frontend process (if exists)
pm2 save                          # Save current process list
```

### nginx Commands
```bash
sudo nginx -t                     # Test config
sudo systemctl reload nginx       # Reload nginx
sudo systemctl restart nginx      # Restart nginx
sudo systemctl status nginx       # Check status
```

### Build Commands
```bash
# Frontend
cd /home/streamlick/frontend
npm run build

# Backend
cd /home/streamlick/backend
npm run build

# Prisma
cd /home/streamlick/backend
npx prisma generate
npx prisma migrate deploy
```

### Health Checks
```bash
# Backend API
curl http://localhost:3000/api/health
curl https://api.streamlick.com/api/health

# Frontend
curl https://streamlick.com
curl -I https://streamlick.com/dashboard  # Should return 200

# PM2 Status
pm2 status

# nginx Status
sudo systemctl status nginx
```

---

## Important Notes

### DO NOT:
- ❌ Run `npm run preview` in production
- ❌ Use PM2 for frontend
- ❌ Proxy frontend through Node.js
- ❌ Push to main/master without PR
- ❌ Skip `nginx -t` before reload
- ❌ Commit without building first

### ALWAYS:
- ✅ Build frontend with `npm run build`
- ✅ Serve frontend as static files via nginx
- ✅ Use PM2 only for backend
- ✅ Test nginx config before reload
- ✅ Check PM2 logs after restart
- ✅ Validate builds before committing
- ✅ Use branch naming: `claude/description-SESSION_ID`

---

## File Locations Reference

### Frontend
- **Source**: `/home/streamlick/frontend/src/`
- **Build Output**: `/home/streamlick/frontend/dist/`
- **nginx Root**: `/home/streamlick/frontend/dist/`
- **Package**: `/home/streamlick/frontend/package.json`

### Backend
- **Source**: `/home/streamlick/backend/src/`
- **Build Output**: `/home/streamlick/backend/dist/`
- **Entry**: `/home/streamlick/backend/dist/server.js`
- **Env**: `/home/streamlick/backend/.env`
- **Prisma**: `/home/streamlick/backend/prisma/schema.prisma`

### Config Files
- **PM2**: `/home/streamlick/ecosystem.config.js`
- **nginx**: `/etc/nginx/sites-enabled/streamlick`
- **This Doc**: `/home/user/streamlick/DEPLOYMENT.md`

---

## Troubleshooting Checklist

When things go wrong, check in this order:

1. **Backend Process Running?**
   ```bash
   pm2 status
   pm2 logs streamlick-backend --lines 50
   ```

2. **Backend Build Succeeded?**
   ```bash
   cd /home/streamlick/backend
   npm run build
   ```

3. **Frontend Build Succeeded?**
   ```bash
   cd /home/streamlick/frontend
   npm run build
   ls -la dist/  # Should see index.html and assets/
   ```

4. **nginx Config Valid?**
   ```bash
   sudo nginx -t
   ```

5. **Environment Variables Set?**
   ```bash
   cat /home/streamlick/backend/.env | grep -v "SECRET\|KEY"
   ```

6. **Prisma Client Generated?**
   ```bash
   cd /home/streamlick/backend
   npx prisma generate
   ```

7. **Database Accessible?**
   ```bash
   cd /home/streamlick/backend
   npx prisma db pull  # Test connection
   ```

8. **Ports Not Conflicting?**
   ```bash
   sudo lsof -i :3000  # Backend should be only process
   ```

---

**End of Deployment Guide**

*This document should be read at the start of each new session to understand the current architecture and deployment workflow.*
