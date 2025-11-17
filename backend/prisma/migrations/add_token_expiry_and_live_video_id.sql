-- Add tokenExpiresAt field to destinations table
ALTER TABLE destinations ADD COLUMN token_expires_at TIMESTAMP;

-- Add liveVideoId field to broadcast_destinations table
ALTER TABLE broadcast_destinations ADD COLUMN live_video_id TEXT;

-- Create index for token expiration queries (for warning system)
CREATE INDEX idx_destinations_token_expires_at ON destinations(token_expires_at) WHERE token_expires_at IS NOT NULL;
