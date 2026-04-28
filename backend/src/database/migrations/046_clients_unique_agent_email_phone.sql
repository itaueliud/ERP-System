-- Migration 046: Prevent duplicate client registrations
-- Adds a unique constraint so the same agent cannot register
-- the same email + phone combination more than once.

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_agent_email_phone
  ON clients (agent_id, lower(email::text), phone);
