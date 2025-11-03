-- Add role column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" VARCHAR(255) DEFAULT 'user';

-- Create system_settings table
CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" VARCHAR(255) PRIMARY KEY,
  "category" VARCHAR(255) NOT NULL,
  "key" VARCHAR(255) NOT NULL,
  "value" TEXT NOT NULL,
  "is_encrypted" BOOLEAN DEFAULT false,
  "description" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW(),
  UNIQUE ("category", "key")
);

-- Create media_clips table
CREATE TABLE IF NOT EXISTS "media_clips" (
  "id" VARCHAR(255) PRIMARY KEY,
  "user_id" VARCHAR(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" VARCHAR(255) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "file_url" VARCHAR(255) NOT NULL,
  "thumbnail_url" VARCHAR(255),
  "file_size_bytes" BIGINT,
  "mime_type" VARCHAR(255),
  "duration_ms" INTEGER,
  "hotkey" VARCHAR(255),
  "volume" INTEGER DEFAULT 100,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Create default_assets table
CREATE TABLE IF NOT EXISTS "default_assets" (
  "id" VARCHAR(255) PRIMARY KEY,
  "type" VARCHAR(255) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "category" VARCHAR(255),
  "url" VARCHAR(255) NOT NULL,
  "thumbnail_url" VARCHAR(255),
  "file_size_bytes" BIGINT,
  "mime_type" VARCHAR(255),
  "is_default" BOOLEAN DEFAULT true,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for default_assets
CREATE INDEX IF NOT EXISTS "default_assets_type_idx" ON "default_assets"("type");
CREATE INDEX IF NOT EXISTS "default_assets_type_active_idx" ON "default_assets"("type", "is_active");
CREATE INDEX IF NOT EXISTS "default_assets_category_idx" ON "default_assets"("category");

-- Create banned_participants table
CREATE TABLE IF NOT EXISTS "banned_participants" (
  "id" VARCHAR(255) PRIMARY KEY,
  "broadcast_id" VARCHAR(255) NOT NULL,
  "user_id" VARCHAR(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "banned_by" VARCHAR(255) NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  UNIQUE ("broadcast_id", "user_id")
);
