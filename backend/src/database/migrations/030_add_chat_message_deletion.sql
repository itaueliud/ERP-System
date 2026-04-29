-- Migration 030: Add soft-delete and read-receipt support to chat_messages
-- is_deleted_for_everyone: message deleted for all parties ("Delete for everyone")
-- deleted_for: JSON array of userIds who deleted it only for themselves ("Delete for me")
-- read_by: JSON array of userIds who have read this message (for double-tick)

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS is_deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_for JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS read_by JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted
  ON chat_messages (room_id, created_at DESC)
  WHERE is_deleted_for_everyone = FALSE;
