#!/bin/bash
set -e

BRANCH="claude/merge-all-fixes-01FGJymHU3AcvjLhVJYJX7iz"

echo "=========================================="
echo "🚀 DEPLOYING H.264 OPTIMIZATION FIX"
echo "=========================================="
echo ""

# Deploy Media Server
echo "📦 [1/4] Updating Media Server..."
cd /home/streamlick/media-server
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
npm install --production
npm run build
echo "✅ Media server code updated"
echo ""

# Deploy Frontend
echo "📦 [2/4] Updating Frontend..."
cd /home/streamlick/frontend
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
npm install --production
npm run build
echo "✅ Frontend code updated"
echo ""

# Restart Media Server
echo "🔄 [3/4] Restarting Media Server..."
pm2 restart streamlick-media-server
sleep 3
echo "✅ Media server restarted"
echo ""

# Restart Frontend
echo "🔄 [4/4] Restarting Frontend..."
pm2 restart streamlick-frontend
sleep 3
echo "✅ Frontend restarted"
echo ""

echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "📋 What changed:"
echo "  • Frontend now produces H.264 instead of VP8"
echo "  • Media server uses 'copy' instead of transcoding"
echo "  • Removed unnecessary keyframe request code"
echo "  • Cleaned up diagnostic logging"
echo ""
echo "🧪 To test:"
echo "  1. Open the frontend in browser"
echo "  2. Start a broadcast"
echo "  3. Check browser console for: 'Using H.264 codec for video (avoids transcoding)'"
echo "  4. Check media server logs for: '\"mimeType\": \"video/H264\"'"
echo ""
echo "📊 View logs:"
echo "  • Media Server: pm2 logs streamlick-media-server"
echo "  • Frontend: pm2 logs streamlick-frontend"
echo ""
