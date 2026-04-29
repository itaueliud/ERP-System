-- Migration 041: Add payment_plan column to clients table
--
-- The webhook handler needs to know which plan the client signed up for
-- to decide whether to LEAD_ACTIVATE (FULL) or LEAD_QUALIFY (50_50/MILESTONE).
-- Values match what the agents portal sends: FULL | 50_50 | MILESTONE

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS payment_plan VARCHAR(20);

-- Backfill existing clients: assume FULL for any already LEAD_ACTIVATED,
-- 50_50 for LEAD_QUALIFIED, leave NULL for others (no payment yet)
UPDATE clients SET payment_plan = 'FULL'  WHERE status = 'LEAD_ACTIVATED' AND payment_plan IS NULL;
UPDATE clients SET payment_plan = '50_50' WHERE status = 'LEAD_QUALIFIED' AND payment_plan IS NULL;
