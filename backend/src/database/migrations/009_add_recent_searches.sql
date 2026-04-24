-- Migration 009: Add recent_searches table for per-user search history
-- Requirements: 24.7

CREATE TABLE IF NOT EXISTS recent_searches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  query      TEXT NOT NULL,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recent_searches_user_id ON recent_searches (user_id);
CREATE INDEX IF NOT EXISTS idx_recent_searches_user_searched ON recent_searches (user_id, searched_at DESC);
