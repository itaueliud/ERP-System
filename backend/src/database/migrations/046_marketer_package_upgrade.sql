-- Migration 046: Add pending_package_upgrade to marketer_properties
-- Stores the target package during an upgrade STK push so the poller
-- can apply it once payment is confirmed.

ALTER TABLE marketer_properties
  ADD COLUMN IF NOT EXISTS pending_package_upgrade VARCHAR(20);
