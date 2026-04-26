-- Migration 025: Add team_id to projects for CTO team assignment
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES developer_teams(id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);
