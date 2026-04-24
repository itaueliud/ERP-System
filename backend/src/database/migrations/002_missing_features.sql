-- Migration 002: Add all missing tables and columns from spec audit
-- Doc: TechSwiftTrix ERP System Documentation (49 pages)
-- Date: 2026-04-20

BEGIN;

-- ============================================================================
-- 1. CLIENTS — add missing fields for full agent capture form (doc §7)
-- ============================================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS location VARCHAR(255);          -- Town / Area
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES users(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_plan VARCHAR(30);       -- FULL_PAYMENT | FIFTY_FIFTY | MILESTONE
ALTER TABLE clients ADD COLUMN IF NOT EXISTS commitment_transaction_id VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS commitment_amount DECIMAL(15,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'; -- array of service keys
ALTER TABLE clients ADD COLUMN IF NOT EXISTS discount_applied BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. SERVICES CATALOGUE (doc §8 — Industry Categories A-G)
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_catalogue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(20) NOT NULL,           -- A through G
    category_name VARCHAR(100) NOT NULL,
    service_key VARCHAR(100) NOT NULL UNIQUE,
    service_name VARCHAR(255) NOT NULL,
    base_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_category CHECK (category IN ('A','B','C','D','E','F','G'))
);

-- Seed all services from spec §8
INSERT INTO service_catalogue (category, category_name, service_key, service_name) VALUES
  ('A','Schools',       'SCHOOL_PORTAL_LMS',          'School Portal / LMS'),
  ('A','Schools',       'SCHOOL_FEE_MANAGEMENT',       'Fee Management System'),
  ('A','Schools',       'SCHOOL_WEBSITE',              'Custom Website (Public Advertisement)'),
  ('B','Churches',      'CHURCH_MEMBER_MANAGEMENT',    'Member Management System'),
  ('B','Churches',      'CHURCH_ONLINE_GIVING',        'Online Giving System'),
  ('B','Churches',      'CHURCH_WEBSITE',              'Custom Website (Public Advertisement)'),
  ('C','Hotels & Lodges','HOTEL_BOOKING',              'Booking System'),
  ('C','Hotels & Lodges','HOTEL_ROOM_MANAGEMENT',      'Room Management System'),
  ('C','Hotels & Lodges','HOTEL_BILLING',              'Hotel Billing System'),
  ('C','Hotels & Lodges','HOTEL_WEBSITE',              'Custom Website (Public Advertisement)'),
  ('D','Hospitals & Clinics','HOSPITAL_PATIENT_MGMT', 'Patient Management System'),
  ('D','Hospitals & Clinics','HOSPITAL_APPOINTMENTS',  'Appointment Booking System'),
  ('D','Hospitals & Clinics','HOSPITAL_PHARMACY',      'Pharmacy Stock System'),
  ('D','Hospitals & Clinics','HOSPITAL_WEBSITE',       'Custom Website (Public Advertisement)'),
  ('E','Companies & Organizations','COMPANY_HR_PAYROLL','HR & Payroll System'),
  ('E','Companies & Organizations','COMPANY_CRM',       'CRM System'),
  ('E','Companies & Organizations','COMPANY_INVENTORY', 'Inventory Management System'),
  ('E','Companies & Organizations','COMPANY_WEBSITE',   'Custom Website (Public Advertisement)'),
  ('F','Real Estate & Property','REALESTATE_RENT_MGMT','Rent Management System'),
  ('F','Real Estate & Property','REALESTATE_LISTING',  'Property Listing Platform'),
  ('F','Real Estate & Property','REALESTATE_TENANT',   'Tenant Management System'),
  ('F','Real Estate & Property','REALESTATE_WEBSITE',  'Custom Website (Public Advertisement)'),
  ('G','Shops & Retail','SHOP_POS',                    'POS System'),
  ('G','Shops & Retail','SHOP_ECOMMERCE',              'E-Commerce Website'),
  ('G','Shops & Retail','SHOP_INVENTORY',              'Inventory System'),
  ('G','Shops & Retail','SHOP_WEBSITE',                'Custom Website (Public Advertisement)')
ON CONFLICT (service_key) DO NOTHING;

-- ============================================================================
-- 3. COMMITMENT PAYMENT AMOUNTS (doc §7 — editable by EA/CFO/CoS/CEO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commitment_amounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_plan VARCHAR(30) NOT NULL UNIQUE,  -- FULL_PAYMENT | FIFTY_FIFTY | MILESTONE
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_plan CHECK (payment_plan IN ('FULL_PAYMENT','FIFTY_FIFTY','MILESTONE'))
);

INSERT INTO commitment_amounts (payment_plan, amount) VALUES
  ('FULL_PAYMENT', 500),
  ('FIFTY_FIFTY',  750),
  ('MILESTONE',   1000)
ON CONFLICT (payment_plan) DO NOTHING;

-- ============================================================================
-- 4. AMOUNT CHANGE REQUESTS — extend for service catalogue & commitment amounts
-- ============================================================================
ALTER TABLE service_amount_changes ADD COLUMN IF NOT EXISTS change_type VARCHAR(30) DEFAULT 'PROJECT';
-- change_type: PROJECT | SERVICE_CATALOGUE | COMMITMENT_AMOUNT | PLOTCONNECT_PLACEMENT

CREATE TABLE IF NOT EXISTS pricing_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_type VARCHAR(30) NOT NULL,          -- SERVICE_CATALOGUE | COMMITMENT_AMOUNT | PLOTCONNECT_PLACEMENT
    target_id UUID NOT NULL,                   -- service_catalogue.id or commitment_amounts.id or placement tier ref
    target_key VARCHAR(100),                   -- human-readable key
    old_amount DECIMAL(15,2) NOT NULL,
    new_amount DECIMAL(15,2) NOT NULL,
    justification TEXT,
    proposed_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMP,
    rejected_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_change_type CHECK (change_type IN ('SERVICE_CATALOGUE','COMMITMENT_AMOUNT','PLOTCONNECT_PLACEMENT')),
    CONSTRAINT valid_status CHECK (status IN ('PENDING','CONFIRMED','REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_pricing_changes_status ON pricing_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_pricing_changes_proposed_by ON pricing_change_requests(proposed_by);

-- ============================================================================
-- 5. DEVELOPER TEAMS (doc §17 — 10+ teams, 3 devs each, one Team Leader)
-- ============================================================================
CREATE TABLE IF NOT EXISTS developer_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(id),
    team_leader_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_developer_teams_dept ON developer_teams(department_id);

-- Link users to teams (already have team_id on users, add FK if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_users_team_id'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_team_id
      FOREIGN KEY (team_id) REFERENCES developer_teams(id);
  END IF;
END $$;

-- ============================================================================
-- 6. CONTRACT SIGNATURES — track download/upload by Team Leader (doc §12)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contract_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id),
    team_leader_id UUID NOT NULL REFERENCES users(id),
    downloaded_at TIMESTAMP,
    signed_pdf_url TEXT,
    uploaded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_leader ON contract_signatures(team_leader_id);

-- ============================================================================
-- 7. DAILY REPORT REMINDERS — track submission status (doc §20)
-- ============================================================================
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS report_type VARCHAR(30) DEFAULT 'DAILY';
-- report_type: DAILY | MORNING_BRIEFING | EVENING_CAMPAIGN

-- ============================================================================
-- 8. PORTAL ACCESS LOG — track which portal each user logs in from (doc §3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    portal VARCHAR(30) NOT NULL,   -- ALPHA | DELTA | SIGMA | NEXUS | VERTEX | PULSE
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_portal CHECK (portal IN ('ALPHA','DELTA','SIGMA','NEXUS','VERTEX','PULSE'))
);

CREATE INDEX IF NOT EXISTS idx_portal_access_user ON portal_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_access_portal ON portal_access_log(portal);

-- ============================================================================
-- 9. SYSTEM CONFIG — store CEO-managed system settings (doc §6 Admin Panel)
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_config (key, value, description) VALUES
  ('portal_alpha_enabled',  'true', 'CEO portal enabled'),
  ('portal_delta_enabled',  'true', 'CoS/CFO/EA portal enabled'),
  ('portal_sigma_enabled',  'true', 'COO/CTO portal enabled'),
  ('portal_nexus_enabled',  'true', 'COO departments portal enabled'),
  ('portal_vertex_enabled', 'true', 'CTO departments portal enabled'),
  ('portal_pulse_enabled',  'true', 'Agent portal enabled'),
  ('discount_multi_service_pct', '10', '10% discount when client selects >1 service from same category')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 10. GITHUB INTEGRATION — per-user linked repos (doc §15)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_github_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    github_username VARCHAR(255) NOT NULL,
    github_access_token_enc TEXT,   -- encrypted
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_github_links_user ON user_github_links(user_id);

-- ============================================================================
-- 11. PROJECTS — add assigned_to for Account Executive assignment (doc §4)
-- ============================================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_department_id ON projects(department_id);

COMMIT;
