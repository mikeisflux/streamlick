#!/bin/bash
set -e

echo "========================================="
echo "FIX PRISMA BUILD ERRORS"
echo "========================================="
echo ""

cd /home/user/streamlick/backend

echo "1. Running database migrations..."
npx prisma migrate deploy
echo "✅ Migrations deployed"
echo ""

echo "2. Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
echo ""

echo "3. Building backend..."
npm run build
echo "✅ Backend built successfully"
echo ""

echo "4. Restarting PM2..."
cd /home/user/streamlick
pm2 restart streamlick-backend
echo "✅ Backend restarted"
echo ""

echo "========================================="
echo "BUILD FIXED!"
echo "========================================="
