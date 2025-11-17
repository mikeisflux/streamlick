#!/bin/bash
# Production Deployment Script for Streamlick
# Run this on your production server: root@ubuntu-8gb-hel1-1

set -e  # Exit on error

echo "🚀 Starting Streamlick Production Deployment..."

# Navigate to project directory
cd /home/streamlick

# Show current branch
echo "📍 Current branch:"
git branch --show-current

# Stash any local changes (like package.json modifications)
echo "💾 Stashing local changes..."
git stash

# Pull latest changes from remote
echo "⬇️  Pulling latest changes from claude/typescript-fixes-011CUxwD2gErLYv6K5RLsuM9..."
git fetch origin claude/typescript-fixes-011CUxwD2gErLYv6K5RLsuM9
git pull origin claude/typescript-fixes-011CUxwD2gErLYv6K5RLsuM9

# Navigate to backend
cd /home/streamlick/backend

# Clean dist folder to ensure fresh build
echo "🧹 Cleaning dist folder..."
rm -rf dist

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install

# Build backend
echo "🔨 Building backend..."
npm run build

# Check if auth/middleware was compiled
echo "✅ Verifying auth middleware was compiled:"
ls -la dist/auth/middleware.js 2>/dev/null && echo "  ✓ middleware.js exists" || echo "  ✗ middleware.js missing!"

# Navigate to frontend
cd /home/streamlick/frontend

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Restart PM2 services
echo "🔄 Restarting PM2 services..."
pm2 restart streamlick-api
pm2 restart streamlick-frontend

# Wait a moment for services to start
sleep 3

# Show status
echo "📊 PM2 Status:"
pm2 status

# Show recent logs
echo "📝 Recent logs (last 20 lines):"
pm2 logs streamlick-api --lines 20 --nostream

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Test login at your frontend URL with:"
echo "   Email: divinitycomicsinc@gmail.com"
echo "   Password: Good2Go!"
