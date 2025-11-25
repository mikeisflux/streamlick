# Production Fix: Prisma Module Not Found

## Problem
The backend is failing with `MODULE_NOT_FOUND` error when trying to import `@prisma/client` or `@prisma/engines`.

## Root Cause
1. The Prisma client was not generated after npm install
2. The `@prisma/engines` package was missing from dependencies
3. A TypeScript error in branding.routes.ts was preventing the build
4. PM2's require hook was interfering with Prisma's module resolution

## Solution
Run these commands on your production server:

```bash
cd /home/streamlick/backend

# 1. Pull the latest code (if fetch fails, the files are already there from the merge)
git pull origin claude/fix-prisma-import-018XoZFCnF48ov1xZqyRMkei || echo "Already on correct branch"

# 2. Clean install dependencies (this ensures @prisma/engines is installed)
rm -rf node_modules package-lock.json
npm install

# 3. CRITICAL: Generate Prisma Client
npx prisma generate

# 4. Build the TypeScript code
npm run build

# 5. Start PM2 with ecosystem config (fixes PM2 require hook issue)
pm2 delete streamlick-backend || true
pm2 start ecosystem.config.js

# 6. Save PM2 configuration
pm2 save

# 7. Check logs and health
pm2 logs streamlick-backend --lines 20
curl http://localhost:3000/health
```

## What Each Step Does

1. **rm -rf node_modules package-lock.json** - Cleans up any corrupted or incomplete installations
2. **npm install** - Installs all dependencies including the newly added `@prisma/engines` package
3. **npx prisma generate** - Generates the actual Prisma client code from your schema.prisma file
4. **npm run build** - Compiles TypeScript to JavaScript in the dist/ folder
5. **pm2 start ecosystem.config.js** - Starts PM2 with custom config that disables the problematic require hook
6. **pm2 save** - Saves the PM2 configuration so it persists across reboots

## Verification
After running these commands, check the logs:
```bash
pm2 logs streamlick-backend --lines 20
```

You should see:
- `Database connected` - Means Prisma client was generated and loaded successfully
- No MODULE_NOT_FOUND errors

## What Was Fixed

### 1. Added @prisma/engines to dependencies
The `@prisma/engines` package is required by Prisma but wasn't explicitly listed in package.json. This caused the "Cannot find module '@prisma/engines'" error.

### 2. Fixed Multer type error
Changed `Express.Multer.File` to `any` type in branding.routes.ts to fix TypeScript compilation error.

### 3. Fixed userId validation errors
Added proper null checks for userId in media-clips.routes.ts to satisfy TypeScript strict type checking.

### 4. Created PM2 ecosystem config (THE KEY FIX!)
Created `ecosystem.config.js` with `disable_trace: true` to bypass PM2's require hook that was breaking Prisma's module resolution. This was the root cause of the MODULE_NOT_FOUND errors even though the modules existed.

### 5. Improved postinstall script
The package.json has a postinstall script that automatically runs `prisma generate` after installation.

## Future Deployments
The postinstall script should handle Prisma generation automatically, but if you encounter issues:
- Manually run `npx prisma generate` after `npm install`
- Do a clean install if you see MODULE_NOT_FOUND errors: `rm -rf node_modules package-lock.json && npm install`

## Quick One-Liner Fix
```bash
cd /home/streamlick/backend && rm -rf node_modules package-lock.json && npm install && npx prisma generate && npm run build && pm2 delete streamlick-backend && pm2 start ecosystem.config.js && pm2 save && sleep 2 && curl http://localhost:3000/health && pm2 logs streamlick-backend --lines 20
```

This will build, start with the ecosystem config, test the health endpoint, and show logs.
