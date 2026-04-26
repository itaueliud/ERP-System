-- TechSwiftTrix ERP System Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ROLES AND PERMISSIONS
-- ============================================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_role_name CHECK (name IN (
        'CEO', 'CoS', 'CFO', 'COO', 'CTO', 'EA', 
        'HEAD_OF_TRAINERS', 'TRAINER', 'AGENT', 
        'OPERATIONS_USER', 'TECH_STAFF', 'DEVELOPER',
        'CFO_ASSISTANT'
    ))
);

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    -- Doc §4: 6 named departments — 3 under COO, 3 under CTO
    type VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES departments(id),
    head_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_department_type CHECK (type IN (
        -- COO departments (Portal 4)
        'SALES_CLIENT_ACQUISITION',
        'CLIENT_SUCCESS_ACCOUNT_MANAGEMENT',
        'MARKETING_BUSINESS_OPERATIONS',
        -- CTO departments (Portal 5)
        'TECHNOLOGY_INFRASTRUCTURE_SECURITY',
        'SOFTWARE_ENGINEERING_PRODUCT_DEVELOPMENT',
        'ENGINEERING_OPERATIONS_DELIVERY'
    ))
);

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    country VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    national_id_number VARCHAR(100),
    national_id_document_url TEXT,
    role_id UUID NOT NULL REFERENCES roles(id),
    department_id UUID REFERENCES departments(id),
    github_username VARCHAR(255),
    team_id UUID,                             -- for developers (Engineering Operations & Delivery)
    is_team_leader BOOLEAN DEFAULT FALSE,     -- doc §17: Team Leader vs Non-Leader permissions
    language_preference VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(100) DEFAULT 'UTC',
    -- Doc §21: 2FA mandatory for CEO, CoS, CFO, EA — enforced at application level
    -- two_fa_enabled defaults FALSE but application layer forces TRUE for executive roles
    two_fa_enabled BOOLEAN DEFAULT FALSE,
    two_fa_secret VARCHAR(255),
    two_fa_mandatory BOOLEAN DEFAULT FALSE,   -- set TRUE for CEO/CoS/CFO/EA at account creation
    profile_photo_url TEXT,
    cover_photo_url TEXT,                     -- for agents (doc §5)
    trainer_reference_id VARCHAR(100),        -- for trainers (doc §5)
    date_of_joining DATE,
    bio TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    suspended_at TIMESTAMP,
    suspended_by UUID,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT valid_language CHECK (language_preference IN ('en', 'sw', 'fr'))
);$'),
    CONSTRAINT valid_language CHECK (language_preference IN ('en', 'sw', 'fr'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_github_username ON users(github_username);

-- Add foreign key for department head after users table is created
ALTER TABLE departments ADD CONSTRAINT fk_department_head 
    FOREIGN KEY (head_id) REFERENCES users(id);

-- ============================================================================
-- CLIENTS
-- ============================================================================

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    country VARCHAR(100) NOT NULL,
    industry_category VARCHAR(50) NOT NULL,
    service_description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'NEW_LEAD',
    agent_id UUID NOT NULL REFERENCES users(id),
    estimated_value DECIMAL(15, 2),
    priority VARCHAR(20),
    expected_start_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Doc §10 Lead Status Lifecycle — exact status names from spec
    CONSTRAINT valid_status CHECK (status IN ('NEW_LEAD', 'CONVERTED', 'LEAD_ACTIVATED', 'LEAD_QUALIFIED', 'NEGOTIATION', 'CLOSED_WON')),
    CONSTRAINT valid_industry CHECK (industry_category IN ('SCHOOLS', 'CHURCHES', 'HOTELS', 'HOSPITALS', 'COMPANIES', 'REAL_ESTATE', 'SHOPS')),
    CONSTRAINT valid_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT'))
);

CREATE INDEX idx_clients_agent_id ON clients(agent_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_country ON clients(country);
CREATE INDEX idx_clients_industry_category ON clients(industry_category);
CREATE INDEX idx_clients_created_at ON clients(created_at);

-- ============================================================================
-- GITHUB REPOSITORIES
-- ============================================================================

CREATE TABLE github_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_repo_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    metadata JSONB,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_github_repositories_github_repo_id ON github_repositories(github_repo_id);

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL',
    service_amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    start_date DATE,
    end_date DATE,
    github_repo_id UUID REFERENCES github_repositories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_project_status CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT valid_amount CHECK (service_amount > 0),
    CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_projects_github_repo_id ON projects(github_repo_id);

-- ============================================================================
-- PAYMENTS
-- ============================================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    client_id UUID REFERENCES clients(id),
    project_id UUID REFERENCES projects(id),
    error_code VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_payment_method CHECK (payment_method IN ('MPESA', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'VISA', 'MASTERCARD')),
    CONSTRAINT valid_payment_status CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
    CONSTRAINT valid_payment_amount CHECK (amount > 0)
);

CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_project_id ON payments(project_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- ============================================================================
-- PAYMENT APPROVALS
-- ============================================================================

CREATE TABLE payment_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    amount DECIMAL(15, 2) NOT NULL,
    purpose TEXT NOT NULL,
    requester_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL',
    approver_id UUID REFERENCES users(id),
    executor_id UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    executed_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_approval_status CHECK (status IN ('PENDING_APPROVAL', 'APPROVED_PENDING_EXECUTION', 'EXECUTED', 'REJECTED')),
    CONSTRAINT valid_approval_amount CHECK (amount > 0),
    CONSTRAINT different_approver_executor CHECK (approver_id IS NULL OR executor_id IS NULL OR approver_id != executor_id)
);

CREATE INDEX idx_payment_approvals_project_id ON payment_approvals(project_id);
CREATE INDEX idx_payment_approvals_status ON payment_approvals(status);
CREATE INDEX idx_payment_approvals_requester_id ON payment_approvals(requester_id);
CREATE INDEX idx_payment_approvals_approver_id ON payment_approvals(approver_id);
CREATE INDEX idx_payment_approvals_executor_id ON payment_approvals(executor_id);

-- ============================================================================
-- CONTRACTS
-- ============================================================================

CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id),
    version INTEGER NOT NULL DEFAULT 1,
    content JSONB NOT NULL,
    pdf_url TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_contract_status CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED')),
    CONSTRAINT valid_version CHECK (version > 0),
    UNIQUE (project_id, version)
);

