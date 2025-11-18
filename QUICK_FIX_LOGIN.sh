#!/bin/bash
# QUICK FIX: Rebuild and restart backend to apply CSRF login fix

echo "🔧 QUICK FIX: Restarting backend with CSRF fix..."
echo ""

cd /home/user/streamlick/backend

# Quick build and restart
echo "Building backend..."
npm run build

echo "Restarting PM2..."
cd /home/user/streamlick
pm2 restart streamlick-backend

echo "Waiting 3 seconds..."
sleep 3

echo ""
echo "✅ Backend restarted!"
echo ""
echo "Test login now - should work!"
