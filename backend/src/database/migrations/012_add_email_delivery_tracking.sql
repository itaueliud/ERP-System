-- Migration 012: Add email_delivery_records table for delivery tracking
-- Requirements: 38.10, 28.6-28.7

CREATE TYPE email_delivery_status AS ENUM (
  'PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED'
);

CREATE TABLE IF NOT EXISTS email_delivery_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_address          VARCHAR(320) NOT NULL,
  template_name       VARCHAR(100) NOT NULL,
  language            VARCHAR(10) NOT NULL DEFAULT 'en',
  subject             TEXT NOT NULL,
  status              email_delivery_status NOT NULL DEFAULT 'PENDING',
  sendgrid_message_id VARCHAR(255),
  user_id             UUID,
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  opened_at           TIMESTAMPTZ,
  clicked_at          TIMESTAMPTZ,
  bounced_at          TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_user_id        ON email_delivery_records (user_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_template_name  ON email_delivery_records (template_name);
CREATE INDEX IF NOT EXISTS idx_email_delivery_status         ON email_delivery_records (status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_sendgrid_id    ON email_delivery_records (sendgrid_message_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_sent_at        ON email_delivery_records (sent_at DESC);
