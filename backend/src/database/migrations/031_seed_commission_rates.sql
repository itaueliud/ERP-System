-- Migration 031: Seed default agent commission rates per industry category
-- doc §8: Agent commissions auto-calculated per closed deal
-- Structure: percentage of deal value per industry category (A–G)
-- Rates are configurable — CFO/CEO can update via service amounts

CREATE TABLE IF NOT EXISTS commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_category VARCHAR(100) NOT NULL UNIQUE,
  structure VARCHAR(20) NOT NULL DEFAULT 'percentage', -- percentage | flat_rate | tiered
  rate NUMERIC(5,2),                                   -- used for percentage/flat_rate
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default 10% commission on all categories (adjustable by CFO/CEO)
INSERT INTO commission_rates (industry_category, structure, rate) VALUES
  ('SCHOOLS',     'percentage', 10.00),
  ('CHURCHES',    'percentage', 10.00),
  ('HOTELS',      'percentage', 10.00),
  ('HOSPITALS',   'percentage', 10.00),
  ('COMPANIES',   'percentage', 10.00),
  ('REAL_ESTATE', 'percentage', 10.00),
  ('SHOPS',       'percentage', 10.00),
  ('PLOTCONNECT', 'percentage',  8.00)
ON CONFLICT (industry_category) DO NOTHING;
