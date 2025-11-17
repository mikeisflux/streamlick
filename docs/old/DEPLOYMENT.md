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
- Add email verification columns (email_verified, email_verification_token, email_verification_expiry)
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
- ✅ New endpoints: `/auth/login`, `/auth/register`, `/auth/verify-email`, `/auth/resend-verification`
- ✅ Email verification system with 24-hour token expiration
- ✅ Email validation and password strength requirements
- ✅ Password column added to users table
- ✅ Email verification columns added (verified status, tokens, expiry)

### Frontend
- ✅ Login page now has email + password fields
- ✅ Auto-redirect: admins → `/admin`, users → `/dashboard`
- ✅ Updated authService with login() and register() methods
- ✅ New VerifyEmail page for email verification flow
- ✅ Email verification route: `/auth/verify-email`

### Database Schema
```sql
-- Added to users table:
password TEXT                       -- Bcrypt hashed password
email_verified BOOLEAN              -- Email verification status (default: false)
email_verification_token TEXT       -- Verification token
email_verification_expiry TIMESTAMP -- Token expiration time
```

### Studio UI (Major Updates)
- ✅ All 7 panel components created and integrated
  - StylePanel - Brand colors, themes, camera frames
  - NotesPanel - Rich text editor + teleprompter mode
  - MediaAssetsPanel - Brand assets, music, images, videos
  - PrivateChatPanel - Host/guest real-time messaging
  - CommentsPanel - Multi-platform comment aggregation
  - ClipManager - Clip recording, management, downloads (modal)
  - ProducerMode - Full production control dashboard (modal)
- ✅ Right sidebar with 8 tabs: Comments, Banners, Media, Style, Notes, People, Chat, Recording
- ✅ ClipManager and ProducerMode modals connected to control bar buttons
- ✅ CSS Grid layout (280px | 1fr | 320px columns)
- ✅ Proper responsive design and color scheme

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

### Issue: Email verification emails not sending
The system uses SendGrid for email delivery. In development mode (no SENDGRID_API_KEY), verification links are logged to the console instead.

```bash
# Check backend logs for verification links
pm2 logs streamlick-backend

# Or if running manually:
# Look for "📧 Email Verification Link:" in console output
```

To enable email sending in production:
```bash
# Set environment variable
export SENDGRID_API_KEY="your-sendgrid-api-key"
export FROM_EMAIL="noreply@yourdomain.com"
export FRONTEND_URL="https://yourdomain.com"
```

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
