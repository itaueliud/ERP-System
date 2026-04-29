-- Migration 036: Agent commissions table + training_assignments improvements
-- Commissions are earned per closed deal (client status = CLOSED_WON)

CREATE TABLE IF NOT EXISTS agent_commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES users(id),
  client_id       UUID REFERENCES clients(id),
  client_name     VARCHAR(200),
  amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2),
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','APPROVED','PAID','CANCELLED')),
  paid_at         TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent_id ON agent_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_status   ON agent_commissions(status);

-- Add missing columns to training_assignments
ALTER TABLE training_assignments
  ADD COLUMN IF NOT EXISTS progress    SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS due_date    TIMESTAMP,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT NOW();
