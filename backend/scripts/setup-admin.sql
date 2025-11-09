-- Setup admin user with password authentication
-- Run with: psql $DATABASE_URL -f setup-admin.sql

-- Step 1: Add password column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password TEXT;

-- Step 2: Add email verification columns if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verification_token TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verification_expiry TIMESTAMP WITH TIME ZONE;

-- Step 3: Delete all existing users (and cascading data)
DELETE FROM users;

-- Step 4: Create admin user
-- Password: Good2Go! (hashed with bcrypt, 10 rounds)
INSERT INTO users (id, email, password, name, plan_type, role, email_verified, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'divinitycomicsinc@gmail.com',
  '$2a$10$Ve316yHFV92Xov6E9LmVXOp6BcKErCu28bJV5YW0pBbN2orkpDU3e',
  'Administrator',
  'business',
  'admin',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  plan_type = EXCLUDED.plan_type,
  email_verified = TRUE;

-- Verify
SELECT id, email, name, role, plan_type, created_at
FROM users
WHERE email = 'divinitycomicsinc@gmail.com';

\echo '✅ Admin user created successfully!'
\echo 'Email: divinitycomicsinc@gmail.com'
\echo 'Password: Good2Go!'
