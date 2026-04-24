-- Migration 014: Add exchange_rates table for currency support
-- Requirements: 41.1-41.4

CREATE TABLE IF NOT EXISTS exchange_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(10) NOT NULL,
  to_currency   VARCHAR(10) NOT NULL,
  rate          NUMERIC(20, 8) NOT NULL,
  updated_by    VARCHAR(255) NOT NULL DEFAULT 'system',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exchange_rates_pair UNIQUE (from_currency, to_currency)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_from ON exchange_rates (from_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_to   ON exchange_rates (to_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_updated_at ON exchange_rates (updated_at DESC);
