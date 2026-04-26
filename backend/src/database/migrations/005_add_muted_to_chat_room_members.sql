-- Migration 005: Add muted flag to chat_room_members
-- Requirement 13.12: Allow users to mute chat channels

ALTER TABLE chat_room_members
  ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_chat_room_members_muted
  ON chat_room_members (user_id, muted)
  WHERE muted = TRUE;
