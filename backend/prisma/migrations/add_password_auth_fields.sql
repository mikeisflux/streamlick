-- Add password authentication fields to users table
-- This migration adds support for password-based authentication

-- Add password field (will need to be populated for existing users)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" VARCHAR(255);

-- Add email verification fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_expiry" TIMESTAMP;

-- Add index on email_verification_token for faster lookups
CREATE INDEX IF NOT EXISTS "users_email_verification_token_idx" ON "users"("email_verification_token");

-- Note: Existing users will need to have their passwords set
-- You can use the setup-admin.sql script to set passwords for admin users
