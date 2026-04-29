-- Add scheduled_at column to notifications table for CEO broadcast scheduling
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;

-- Index for efficient querying of scheduled notifications
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at) WHERE scheduled_at IS NOT NULL;
