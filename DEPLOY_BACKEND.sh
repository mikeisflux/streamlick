#!/bin/bash
set -e  # Exit on error

echo "========================================="
echo "STREAMLICK BACKEND DEPLOYMENT"
echo "========================================="
echo ""

# Navigate to backend directory
cd /home/user/streamlick/backend

echo "1. Pulling latest code from git..."
git pull origin claude/merge-prisma-fixes-01DvvjwMtZftt1Dt31jUjJ6r
echo "✅ Code updated"
echo ""

echo "2. Installing dependencies..."
npm install --production=false
echo "✅ Dependencies installed"
echo ""

echo "3. Running Prisma migrations..."
npx prisma migrate deploy
echo "✅ Database migrated"
echo ""

echo "4. Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
echo ""

echo "5. Building TypeScript..."
npm run build
echo "✅ Build complete"
echo ""

echo "6. Restarting PM2 process..."
cd /home/user/streamlick
pm2 restart streamlick-backend
echo "✅ Backend restarted"
echo ""

echo "7. Waiting for backend to start..."
sleep 5

echo "8. Checking PM2 status..."
pm2 status | grep streamlick-backend
echo ""

echo "9. Checking backend health..."
curl -s http://localhost:3000/api/health || echo "❌ Health check failed"
echo ""

echo "10. Checking recent logs..."
pm2 logs streamlick-backend --lines 20 --nostream
echo ""

echo "========================================="
echo "DEPLOYMENT COMPLETE"
echo "========================================="
echo ""
echo "✅ Backend deployed successfully!"
echo ""
echo "VERIFY LOGIN FIX:"
echo "curl -X POST https://api.streamlick.com/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"test\"}'"
echo ""
echo "Expected: Should NOT return 403 Forbidden"
echo "========================================="
