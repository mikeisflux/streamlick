-- Add DefaultAsset table for managing default platform assets

CREATE TABLE IF NOT EXISTS "DefaultAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL, -- 'backgrounds', 'sounds', 'images', 'overlays'
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL, -- Category within the type (e.g., 'Office', 'Nature' for backgrounds)
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "isDefault" BOOLEAN DEFAULT true, -- Indicates this is a platform default
  "isActive" BOOLEAN DEFAULT true, -- Can be toggled on/off by admins
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "DefaultAsset_type_idx" ON "DefaultAsset"("type");
CREATE INDEX IF NOT EXISTS "DefaultAsset_type_isActive_idx" ON "DefaultAsset"("type", "isActive");
CREATE INDEX IF NOT EXISTS "DefaultAsset_category_idx" ON "DefaultAsset"("category");

-- Add role column to User table if it doesn't exist
-- This allows admin users to manage default assets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='User' AND column_name='role') THEN
    ALTER TABLE "User" ADD COLUMN "role" TEXT DEFAULT 'user';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
