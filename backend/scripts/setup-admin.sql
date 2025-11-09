-- Setup admin user with password authentication
-- Run with: psql $DATABASE_URL -f setup-admin.sql

-- Step 1: Add password column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password TEXT;

-- Step 2: Delete all existing users (and cascading data)
DELETE FROM users;

-- Step 3: Create admin user
-- Password: Good2Go! (hashed with bcrypt, 10 rounds)
INSERT INTO users (id, email, password, name, plan_type, role, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@streamlick.local',
  '$2a$10$Ve316yHFV92Xov6E9LmVXOp6BcKErCu28bJV5YW0pBbN2orkpDU3e',
  'Administrator',
  'business',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  plan_type = EXCLUDED.plan_type;

-- Verify
SELECT id, email, name, role, plan_type, created_at
FROM users
WHERE email = 'admin@streamlick.local';

\echo '✅ Admin user created successfully!'
\echo 'Email: admin@streamlick.local'
\echo 'Password: Good2Go!'
