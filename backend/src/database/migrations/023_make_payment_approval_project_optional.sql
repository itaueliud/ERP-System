-- Migration 023: Make project_id optional in payment_approvals
-- Payment requests for operational expenses don't always have a linked project
ALTER TABLE payment_approvals
  ALTER COLUMN project_id DROP NOT NULL;
