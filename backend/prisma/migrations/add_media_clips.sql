-- Add MediaClip table for user-uploaded clips and sounds

CREATE TABLE "MediaClip" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL, -- 'video', 'audio', 'image'
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "duration" INTEGER, -- duration in milliseconds (for video/audio)
  "fileSize" INTEGER NOT NULL, -- in bytes
  "mimeType" TEXT NOT NULL,
  "hotkey" TEXT, -- optional hotkey for quick trigger (e.g., "F1", "F2")
  "volume" INTEGER DEFAULT 100, -- 0-100, for audio/video clips
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "MediaClip_userId_idx" ON "MediaClip"("userId");
CREATE INDEX "MediaClip_type_idx" ON "MediaClip"("type");
CREATE INDEX "MediaClip_hotkey_idx" ON "MediaClip"("hotkey");
