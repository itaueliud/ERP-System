-- Migration 028: Developer teams, payment schedules, and payment type tracking

-- ── 1. Developer Teams ────────────────────────────────────────────────────────
-- Each team has exactly 3 developers and one shared payout account.

CREATE TABLE IF NOT EXISTS developer_teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  -- Shared payout account for the whole team
  payout_method      VARCHAR(20)  NOT NULL DEFAULT 'MPESA' CHECK (payout_method IN ('MPESA', 'BANK')),
  payout_phone       VARCHAR(50),
  payout_bank_name   VARCHAR(100),
  payout_bank_account VARCHAR(100),
  -- Who approved this team's payout account (EA or CTO)
  payout_approved_by UUID REFERENCES users(id),
  payout_approved_at TIMESTAMP,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns that may be missing if table was created by migration 002
ALTER TABLE developer_teams
  ADD COLUMN IF NOT EXISTS payout_method      VARCHAR(20) DEFAULT 'MPESA',
  ADD COLUMN IF NOT EXISTS payout_phone       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payout_bank_name   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payout_bank_account VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payout_approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS payout_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by         UUID REFERENCES users(id);

-- Also add github_org if referenced elsewhere
ALTER TABLE developer_teams
  ADD COLUMN IF NOT EXISTS github_org VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_developer_teams_created_by ON developer_teams(id);

-- Link users.team_id → developer_teams.id (already exists as UUID column, add FK)
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT fk_users_team_id
    FOREIGN KEY (team_id) REFERENCES developer_teams(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Payment Type ───────────────────────────────────────────────────────────
-- Classify every payment_approval by its type so schedules can be enforced.

ALTER TABLE payment_approvals
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(30) DEFAULT 'GENERAL'
    CHECK (payment_type IN (
      'AGENT_COMMISSION',   -- Agents — every Friday 16:00–22:00
      'STAFF_SUPPORT',      -- All other staff — every Monday 16:00–22:00
      'SALARY',             -- All payable staff — 2nd of each month
      'DEVELOPER_PAYMENT',  -- Developer teams — approved by EA or CTO
      'GENERAL'             -- Ad-hoc / other
    ));

-- ── 3. Payment Schedule Windows ───────────────────────────────────────────────
-- Reference table so the scheduler / UI can query allowed windows.

CREATE TABLE IF NOT EXISTS payment_schedule_windows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type  VARCHAR(30) NOT NULL UNIQUE,
  day_of_week   SMALLINT,          -- 0=Sun … 6=Sat, NULL for date-of-month
  day_of_month  SMALLINT,          -- 1-31, NULL for day-of-week
  window_start  TIME NOT NULL,
  window_end    TIME NOT NULL,
  description   TEXT
);

INSERT INTO payment_schedule_windows
  (payment_type, day_of_week, day_of_month, window_start, window_end, description)
VALUES
  ('AGENT_COMMISSION', 5, NULL, '16:00', '22:00', 'Agent commissions — every Friday 4pm–10pm'),
  ('STAFF_SUPPORT',    1, NULL, '16:00', '22:00', 'Staff support payments — every Monday 4pm–10pm'),
  ('SALARY',           NULL, 2, '00:00', '23:59', 'Salaries — 2nd of every month (all day)')
ON CONFLICT (payment_type) DO NOTHING;

-- ── 4. Developer payment approval tracking ────────────────────────────────────
-- Record which EA or CTO approved a developer team payment.

ALTER TABLE payment_approvals
  ADD COLUMN IF NOT EXISTS dev_team_id UUID REFERENCES developer_teams(id);
