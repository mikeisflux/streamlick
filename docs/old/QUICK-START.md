# 🚀 Streamlick Quick Start Guide

Get Streamlick up and running in under 10 minutes!

## Prerequisites

- Docker & Docker Compose installed
- Port 3000, 3001, 3002 available
- SendGrid API key (or use dev mode)

## Step 1: Clone & Setup

```bash
git clone <your-repo-url>
cd streamlick

# Install dependencies
npm install
```

## Step 2: Configure Environment

```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Minimal `.env` configuration:**

```bash
DATABASE_URL=postgresql://streamlick:secret@localhost:5432/streamlick_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-random-secret-key-here
NODE_ENV=development
```

## Step 3: Start Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait 5 seconds for databases to initialize
sleep 5

# Run database migrations
cd backend
npx prisma migrate dev
npx prisma generate
cd ..

# Start all development servers
npm run dev
```

## Step 4: Access Application

- **Frontend**: http://localhost:3002
- **API**: http://localhost:3000
- **Media Server**: http://localhost:3001

## First Time Setup

1. **Open** http://localhost:3002
2. **Enter your email** on the login page
3. **Check console** for magic link (in dev mode, links are logged to console)
4. **Click the link** or copy/paste into browser
5. **You're in!** Create your first broadcast

## Testing the Platform

### Create a Test Broadcast

1. Click "Create Broadcast" on dashboard
2. Enter a title (e.g., "Test Stream")
3. Click "Create"

### Test Camera Access

1. Open your broadcast in the studio
2. Allow camera/microphone permissions when prompted
3. You should see your video preview

### Test Multistreaming (Optional)

1. Add a destination (Settings → Destinations)
2. For testing, use a custom RTMP URL or connect YouTube
3. Click "Go Live" in studio

## Quick Commands Reference

```bash
# Development
npm run dev              # Start all services
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only
npm run dev:media        # Media server only

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database (optional)

# Docker
npm run docker:up        # Start all with Docker
npm run docker:down      # Stop all Docker services
npm run docker:build     # Rebuild Docker images

# Production
npm run build            # Build all
npm start                # Start production servers
```

## Common Issues

### "Port already in use"

```bash
# Check what's using the port
lsof -i :3000
lsof -i :3001
lsof -i :3002

# Kill the process or change ports in .env
```

### "Database connection failed"

```bash
# Ensure PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### "Cannot access camera/microphone"

- Use **HTTPS** or **localhost** (required for WebRTC)
- Check browser permissions
- Ensure no other app is using camera

### "Magic link not working"

In development mode, magic links are logged to the backend console:

```bash
# Check backend logs
npm run dev:backend
# Look for: "Magic link (dev mode): http://..."
```

## Email Setup (Production)

### SendGrid (Recommended)

1. Sign up at https://sendgrid.com
2. Create API key
3. Add to `.env`:
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
```

### Alternative: SMTP

Edit `backend/src/services/email.ts` to use nodemailer with SMTP.

## Deploying to Production

See detailed guides:
- **Full Guide**: `docs/DEPLOYMENT.md`
- **VPS (DigitalOcean)**: Quick deploy with Docker
- **AWS**: EC2 + RDS setup
- **Heroku**: One-click deploy

## Next Steps

1. ✅ Configure streaming destinations (YouTube, Facebook, etc.)
2. ✅ Set up Stripe for billing integration
3. ✅ Customize branding and layouts
4. ✅ Invite guests to test multi-participant streaming
5. ✅ Deploy to production!

## Need Help?

- **Documentation**: Check `README.md` and `docs/`
- **Issues**: Report on GitHub
- **Email**: support@streamlick.com

## Development Tips

### Hot Reload

All services support hot reload in development:
- Frontend: Instant updates (Vite)
- Backend: Auto-restart (tsx watch)
- Media Server: Auto-restart (tsx watch)

### Database GUI

```bash
npm run db:studio
# Opens Prisma Studio at http://localhost:5555
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f media-server
```

### Reset Everything

```bash
# Stop all services
docker-compose down -v

# Remove node_modules
rm -rf node_modules backend/node_modules frontend/node_modules media-server/node_modules

# Fresh install
npm install
npm run docker:up
cd backend && npx prisma migrate deploy
```

## Production Checklist

Before going live:

- [ ] Change `JWT_SECRET` to strong random value
- [ ] Set up SendGrid or email service
- [ ] Configure Stripe payment integration
- [ ] Set up SSL/HTTPS with Let's Encrypt
- [ ] Configure domain DNS
- [ ] Set `NODE_ENV=production`
- [ ] Enable firewall (ports 80, 443, 1935, 40000-40100)
- [ ] Set up database backups
- [ ] Configure monitoring (UptimeRobot, etc.)
- [ ] Test WebRTC connections from different networks
- [ ] Set up TURN server for NAT traversal

---

**You're all set!** Start creating professional live streams with Streamlick. 🎥✨