CREATE INDEX idx_contracts_project_id ON contracts(project_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);

-- ============================================================================
-- CONTRACT VERSIONS
-- ============================================================================

CREATE TABLE contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id),
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,
    pdf_url TEXT NOT NULL,
    change_summary TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (contract_id, version_number)
);

CREATE INDEX idx_contract_versions_contract_id ON contract_versions(contract_id);

-- ============================================================================
-- COMMUNICATIONS
-- ============================================================================

CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    type VARCHAR(50) NOT NULL,
    communication_date DATE NOT NULL,
    duration_minutes INTEGER,
    summary TEXT,
    participants JSONB,
    outcome TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_communication_type CHECK (type IN ('EMAIL', 'PHONE', 'MEETING', 'CHAT', 'SMS'))
);

CREATE INDEX idx_communications_client_id ON communications(client_id);
CREATE INDEX idx_communications_type ON communications(type);
CREATE INDEX idx_communications_date ON communications(communication_date);

-- ============================================================================
-- DAILY REPORTS
-- ============================================================================

CREATE TABLE daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    report_date DATE NOT NULL,
    accomplishments TEXT NOT NULL,
    challenges TEXT,
    tomorrow_plan TEXT,
    hours_worked DECIMAL(4, 2),
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (user_id, report_date),
    CONSTRAINT valid_hours CHECK (hours_worked >= 0 AND hours_worked <= 24)
);

CREATE INDEX idx_daily_reports_user_id ON daily_reports(user_id);
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX idx_daily_reports_submitted_at ON daily_reports(submitted_at);

-- ============================================================================
-- TASKS
-- ============================================================================

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    entity_type VARCHAR(50),
    entity_id UUID,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_task_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT valid_task_status CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_entity ON tasks(entity_type, entity_id);

