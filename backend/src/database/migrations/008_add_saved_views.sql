-- Migration 008: Add saved_views table for custom filter combinations
-- Requirements: 24.8

CREATE TABLE IF NOT EXISTS saved_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  filters     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saved_views_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_views_user_id ON saved_views (user_id);
