-- Migration 022: Add approval tracking fields to tech_funding_requests
ALTER TABLE tech_funding_requests
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
