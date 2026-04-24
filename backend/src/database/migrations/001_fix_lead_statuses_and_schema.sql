-- Migration: Fix lead statuses, departments, property schema, and add account limits
-- Doc: TechSwiftTrix ERP System Documentation (49 pages)
-- Date: 2026-04-20

BEGIN;

-- ============================================================================
-- 1. UPDATE LEAD STATUSES (doc §10 Lead Status Lifecycle)
-- ============================================================================

-- Drop old constraint
ALTER TABLE clients DROP CONSTRAINT IF EXISTS valid_status;

-- Update existing data to new status names
UPDATE clients SET status = 'NEW_LEAD'       WHERE status = 'PENDING_COMMITMENT';
UPDATE clients SET status = 'CONVERTED'      WHERE status = 'LEAD';
UPDATE clients SET status = 'LEAD_QUALIFIED' WHERE status = 'QUALIFIED_LEAD';
UPDATE clients SET status = 'CLOSED_WON'     WHERE status = 'PROJECT';

-- Add new constraint with correct status names
ALTER TABLE clients ADD CONSTRAINT valid_status CHECK (status IN (
    'NEW_LEAD',        -- Agent submits client information form
    'CONVERTED',       -- Agent selects product and service
    'LEAD_ACTIVATED',  -- Commitment payment confirmed (Full Payment plan)
    'LEAD_QUALIFIED',  -- Commitment payment confirmed (50/50 or Milestone plan)
    'NEGOTIATION',     -- Trainer in active engagement with client
    'CLOSED_WON'       -- Full deposit payment received → becomes a Project
));

-- Update default value
ALTER TABLE clients ALTER COLUMN status SET DEFAULT 'NEW_LEAD';

-- ============================================================================
-- 2. UPDATE DEPARTMENTS (doc §4: 6 named departments)
-- ============================================================================

-- Drop old constraint
ALTER TABLE departments DROP CONSTRAINT IF EXISTS valid_department_type;

-- Update existing data
UPDATE departments SET type = 'SALES_CLIENT_ACQUISITION' WHERE type = 'SALES' OR name ILIKE '%sales%' OR name ILIKE '%client acquisition%';
UPDATE departments SET type = 'CLIENT_SUCCESS_ACCOUNT_MANAGEMENT' WHERE name ILIKE '%client success%' OR name ILIKE '%account management%';
UPDATE departments SET type = 'MARKETING_BUSINESS_OPERATIONS' WHERE name ILIKE '%marketing%' OR name ILIKE '%business%';
UPDATE departments SET type = 'TECHNOLOGY_INFRASTRUCTURE_SECURITY' WHERE type = 'CTO' AND (name ILIKE '%security%' OR name ILIKE '%infrastructure%' OR name ILIKE '%core%');
UPDATE departments SET type = 'SOFTWARE_ENGINEERING_PRODUCT_DEVELOPMENT' WHERE type = 'CTO' AND (name ILIKE '%software%' OR name ILIKE '%product%' OR name ILIKE '%application%' OR name ILIKE '%feature%');
UPDATE departments SET type = 'ENGINEERING_OPERATIONS_DELIVERY' WHERE type = 'CTO' AND (name ILIKE '%operations%' OR name ILIKE '%delivery%' OR name ILIKE '%developer%');

-- Add new constraint
ALTER TABLE departments ADD CONSTRAINT valid_department_type CHECK (type IN (
    'SALES_CLIENT_ACQUISITION',
    'CLIENT_SUCCESS_ACCOUNT_MANAGEMENT',
    'MARKETING_BUSINESS_OPERATIONS',
    'TECHNOLOGY_INFRASTRUCTURE_SECURITY',
    'SOFTWARE_ENGINEERING_PRODUCT_DEVELOPMENT',
    'ENGINEERING_OPERATIONS_DELIVERY'
));

-- ============================================================================
-- 3. UPDATE USERS TABLE (doc §5 Profile Fields, doc §17 Team Leader, doc §21 2FA)
-- ============================================================================

-- Add new columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id_number VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id_document_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_team_leader BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_mandatory BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_reference_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_joining DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by UUID;

-- Set 2FA mandatory for executive roles (doc §21: 2FA mandatory for CEO, CoS, CFO, EA)
UPDATE users SET two_fa_mandatory = TRUE
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('CEO', 'CoS', 'CFO', 'EA'));

-- ============================================================================
-- 4. REBUILD PROPERTY LISTINGS TABLE (doc §11 TST PlotConnect)
-- ============================================================================

-- Drop old table and recreate with correct schema
DROP TABLE IF EXISTS property_images CASCADE;
DROP TABLE IF EXISTS property_listings CASCADE;

CREATE TABLE property_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    property_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    property_type VARCHAR(50) NOT NULL,
    -- Type 1: Student Residence
    number_of_rooms INTEGER,
    price_per_room DECIMAL(15, 2),
    -- Type 2: Others
    number_of_units INTEGER,
    stay_type VARCHAR(20),
    description TEXT,
    website_link TEXT,
    placement_tier VARCHAR(20),
    placement_amount DECIMAL(15, 2),
    payment_transaction_id VARCHAR(255),
    published BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_PAYMENT',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_property_type CHECK (property_type IN ('STUDENT_RESIDENCE', 'APARTMENT', 'AIRBNB', 'LODGE', 'RENTAL_FLAT', 'OTHER')),
    CONSTRAINT valid_placement_tier CHECK (placement_tier IS NULL OR placement_tier IN ('TOP', 'MEDIUM', 'BASIC')),
    CONSTRAINT valid_stay_type CHECK (stay_type IS NULL OR stay_type IN ('MONTHLY', 'DAILY')),
    CONSTRAINT valid_property_status CHECK (status IN ('PENDING_PAYMENT', 'PUBLISHED', 'UNPUBLISHED'))
);

CREATE INDEX idx_property_listings_country ON property_listings(country);
CREATE INDEX idx_property_listings_property_type ON property_listings(property_type);
CREATE INDEX idx_property_listings_status ON property_listings(status);
CREATE INDEX idx_property_listings_created_by ON property_listings(created_by);

CREATE TABLE property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
    file_id VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_property_images_property_id ON property_images(property_id);
CREATE INDEX idx_property_images_display_order ON property_images(property_id, display_order);

-- ============================================================================
-- 5. ADD ACCOUNT LIMITS TABLE (doc §5: CEO=1, CoS=1, CFO Assistants=3)
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) NOT NULL UNIQUE,
    max_count INTEGER NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed account limits
INSERT INTO account_limits (role_name, max_count, scope) VALUES
    ('CEO',           1, 'SYSTEM'),
    ('CoS',           1, 'SYSTEM'),
    ('CFO_ASSISTANT', 3, 'PER_PARENT')
ON CONFLICT (role_name) DO NOTHING;

COMMIT;
