-- Add Background table for custom virtual backgrounds

CREATE TABLE IF NOT EXISTS "Background" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "Background_userId_idx" ON "Background"("userId");
CREATE INDEX IF NOT EXISTS "Background_isActive_idx" ON "Background"("isActive");
