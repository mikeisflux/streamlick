# Production Fix: Prisma Module Not Found

## Problem
The backend is failing with `MODULE_NOT_FOUND` error when trying to import `@prisma/client`.

## Root Cause
The Prisma client was not generated after npm install. The `@prisma/client` package is installed, but the actual generated client code is missing.

## Solution
Run these commands on your production server:

```bash
cd /home/streamlick/backend

# 1. Pull the latest code
git fetch origin claude/fix-prisma-import-018XoZFCnF48ov1xZqyRMkei
git checkout claude/fix-prisma-import-018XoZFCnF48ov1xZqyRMkei

# 2. Install dependencies
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

1. **npm install** - Installs the `@prisma/client` package and all other dependencies
2. **npx prisma generate** - Generates the actual Prisma client code from your schema.prisma file. This creates the client code that your application imports.
3. **npm run build** - Compiles TypeScript to JavaScript in the dist/ folder
4. **pm2 restart** - Restarts the application with the new code

## Verification
After running these commands, check the logs:
```bash
pm2 logs streamlick-backend --lines 20
```

You should see:
- `Database connected` - Means Prisma client was generated and loaded successfully
- No MODULE_NOT_FOUND errors

## Future Deployments
Always run `npx prisma generate` before building when:
- You update the Prisma schema
- You run `npm install` on a fresh server
- You get MODULE_NOT_FOUND errors related to @prisma/client

## Automated Fix Script
You can also use this one-liner:
```bash
cd /home/streamlick/backend && npm install && npx prisma generate && npm run build && pm2 restart streamlick-backend && pm2 logs streamlick-backend --lines 20
```
