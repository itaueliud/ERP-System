-- Migration: 016_add_webhook_delivery_logs
-- Creates the webhook_delivery_logs table for tracking delivery attempts
-- Requirements: 45.7-45.10

CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status_code INTEGER,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook_id ON webhook_delivery_logs (webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_created_at ON webhook_delivery_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_success ON webhook_delivery_logs (webhook_id, success);
