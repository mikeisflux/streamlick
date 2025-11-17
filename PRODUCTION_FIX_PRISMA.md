# Production Fix: Prisma Module Not Found

## Problem
The backend is failing with `MODULE_NOT_FOUND` error when trying to import `@prisma/client` or `@prisma/engines`.

## Root Cause
1. The Prisma client was not generated after npm install
2. The `@prisma/engines` package was missing from dependencies
3. A TypeScript error in branding.routes.ts was preventing the build

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

# 5. Restart PM2
pm2 restart streamlick-backend

# 6. Check logs
pm2 logs streamlick-backend --lines 20
```

## What Each Step Does

1. **rm -rf node_modules package-lock.json** - Cleans up any corrupted or incomplete installations
2. **npm install** - Installs all dependencies including the newly added `@prisma/engines` package
3. **npx prisma generate** - Generates the actual Prisma client code from your schema.prisma file
4. **npm run build** - Compiles TypeScript to JavaScript in the dist/ folder
5. **pm2 restart** - Restarts the application with the new code

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
Changed `Express.Multer.File` to `multer.File` in branding.routes.ts to fix TypeScript compilation error.

### 3. Improved postinstall script
The package.json now has a postinstall script that automatically runs `prisma generate` after installation.

## Future Deployments
The postinstall script should handle Prisma generation automatically, but if you encounter issues:
- Manually run `npx prisma generate` after `npm install`
- Do a clean install if you see MODULE_NOT_FOUND errors: `rm -rf node_modules package-lock.json && npm install`

## Quick One-Liner Fix
```bash
cd /home/streamlick/backend && rm -rf node_modules package-lock.json && npm install && npx prisma generate && npm run build && pm2 restart streamlick-backend && pm2 logs streamlick-backend --lines 30
```