-- ============================================================================
-- PROPERTY LISTINGS (TST PlotConnect)
-- Doc §11: Two property types with placement tiers
-- ============================================================================

CREATE TABLE property_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    property_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,           -- County / Town / Area
    country VARCHAR(100) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    -- Doc §11: Property Type 1 — Student Residence / Single Rooms
    -- Doc §11: Property Type 2 — Others (Apartments, Airbnb, Lodges, Rental Flats)
    property_type VARCHAR(50) NOT NULL,
    -- Type 1 fields
    number_of_rooms INTEGER,
    price_per_room DECIMAL(15, 2),            -- constant — same for all rooms
    -- Type 2 fields
    number_of_units INTEGER,
    stay_type VARCHAR(20),                    -- Monthly or Daily
    description TEXT,
    website_link TEXT,
    -- Placement tier (Type 2 only) — doc §11
    placement_tier VARCHAR(20),               -- Top, Medium, Basic
    placement_amount DECIMAL(15, 2),
    -- Payment & publication
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

-- ============================================================================
-- PROPERTY IMAGES
-- ============================================================================

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
-- ACCOUNT LIMITS ENFORCEMENT
-- Doc §5: CEO=1 system-wide, CoS=1 system-wide, CFO Assistants=3 per CFO
-- ============================================================================

CREATE TABLE account_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) NOT NULL UNIQUE,
    max_count INTEGER NOT NULL,              -- -1 = unlimited
    scope VARCHAR(50) NOT NULL DEFAULT 'SYSTEM', -- SYSTEM or PER_PARENT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed account limits per spec
INSERT INTO account_limits (role_name, max_count, scope) VALUES
    ('CEO',           1, 'SYSTEM'),
    ('CoS',           1, 'SYSTEM'),
    ('CFO_ASSISTANT', 3, 'PER_PARENT');  -- 3 per CFO account

-- ============================================================================
-- TRAINING COURSES
-- ============================================================================

CREATE TABLE training_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    duration_hours INTEGER NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_duration CHECK (duration_hours > 0)
);

CREATE INDEX idx_training_courses_created_by ON training_courses(created_by);

-- ============================================================================
-- TRAINING MODULES
-- ============================================================================

CREATE TABLE training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    material_file_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (course_id, order_index)
);

CREATE INDEX idx_training_modules_course_id ON training_modules(course_id);

-- ============================================================================
-- TRAINING ASSIGNMENTS
-- ============================================================================

CREATE TABLE training_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES training_courses(id),
    agent_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_training_status CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED')),
    UNIQUE (course_id, agent_id)
);

CREATE INDEX idx_training_assignments_course_id ON training_assignments(course_id);
CREATE INDEX idx_training_assignments_agent_id ON training_assignments(agent_id);
CREATE INDEX idx_training_assignments_status ON training_assignments(status);

-- ============================================================================
-- ACHIEVEMENTS
-- ============================================================================

CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    country VARCHAR(100) NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id),
    achievement_type VARCHAR(50) NOT NULL,
    metrics JSONB,
    achievement_date DATE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_achievement_type CHECK (achievement_type IN ('REVENUE_MILESTONE', 'CLIENT_ACQUISITION', 'PROJECT_COMPLETION', 'TEAM_GROWTH', 'INNOVATION'))
);

CREATE INDEX idx_achievements_country ON achievements(country);
CREATE INDEX idx_achievements_department_id ON achievements(department_id);
CREATE INDEX idx_achievements_type ON achievements(achievement_type);
CREATE INDEX idx_achievements_date ON achievements(achievement_date);

-- ============================================================================
-- CHAT ROOMS
-- ============================================================================

CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_room_type CHECK (type IN ('DIRECT', 'GROUP', 'DEPARTMENT', 'PROJECT'))
);

CREATE INDEX idx_chat_rooms_type ON chat_rooms(type);

-- ============================================================================
-- CHAT ROOM MEMBERS
-- ============================================================================

CREATE TABLE chat_room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP,
    
    UNIQUE (room_id, user_id)
);

