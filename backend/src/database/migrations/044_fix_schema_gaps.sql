-- Migration 044: Fix schema gaps found in audit
-- 1. placement_tier column on marketer_properties (used by trainer placement-tier endpoint)
-- 2. property_id column on payments (links STK push to a marketer property)
-- 3. trainer_id column on users (links agents to their trainer)

-- 1. placement_tier — Trainer can modify this independently of package
ALTER TABLE marketer_properties
  ADD COLUMN IF NOT EXISTS placement_tier VARCHAR(20);

-- Backfill from existing package value
UPDATE marketer_properties SET placement_tier = package WHERE placement_tier IS NULL;

-- 2. property_id on payments — so STK push can be linked back to marketer_properties
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES marketer_properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_property_id ON payments(property_id);

-- 3. trainer_id on users — links an agent to their assigned trainer
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_trainer_id ON users(trainer_id);

-- 4. name alias view — many queries use u.name but column is full_name
-- Add a generated column so both work
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name VARCHAR(255) GENERATED ALWAYS AS (full_name) STORED;
