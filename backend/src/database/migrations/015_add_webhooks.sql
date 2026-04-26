-- Migration: 015_add_webhooks
-- Creates the webhooks table for storing registered webhook endpoints
-- Requirements: 45.1-45.6

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_created_by ON webhooks (created_by);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks (active);
