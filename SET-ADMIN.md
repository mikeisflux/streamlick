# Set Admin User

## Problem
The admin panel requires a user with `role='admin'`, but all users currently have `role='user'`.

## Quick Setup for divinitycomicsinc@gmail.com

To set `divinitycomicsinc@gmail.com` as admin, run:

```bash
# Using the SQL script
cd backend
psql $DATABASE_URL -f scripts/set-admin.sql

# Or using the TypeScript script
cd backend
npx tsx scripts/set-admin.ts divinitycomicsinc@gmail.com
```

## Solution

### Method 1: Direct Database Access

Connect to your PostgreSQL database and run:

```sql
-- Option A: Set a specific user as admin by email
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';

-- Option B: Set the first user created as admin
UPDATE users SET role = 'admin'
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);

-- Option C: List all users first, then choose one
SELECT id, email, role, created_at FROM users ORDER BY created_at;
-- Then run: UPDATE users SET role = 'admin' WHERE id = 'user-id-here';
```

### Method 2: Using Prisma Studio

```bash
cd backend
npx prisma studio
```

Then:
1. Navigate to the `User` table
2. Find your user
3. Edit the `role` field to `admin`
4. Save

### Method 3: Using Node REPL

```bash
cd backend
node
```

Then paste:
```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Set first user as admin
prisma.user.findFirst().then(user => {
  return prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin' }
  });
}).then(user => {
  console.log(`✅ Set ${user.email} as admin`);
  process.exit(0);
});
```

## Verify Admin Access

After setting a user as admin:

1. **Log out** from the frontend
2. **Clear localStorage**: Open browser console and run: `localStorage.clear()`
3. **Log back in** with the admin user
4. Navigate to `/admin/settings`
5. You should now have access!

## Admin Routes Available

- `/admin/settings` - OAuth & System Configuration
- `/admin/assets` - Default Assets Management
- `/admin/logs` - System Logs
- `/admin/servers` - Media Servers
- `/admin/testing` - Testing Tools
