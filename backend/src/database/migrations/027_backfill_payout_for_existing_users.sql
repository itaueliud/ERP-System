-- Migration 027: Backfill payout details for existing seeded users
-- All payable roles that were created before migration 026 have NULL payout fields.
-- We set a placeholder MPESA entry using their registered phone number so the
-- system is consistent. Admins must update these to real values via the UI.

UPDATE users
SET
  payout_method  = 'MPESA',
  payout_phone   = phone,           -- use their registered phone as initial placeholder
  payout_updated_at = NOW()
WHERE
  payout_method IS NULL
  AND role_id IN (
    SELECT id FROM roles
    WHERE name IN (
      'CFO', 'COO', 'CTO', 'EA',
      'HEAD_OF_TRAINERS', 'TRAINER', 'AGENT',
      'DEVELOPER', 'OPERATIONS_USER', 'TECH_STAFF', 'CFO_ASSISTANT'
    )
  );
