-- Migration 026: Add payout details to users
-- Users who receive funds must provide a payout method at registration.
-- Only CEO and CoS are excluded — all other roles (including CFO, COO, CTO, EA,
-- HEAD_OF_TRAINERS, TRAINER, AGENT, DEVELOPER, OPERATIONS_USER, TECH_STAFF,
-- CFO_ASSISTANT) are paid through the system.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payout_method      VARCHAR(20),   -- 'MPESA' | 'BANK'
  ADD COLUMN IF NOT EXISTS payout_phone       VARCHAR(50),   -- M-Pesa phone number
  ADD COLUMN IF NOT EXISTS payout_bank_name   VARCHAR(100),  -- Bank name
  ADD COLUMN IF NOT EXISTS payout_bank_account VARCHAR(100), -- Bank account number
  ADD COLUMN IF NOT EXISTS payout_updated_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payout_updated_by  UUID REFERENCES users(id);

-- Constraint: payout_method must be valid when set
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT valid_payout_method
    CHECK (payout_method IS NULL OR payout_method IN ('MPESA', 'BANK'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN users.payout_method      IS 'MPESA or BANK — required for payable roles';
COMMENT ON COLUMN users.payout_phone       IS 'M-Pesa phone number (required when payout_method = MPESA)';
COMMENT ON COLUMN users.payout_bank_name   IS 'Bank name (required when payout_method = BANK)';
COMMENT ON COLUMN users.payout_bank_account IS 'Bank account number (required when payout_method = BANK)';
COMMENT ON COLUMN users.payout_updated_by  IS 'Who last changed the payout details (higher-up only)';
