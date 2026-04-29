-- Add payout fields to invitation_tokens so admins can pre-set payout details
-- when inviting members. These are applied automatically when the user registers.

ALTER TABLE invitation_tokens
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(10),
  ADD COLUMN IF NOT EXISTS payout_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payout_bank_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payout_bank_account VARCHAR(100);
