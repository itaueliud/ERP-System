-- Migration 040: Add EXECUTED status and executed_by/executed_at to budget_requests
ALTER TABLE budget_requests
  ADD COLUMN IF NOT EXISTS executed_by  UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS executed_at  TIMESTAMP;
