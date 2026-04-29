-- Migration 035: Staff payment runs
-- CFO selects staff members, sets amounts, and executes a payment run.
-- Each run tracks the batch; each item tracks per-member status.

CREATE TABLE IF NOT EXISTS staff_payment_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label         VARCHAR(200) NOT NULL,          -- e.g. "April 2026 Salary"
  payment_type  VARCHAR(30) NOT NULL DEFAULT 'SALARY',
  total_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','PROCESSING','COMPLETED','PARTIAL','FAILED')),
  initiated_by  UUID NOT NULL REFERENCES users(id),
  executed_at   TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_payment_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES staff_payment_runs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  amount          NUMERIC(15,2) NOT NULL,
  payout_method   VARCHAR(10) NOT NULL,
  payout_account  VARCHAR(100) NOT NULL,         -- phone or bank account
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PROCESSING','PAID','FAILED')),
  transaction_id  VARCHAR(200),
  failure_reason  VARCHAR(500),
  paid_at         TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_payment_items_run_id ON staff_payment_items(run_id);
CREATE INDEX IF NOT EXISTS idx_staff_payment_items_user_id ON staff_payment_items(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_payment_items_status ON staff_payment_items(status);
