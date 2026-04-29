-- Migration: Add missing fields and tables identified in frontend-backend comparison
-- Date: 2026-04-27
-- Fixes: incidents, deployments, risks tables + client fields

-- ============================================================================
-- Add missing fields to clients table
-- ============================================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mpesa_number VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS commitment_amount DECIMAL(15, 2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS product VARCHAR(255);

-- ============================================================================
-- Create incidents table (Operations Portal)
-- ============================================================================

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    reported_by UUID NOT NULL REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_incident_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT valid_incident_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_reported_by ON incidents(reported_by);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

-- ============================================================================
-- Create deployments table (Tech Portal)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    version VARCHAR(100) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    deployed_by UUID NOT NULL REFERENCES users(id),
    deployment_notes TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_deployment_environment CHECK (environment IN ('DEVELOPMENT', 'STAGING', 'PRODUCTION')),
    CONSTRAINT valid_deployment_status CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'ROLLED_BACK'))
);

CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_deployed_by ON deployments(deployed_by);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_environment ON deployments(environment);

-- ============================================================================
-- Create risks table (Operations/Project Management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    probability VARCHAR(20) NOT NULL,
    impact VARCHAR(20) NOT NULL,
    mitigation_plan TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'IDENTIFIED',
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_risk_probability CHECK (probability IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT valid_risk_impact CHECK (impact IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT valid_risk_status CHECK (status IN ('IDENTIFIED', 'MITIGATING', 'MITIGATED', 'ACCEPTED'))
);

CREATE INDEX IF NOT EXISTS idx_risks_project_id ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_owner_id ON risks(owner_id);
CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status);