CREATE INDEX idx_chat_room_members_room_id ON chat_room_members(room_id);
CREATE INDEX idx_chat_room_members_user_id ON chat_room_members(user_id);

-- ============================================================================
-- CHAT MESSAGES (Partitioned by Month)
-- ============================================================================

CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id),
    sender_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    file_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions
CREATE TABLE chat_messages_2024_01 PARTITION OF chat_messages
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id, created_at);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id, created_at);

-- ============================================================================
-- NOTIFICATIONS (Partitioned by Month)
-- ============================================================================

CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    delivery_status JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions
CREATE TABLE notifications_2024_01 PARTITION OF notifications
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at);
CREATE INDEX idx_notifications_type ON notifications(type, created_at);
CREATE INDEX idx_notifications_read ON notifications(user_id, read, created_at);

-- ============================================================================
-- AUDIT LOGS (Partitioned by Month)
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    ip_address INET NOT NULL,
    user_agent TEXT,
    result VARCHAR(20) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id, created_at),
    CONSTRAINT valid_result CHECK (result IN ('SUCCESS', 'FAILURE'))
) PARTITION BY RANGE (created_at);

-- Create initial partitions
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, created_at);

-- ============================================================================
-- STORED FILES
-- ============================================================================

CREATE TABLE stored_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id VARCHAR(255) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    url TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    description TEXT,
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_size CHECK (size > 0)
);

CREATE INDEX idx_stored_files_file_id ON stored_files(file_id);
CREATE INDEX idx_stored_files_entity ON stored_files(entity_type, entity_id);
CREATE INDEX idx_stored_files_uploaded_by ON stored_files(uploaded_by);

-- ============================================================================
-- COUNTRIES (Reference Data)
-- ============================================================================

CREATE TABLE countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(3) UNIQUE NOT NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    region VARCHAR(50) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    currency_name VARCHAR(100) NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_region CHECK (region IN (
        'East Africa', 'West Africa', 'North Africa', 'Central Africa', 'Southern Africa'
    ))
);

CREATE INDEX idx_countries_region ON countries(region);
CREATE INDEX idx_countries_code ON countries(code);

-- ============================================================================
-- SESSIONS
-- ============================================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- INVITATION TOKENS
-- ============================================================================

CREATE TABLE invitation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id),
    department_id UUID REFERENCES departments(id),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_token_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_invitation_tokens_token ON invitation_tokens(token);
CREATE INDEX idx_invitation_tokens_email ON invitation_tokens(email);
CREATE INDEX idx_invitation_tokens_expires_at ON invitation_tokens(expires_at);

-- ============================================================================
-- SERVICE AMOUNT CHANGE REQUESTS
-- ============================================================================

CREATE TABLE service_amount_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    original_amount DECIMAL(15, 2) NOT NULL,
    new_amount DECIMAL(15, 2) NOT NULL,
    justification TEXT NOT NULL,
    requester_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    ceo_decision VARCHAR(50),
    ceo_notes TEXT,
    decided_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_change_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT valid_amounts CHECK (original_amount > 0 AND new_amount > 0 AND original_amount != new_amount)
);

CREATE INDEX idx_service_amount_changes_project_id ON service_amount_changes(project_id);
CREATE INDEX idx_service_amount_changes_status ON service_amount_changes(status);
CREATE INDEX idx_service_amount_changes_requester_id ON service_amount_changes(requester_id);

-- ============================================================================
-- ACTIVITY TIMELINE
-- ============================================================================

CREATE TABLE activity_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    actor_id UUID REFERENCES users(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_timeline_entity ON activity_timeline(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_activity_timeline_actor ON activity_timeline(actor_id, created_at DESC);
CREATE INDEX idx_activity_timeline_event_type ON activity_timeline(event_type, created_at DESC);

-- ============================================================================
-- LIAISON REQUESTS (Client Success → CTO team, doc §4 Dept 2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS liaison_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    brief TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_liaison_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT valid_liaison_status CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED'))
);

CREATE INDEX idx_liaison_requests_client_id ON liaison_requests(client_id);
CREATE INDEX idx_liaison_requests_requester_id ON liaison_requests(requester_id);
