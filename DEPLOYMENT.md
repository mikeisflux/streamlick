# Streamlick Deployment Guide

## Authentication System Updated

🎉 The authentication system has been converted from magic links to traditional username/password authentication!

## Pull Latest Changes to Your Server

```bash
# Navigate to your streamlick directory
cd /path/to/streamlick

# Pull latest changes from the branch
git fetch origin
git checkout claude/merge-to-master-3-011CUxFkQmELeGuqKzZTsixC
git pull origin claude/merge-to-master-3-011CUxFkQmELeGuqKzZTsixC
```

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Setup Database with Admin User

Run the SQL setup script to:
- Add the password column to users table
- Delete all existing users
- Create the default admin account

```bash
# Using psql directly
psql $DATABASE_URL -f scripts/setup-admin.sql

# OR if you have the connection details separately:
psql -h your-host -U your-user -d your-database -f scripts/setup-admin.sql
```

### 3. Restart Backend Server

```bash
# If using PM2:
pm2 restart streamlick-backend

# If using systemd:
sudo systemctl restart streamlick-backend

# If running manually:
npm run dev
```

## Frontend Setup

```bash
cd frontend
npm install
npm run build

# If using PM2:
pm2 restart streamlick-frontend

# If using systemd:
sudo systemctl restart streamlick-frontend
```

## Default Admin Credentials

After setup, you can log in with:

- **Email:** `admin@streamlick.local`
- **Password:** `Good2Go!`

**🔒 IMPORTANT:** Change this password immediately after first login!

## What Changed

### Backend
- ✅ Removed magic link authentication
- ✅ Added password-based authentication with bcrypt
- ✅ New endpoints: `/auth/login` and `/auth/register`
- ✅ Password column added to users table

### Frontend
- ✅ Login page now has email + password fields
- ✅ Auto-redirect: admins → `/admin`, users → `/dashboard`
- ✅ Updated authService with login() and register() methods

### Database Schema
```sql
-- Added to users table:
password TEXT  -- Bcrypt hashed password
```

## Troubleshooting

### Issue: Database connection error
```bash
# Check your DATABASE_URL environment variable
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

### Issue: Can't run SQL script
```bash
# Make sure you're in the backend directory
cd backend

# Check if file exists
ls -la scripts/setup-admin.sql

# Run with explicit path
psql $DATABASE_URL -f $(pwd)/scripts/setup-admin.sql
```

### Issue: Login fails with "Invalid password"
The admin user might not have been created. Check:

```sql
-- Connect to database
psql $DATABASE_URL

-- Check if admin user exists
SELECT id, email, name, role FROM users WHERE email = 'admin@streamlick.local';

-- If not found, run the setup script again
\i scripts/setup-admin.sql
```

## Studio UI Updates

The Studio interface has also been completely redesigned with proper CSS Grid layout:

- ✅ Left sidebar (280px) with Scenes panel
- ✅ Main canvas (16:9 aspect ratio, max 1920px)
- ✅ Layout bar (72px) with 9 layout buttons
- ✅ Bottom control bar (80px) with media controls and killer features
- ✅ Right sidebar (320px) with tabbed panels (Chat, People, Recording)
- ✅ Proper color scheme (#1a1a1a, #2d2d2d, #404040)

## Next Steps

1. Pull the changes to your server
2. Run the database setup script
3. Restart backend and frontend services
4. Navigate to your site's `/login` page
5. Log in with the default admin credentials
6. Change your password immediately!

## Need Help?

If you encounter any issues during deployment, check:
1. Backend logs: `pm2 logs streamlick-backend` or `journalctl -u streamlick-backend`
2. Frontend logs: `pm2 logs streamlick-frontend` or `journalctl -u streamlick-frontend`
3. Database connectivity: `psql $DATABASE_URL -c "SELECT NOW();"`
