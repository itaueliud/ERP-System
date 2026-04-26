-- Migration 007: Add export_jobs table for asynchronous export processing
-- Requirements: 40.6-40.11

CREATE TABLE IF NOT EXISTS export_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  report_type   VARCHAR(100) NOT NULL,
  format        VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'xlsx', 'csv')),
  filters       JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  file_url      TEXT,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_user_id    ON export_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status     ON export_jobs (status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON export_jobs (expires_at);
