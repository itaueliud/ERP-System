-- Migration 011: Add email_templates and email_template_versions tables
-- Requirements: 38.1-38.9

CREATE TABLE IF NOT EXISTS email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  language     VARCHAR(10) NOT NULL DEFAULT 'en',
  subject      TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT NOT NULL,
  variables    JSONB NOT NULL DEFAULT '[]',
  version      INTEGER NOT NULL DEFAULT 1,
  created_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, language)
);

CREATE TABLE IF NOT EXISTS email_template_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,
  subject        TEXT NOT NULL,
  html_content   TEXT NOT NULL,
  text_content   TEXT NOT NULL,
  created_by     UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_templates_name     ON email_templates (name);
CREATE INDEX IF NOT EXISTS idx_email_templates_language ON email_templates (language);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_template_id ON email_template_versions (template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_version     ON email_template_versions (template_id, version DESC);
