-- Migration 042: Add missing tables referenced in miscRoutes and other services

-- Service Amounts
CREATE TABLE IF NOT EXISTS service_amounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(255) NOT NULL UNIQUE,
  current_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service Amount Changes
CREATE TABLE IF NOT EXISTS service_amount_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_amount_id UUID REFERENCES service_amounts(id) ON DELETE CASCADE,
  new_amount NUMERIC(15,2) NOT NULL,
  reason TEXT,
  requested_by UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commissions (flat view table used by miscRoutes)
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES users(id),
  agent_name VARCHAR(255),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  type VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GitHub Repos
CREATE TABLE IF NOT EXISTS github_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  language VARCHAR(100),
  stars INTEGER DEFAULT 0,
  open_prs INTEGER DEFAULT 0,
  open_issues INTEGER DEFAULT 0,
  last_commit TEXT,
  pushed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GitHub Commits
CREATE TABLE IF NOT EXISTS github_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sha VARCHAR(255),
  message TEXT,
  author VARCHAR(255),
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  committed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GitHub Contributions
CREATE TABLE IF NOT EXISTS github_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  commits INTEGER DEFAULT 0,
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  pull_requests INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- COO Achievements
CREATE TABLE IF NOT EXISTS coo_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(100),
  achievement TEXT NOT NULL,
  value NUMERIC(15,2),
  period VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Tasks
CREATE TABLE IF NOT EXISTS admin_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  priority VARCHAR(50) DEFAULT 'MEDIUM',
  due_date DATE,
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Regions / Countries
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'REGION',
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  parent_id UUID REFERENCES regions(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cash Flow
CREATE TABLE IF NOT EXISTS cash_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  inflow NUMERIC(15,2) DEFAULT 0,
  outflow NUMERIC(15,2) DEFAULT 0,
  net_flow NUMERIC(15,2) GENERATED ALWAYS AS (inflow - outflow) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(100) UNIQUE,
  client VARCHAR(255),
  amount NUMERIC(15,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ledger Entries
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description TEXT,
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  balance NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  report_name VARCHAR(255),
  period VARCHAR(100),
  report_period VARCHAR(100),
  description TEXT,
  summary TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PAYE Records
CREATE TABLE IF NOT EXISTS paye_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period VARCHAR(100) NOT NULL,
  type VARCHAR(100),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- P&L Reports
CREATE TABLE IF NOT EXISTS pl_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  revenue NUMERIC(15,2) DEFAULT 0,
  expenses NUMERIC(15,2) DEFAULT 0,
  profit NUMERIC(15,2) GENERATED ALWAYS AS (revenue - expenses) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Reports
CREATE TABLE IF NOT EXISTS tax_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period VARCHAR(100) NOT NULL,
  type VARCHAR(100),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cost Approvals
CREATE TABLE IF NOT EXISTS cost_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  approved_by UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trainer Achievements
CREATE TABLE IF NOT EXISTS trainer_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID REFERENCES users(id),
  trainer_name VARCHAR(255),
  country VARCHAR(100),
  achievement TEXT NOT NULL,
  period VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fraud Flags
CREATE TABLE IF NOT EXISTS fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_by UUID REFERENCES users(id),
  description TEXT,
  severity VARCHAR(50) DEFAULT 'MEDIUM',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
