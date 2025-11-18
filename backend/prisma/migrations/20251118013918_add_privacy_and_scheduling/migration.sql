-- AlterTable
ALTER TABLE "broadcast_destinations"
ADD COLUMN "privacy_status" VARCHAR(50) DEFAULT 'public',
ADD COLUMN "scheduled_start_time" TIMESTAMP;
