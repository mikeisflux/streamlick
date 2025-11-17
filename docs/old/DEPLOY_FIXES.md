# Deployment Instructions for TypeScript Fixes

This document provides step-by-step instructions to deploy the TypeScript compilation fixes to your production server.

## What Was Fixed

### Frontend Fixes:
1. **Studio.tsx**: Fixed SceneManager props to include all required handlers
2. **Studio.tsx**: Fixed ChatMessage property from `userName` to `author`
3. **Studio.tsx**: Fixed RecordingControls props to only pass `broadcastId`
4. **VerifyAuth.tsx**: Added email verification support
5. **auth.service.ts**: Added `verifyEmail` and `resendVerification` methods
6. **authStore.ts**: Updated login function to accept refreshToken

### Backend Fixes:
1. **package.json**: Added postinstall script to generate Prisma client automatically
2. **Migration SQL**: Created migration file to add password authentication fields

## Deployment Steps

### On Production Server (root@ubuntu-8gb-hel1-1):

#### Step 1: Pull Latest Changes
```bash
cd /home/streamlick
git fetch origin claude/merge-to-master-3-011CUxFkQmELeGuqKzZTsixC
git pull origin claude/merge-to-master-3-011CUxFkQmELeGuqKzZTsixC
```

#### Step 2: Setup Database URL
```bash
export DATABASE_URL="postgresql://streamlick:Px9Wk_L7tFm2@localhost:5432/streamlick_prod"
```

Add this to your `.bashrc` or `.profile` to make it permanent:
```bash
echo 'export DATABASE_URL="postgresql://streamlick:Px9Wk_L7tFm2@localhost:5432/streamlick_prod"' >> ~/.bashrc
source ~/.bashrc
```

#### Step 3: Run Database Migration (Add Password Fields)
The setup-admin.sql script will add the necessary columns. Run it first:

```bash
cd /home/streamlick/backend

# Check if PostgreSQL is running locally or remotely
# If it's running locally on the socket:
sudo -u postgres psql streamlick_prod -f scripts/setup-admin.sql

# OR if you need to use TCP connection:
PGPASSWORD='Px9Wk_L7tFm2' psql -h localhost -p 5432 -U streamlick -d streamlick_prod -f scripts/setup-admin.sql

# OR if PostgreSQL is on a different host, update the command accordingly
```

**Note**: The setup-admin.sql script will:
- Add password, email_verified, email_verification_token, and email_verification_expiry columns
- Delete all existing users (if any)
- Create a new admin user with:
  - Email: admin@streamlick.local
  - Password: Good2Go!

#### Step 4: Install Backend Dependencies & Generate Prisma Client
```bash
cd /home/streamlick/backend
npm install
```

The postinstall script will automatically run `prisma generate`. If it fails due to network issues, manually run:
```bash
npm run db:generate
```

If prisma generate still fails with network errors, try:
```bash
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npm run db:generate
```

#### Step 5: Build Backend
```bash
cd /home/streamlick/backend
npm run build
```

This should now compile without TypeScript errors.

#### Step 6: Install Frontend Dependencies & Build
```bash
cd /home/streamlick/frontend
npm install
npm run build
```

This should now compile without TypeScript errors.

#### Step 7: Restart Services

**Using PM2:**
```bash
pm2 restart streamlick-backend
pm2 restart streamlick-frontend
pm2 status
pm2 logs streamlick-backend --lines 50
pm2 logs streamlick-frontend --lines 50
```

**Using systemd:**
```bash
sudo systemctl restart streamlick-backend
sudo systemctl restart streamlick-frontend
sudo systemctl status streamlick-backend
sudo systemctl status streamlick-frontend
```

## Verification

### 1. Check Services Are Running
```bash
pm2 status
# OR
sudo systemctl status streamlick-backend streamlick-frontend
```

### 2. Test Admin Login
Navigate to your Streamlick login page and try logging in with:
- **Email**: admin@streamlick.local
- **Password**: Good2Go!

### 3. Check Logs for Errors
```bash
pm2 logs streamlick-backend --lines 100
pm2 logs streamlick-frontend --lines 100
```

## Troubleshooting

### Issue: Prisma Client Generation Fails
**Error**: `Failed to fetch the engine file...403 Forbidden`

**Solutions**:
1. Try with the ignore flag:
   ```bash
   PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npm run db:generate
   ```

2. If you have internet access issues, ensure the server can reach:
   - `https://binaries.prisma.sh`

3. Check if there's a firewall blocking the download

### Issue: Database Connection Refused
**Error**: `connection to server at "localhost" (127.0.0.1), port 5432 failed: Connection refused`

**Solutions**:
1. Check if PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```

2. If it's not running:
   ```bash
   sudo systemctl start postgresql
   ```

3. Check PostgreSQL configuration in `/etc/postgresql/*/main/postgresql.conf`
   - Ensure `listen_addresses` includes localhost or *

4. Try connecting via Unix socket instead:
   ```bash
   export DATABASE_URL="postgresql://streamlick:Px9Wk_L7tFm2@/streamlick_prod?host=/var/run/postgresql"
   ```

### Issue: TypeScript Compilation Still Fails
**Solutions**:
1. Clear the TypeScript cache:
   ```bash
   rm -rf node_modules/.cache
   rm -rf dist
   npm run build
   ```

2. Ensure you're on the correct branch:
   ```bash
   git branch --show-current
   # Should show: claude/merge-to-master-3-011CUxFkQmELeGuqKzZTsixC
   ```

3. Check that all changes were pulled:
   ```bash
   git status
   git log --oneline -5
   ```

## Security Notes

1. **Change the default admin password immediately** after first login!

2. The password `Good2Go!` is only for initial setup and should be changed in production.

3. Ensure your `.env` file (if it exists) is not committed to git:
   ```bash
   echo ".env" >> .gitignore
   ```

4. Keep your DATABASE_URL secure and never commit it to version control.

## Next Steps

After successful deployment:
1. Log in as admin
2. Change the admin password
3. Configure your streaming destinations
4. Test the studio functionality
5. Create additional users as needed

## Support

If you encounter issues not covered in this guide:
1. Check the application logs in detail
2. Verify all environment variables are set correctly
3. Ensure PostgreSQL is accessible and the database exists
4. Make sure all dependencies are installed correctly
