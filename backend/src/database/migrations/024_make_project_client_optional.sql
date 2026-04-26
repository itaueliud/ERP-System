-- Migration 024: Make client_id optional in projects
-- CEO-generated contracts create projects that aren't tied to an agent-captured client
ALTER TABLE projects
  ALTER COLUMN client_id DROP NOT NULL;
