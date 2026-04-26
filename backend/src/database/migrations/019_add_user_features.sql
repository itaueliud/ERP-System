-- Migration 019: User feature columns + new tables
-- Supports: email verification, suspension, activity log,
--           signature requests, contract templates

-- ── Users: email change, suspension, is_active ───────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active              BOOLEAN   NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS suspended_at           TIMESTAMP,
  ADD COLUMN IF NOT EXISTS suspension_reason      TEXT,
  ADD COLUMN IF NOT EXISTS pending_email          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_change_token     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_change_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_change_token ON users(email_change_token);

-- ── User activity log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_activity_log (
  id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     VARCHAR(100) NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id   ON user_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_action    ON user_activity_log(action, created_at DESC);

-- ── Communications: attachment_ids column ────────────────────────────────────
ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS attachment_ids JSONB;

-- ── Signature requests ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signature_requests (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID         NOT NULL REFERENCES contracts(id),
  signer_email   VARCHAR(255) NOT NULL,
  signer_name    VARCHAR(255) NOT NULL,
  token          VARCHAR(255) UNIQUE NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  signed_at      TIMESTAMP,
  declined_at    TIMESTAMP,
  decline_reason TEXT,
  ip_address     TEXT,
  user_agent     TEXT,
  signature_hash VARCHAR(255),
  expires_at     TIMESTAMP    NOT NULL,
  requested_by   UUID         NOT NULL REFERENCES users(id),
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_sig_status CHECK (status IN ('PENDING','SIGNED','DECLINED','EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_sig_requests_contract_id ON signature_requests(contract_id);
CREATE INDEX IF NOT EXISTS idx_sig_requests_token       ON signature_requests(token);
CREATE INDEX IF NOT EXISTS idx_sig_requests_status      ON signature_requests(status);

-- ── Contracts: signed_at / signed_by_email columns ───────────────────────────
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS signed_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS signed_by_email VARCHAR(255);

-- ── Contract templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_templates (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  content     TEXT         NOT NULL,
  variables   JSONB        NOT NULL DEFAULT '[]',
  is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  UUID         NOT NULL REFERENCES users(id),
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_is_default ON contract_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_contract_templates_is_active  ON contract_templates(is_active);

-- ── Projects: default currency KES ───────────────────────────────────────────
ALTER TABLE projects
  ALTER COLUMN currency SET DEFAULT 'KES';

ALTER TABLE payments
  ALTER COLUMN currency SET DEFAULT 'KES';

ALTER TABLE property_listings
  ALTER COLUMN currency SET DEFAULT 'KES';
