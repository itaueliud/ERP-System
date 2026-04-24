-- Migration 010: Add import_jobs table for asynchronous bulk import processing
-- Requirements: 25.1-25.7

CREATE TABLE IF NOT EXISTS import_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       VARCHAR(20) NOT NULL CHECK (entity_type IN ('users', 'clients', 'properties')),
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  total_records     INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  success_count     INTEGER NOT NULL DEFAULT 0,
  failed_count      INTEGER NOT NULL DEFAULT 0,
  errors            JSONB NOT NULL DEFAULT '[]',
  requested_by      UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_requested_by ON import_jobs (requested_by);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status       ON import_jobs (status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_entity_type  ON import_jobs (entity_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at   ON import_jobs (created_at DESC);
