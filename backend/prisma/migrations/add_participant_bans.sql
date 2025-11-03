-- Add ParticipantBan table for managing banned participants

CREATE TABLE IF NOT EXISTS "ParticipantBan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "broadcastId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "bannedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  "bannedBy" TEXT,
  FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "ParticipantBan_broadcastId_idx" ON "ParticipantBan"("broadcastId");
CREATE INDEX IF NOT EXISTS "ParticipantBan_participantId_idx" ON "ParticipantBan"("participantId");
CREATE UNIQUE INDEX IF NOT EXISTS "ParticipantBan_broadcastId_participantId_idx" ON "ParticipantBan"("broadcastId", "participantId");
