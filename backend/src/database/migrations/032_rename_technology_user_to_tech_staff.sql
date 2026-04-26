-- Migration 032: Rename role TECHNOLOGY_USER to TECH_STAFF
-- doc §6 Portal 5: CTO departments — Infrastructure/Security, Software Engineering, Engineering Ops
-- roles table uses name column; users/invitations use role_id FK (no string to update)

-- Drop constraint, rename, re-add (idempotent — UPDATE does nothing if already renamed)
ALTER TABLE roles DROP CONSTRAINT IF EXISTS valid_role_name;

UPDATE roles SET name = 'TECH_STAFF' WHERE name = 'TECHNOLOGY_USER';

ALTER TABLE roles ADD CONSTRAINT valid_role_name CHECK (name IN (
  'CEO', 'CoS', 'CFO', 'COO', 'CTO', 'EA',
  'HEAD_OF_TRAINERS', 'TRAINER', 'AGENT',
  'OPERATIONS_USER', 'TECH_STAFF', 'DEVELOPER',
  'CFO_ASSISTANT'
));
