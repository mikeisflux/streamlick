-- AddColumn compositeStreamId to Broadcast table
-- Tracks the Ant Media Server stream ID for the server compositor output
-- This is set when the compositor connects and starts publishing the composite stream
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "compositeStreamId" TEXT;
