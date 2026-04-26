-- Migration 020: Allow contracts without a project (direct/manual contracts)
-- The original schema required project_id NOT NULL, but direct contracts
-- (Developer/Team, PlotConnect, manual entry) don't always have a project.

-- Drop the NOT NULL constraint and the unique constraint that breaks on multiple NULLs
ALTER TABLE contracts
  ALTER COLUMN project_id DROP NOT NULL;

-- Drop old unique constraint (NULL != NULL in Postgres so it's fine, but be explicit)
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_project_id_version_key;

-- Add contract_type column for tracking the type of contract
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contract_type VARCHAR(30) DEFAULT 'CLIENT_SYSTEM';

-- Add developer_team_id for linking to a developer team
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS developer_team_id UUID REFERENCES developer_teams(id) ON DELETE SET NULL;
