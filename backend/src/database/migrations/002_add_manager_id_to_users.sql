-- Migration: Add manager_id to users table for organizational hierarchy
-- Requirement 18: Organizational Hierarchy Management

-- Add manager_id column to users table
ALTER TABLE users ADD COLUMN manager_id UUID REFERENCES users(id);

-- Create index for manager_id lookups
CREATE INDEX idx_users_manager_id ON users(manager_id);

-- Add constraint to prevent self-reporting (user cannot be their own manager)
ALTER TABLE users ADD CONSTRAINT chk_no_self_reporting CHECK (manager_id IS NULL OR manager_id != id);

COMMENT ON COLUMN users.manager_id IS 'References the user who is this user''s direct manager in the organizational hierarchy';
