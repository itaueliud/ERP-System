-- Migration: 013_add_system_config
-- Creates tables for centralized configuration management with history tracking

CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (environment, key)
);

CREATE INDEX IF NOT EXISTS idx_system_config_environment ON system_config (environment);
CREATE INDEX IF NOT EXISTS idx_system_config_env_key ON system_config (environment, key);

CREATE TABLE IF NOT EXISTS config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  key VARCHAR(255) NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_history_environment ON config_history (environment);
CREATE INDEX IF NOT EXISTS idx_config_history_env_key ON config_history (environment, key);
CREATE INDEX IF NOT EXISTS idx_config_history_version ON config_history (environment, version);
