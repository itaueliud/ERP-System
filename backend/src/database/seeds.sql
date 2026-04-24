-- TechSwiftTrix ERP System Seed Data
-- Initial data for roles, countries, and system configuration

-- ============================================================================
-- ROLES
-- ============================================================================

INSERT INTO roles (name, permissions) VALUES
('CEO', '["*"]'),
('CoS', '["users:*", "clients:*", "projects:*", "payments:*", "reports:*", "audit:read", "dashboard:executive"]'),
('CFO', '["payments:approve", "payments:read", "financial:*", "reports:financial", "dashboard:executive"]'),
('COO', '["departments:coo:*", "clients:*", "projects:*", "reports:operations", "achievements:*", "dashboard:clevel"]'),
('CTO', '["departments:cto:*", "projects:*", "github:*", "reports:technology", "achievements:*", "dashboard:clevel"]'),
('EA', '["payments:execute", "contracts:*", "reports:read", "dashboard:executive"]'),
('HEAD_OF_TRAINERS', '["trainers:*", "agents:read", "training:*", "reports:training", "dashboard:trainer"]'),
('TRAINER', '["agents:read", "training:read", "training:assign", "reports:training", "dashboard:trainer"]'),
('AGENT', '["clients:create", "clients:own:*", "properties:create", "reports:daily", "dashboard:agent"]'),
('OPERATIONS_USER', '["clients:*", "projects:read", "properties:*", "reports:operations", "dashboard:operations"]'),
('TECHNOLOGY_USER', '["projects:read", "github:read", "reports:technology", "dashboard:technology"]'),
('DEVELOPER', '["projects:read", "github:*", "reports:technology", "dashboard:technology"]'),
('CFO_ASSISTANT', '["payments:read", "payments:review", "payments:request", "financial:read", "reports:financial", "dashboard:executive", "chat:clients", "chat:cfo"]');

-- ============================================================================
-- COUNTRIES (54 African Countries — all 5 AU regions)
-- ============================================================================

INSERT INTO countries (code, name, region, currency, currency_name, timezone) VALUES
-- ── East Africa (18) ─────────────────────────────────────────────────────────
('BDI', 'Burundi',       'East Africa', 'BIF', 'Burundian Franc',        'Africa/Bujumbura'),
('COM', 'Comoros',       'East Africa', 'KMF', 'Comorian Franc',         'Indian/Comoro'),
('DJI', 'Djibouti',      'East Africa', 'DJF', 'Djiboutian Franc',       'Africa/Djibouti'),
('ERI', 'Eritrea',       'East Africa', 'ERN', 'Eritrean Nakfa',         'Africa/Asmara'),
('ETH', 'Ethiopia',      'East Africa', 'ETB', 'Ethiopian Birr',         'Africa/Addis_Ababa'),
('KEN', 'Kenya',         'East Africa', 'KES', 'Kenyan Shilling',        'Africa/Nairobi'),
('MDG', 'Madagascar',    'East Africa', 'MGA', 'Malagasy Ariary',        'Indian/Antananarivo'),
('MWI', 'Malawi',        'East Africa', 'MWK', 'Malawian Kwacha',        'Africa/Blantyre'),
('MUS', 'Mauritius',     'East Africa', 'MUR', 'Mauritian Rupee',        'Indian/Mauritius'),
('MOZ', 'Mozambique',    'East Africa', 'MZN', 'Mozambican Metical',     'Africa/Maputo'),
('RWA', 'Rwanda',        'East Africa', 'RWF', 'Rwandan Franc',          'Africa/Kigali'),
('SYC', 'Seychelles',    'East Africa', 'SCR', 'Seychellois Rupee',      'Indian/Mahe'),
('SOM', 'Somalia',       'East Africa', 'SOS', 'Somali Shilling',        'Africa/Mogadishu'),
('SSD', 'South Sudan',   'East Africa', 'SSP', 'South Sudanese Pound',   'Africa/Juba'),
('TZA', 'Tanzania',      'East Africa', 'TZS', 'Tanzanian Shilling',     'Africa/Dar_es_Salaam'),
('UGA', 'Uganda',        'East Africa', 'UGX', 'Ugandan Shilling',       'Africa/Kampala'),
('ZMB', 'Zambia',        'East Africa', 'ZMW', 'Zambian Kwacha',         'Africa/Lusaka'),
('ZWE', 'Zimbabwe',      'East Africa', 'ZWL', 'Zimbabwean Dollar',      'Africa/Harare'),

-- ── West Africa (16) ─────────────────────────────────────────────────────────
('BEN', 'Benin',         'West Africa', 'XOF', 'West African CFA Franc', 'Africa/Porto-Novo'),
('BFA', 'Burkina Faso',  'West Africa', 'XOF', 'West African CFA Franc', 'Africa/Ouagadougou'),
('CPV', 'Cabo Verde',    'West Africa', 'CVE', 'Cape Verdean Escudo',    'Atlantic/Cape_Verde'),
('CIV', 'Côte d''Ivoire','West Africa', 'XOF', 'West African CFA Franc', 'Africa/Abidjan'),
('GMB', 'Gambia',        'West Africa', 'GMD', 'Gambian Dalasi',         'Africa/Banjul'),
('GHA', 'Ghana',         'West Africa', 'GHS', 'Ghanaian Cedi',          'Africa/Accra'),
('GIN', 'Guinea',        'West Africa', 'GNF', 'Guinean Franc',          'Africa/Conakry'),
('GNB', 'Guinea-Bissau', 'West Africa', 'XOF', 'West African CFA Franc', 'Africa/Bissau'),
('LBR', 'Liberia',       'West Africa', 'LRD', 'Liberian Dollar',        'Africa/Monrovia'),
('MLI', 'Mali',          'West Africa', 'XOF', 'West African CFA Franc', 'Africa/Bamako'),
('MRT', 'Mauritania',    'West Africa', 'MRU', 'Mauritanian Ouguiya',    'Africa/Nouakchott'),
('NER', 'Niger',         'West Africa', 'XOF', 'West African CFA Franc', 'Africa/Niamey'),
('NGA', 'Nigeria',       'West Africa', 'NGN', 'Nigerian Naira',         'Africa/Lagos'),
('SEN', 'Senegal',       'West Africa', 'XOF', 'West African CFA Franc', 'Africa/Dakar'),
('SLE', 'Sierra Leone',  'West Africa', 'SLL', 'Sierra Leonean Leone',   'Africa/Freetown'),
('TGO', 'Togo',          'West Africa', 'XOF', 'West African CFA Franc', 'Africa/Lome'),

-- ── North Africa (6) ─────────────────────────────────────────────────────────
('DZA', 'Algeria',       'North Africa', 'DZD', 'Algerian Dinar',        'Africa/Algiers'),
('EGY', 'Egypt',         'North Africa', 'EGP', 'Egyptian Pound',        'Africa/Cairo'),
('LBY', 'Libya',         'North Africa', 'LYD', 'Libyan Dinar',          'Africa/Tripoli'),
('MAR', 'Morocco',       'North Africa', 'MAD', 'Moroccan Dirham',       'Africa/Casablanca'),
('SDN', 'Sudan',         'North Africa', 'SDG', 'Sudanese Pound',        'Africa/Khartoum'),
('TUN', 'Tunisia',       'North Africa', 'TND', 'Tunisian Dinar',        'Africa/Tunis'),

-- ── Central Africa (9) ───────────────────────────────────────────────────────
('AGO', 'Angola',                        'Central Africa', 'AOA', 'Angolan Kwanza',          'Africa/Luanda'),
('CMR', 'Cameroon',                      'Central Africa', 'XAF', 'Central African CFA Franc','Africa/Douala'),
('CAF', 'Central African Republic',      'Central Africa', 'XAF', 'Central African CFA Franc','Africa/Bangui'),
('TCD', 'Chad',                          'Central Africa', 'XAF', 'Central African CFA Franc','Africa/Ndjamena'),
('COG', 'Congo (Republic)',              'Central Africa', 'XAF', 'Central African CFA Franc','Africa/Brazzaville'),
('COD', 'Congo (DRC)',                   'Central Africa', 'CDF', 'Congolese Franc',          'Africa/Kinshasa'),
('GNQ', 'Equatorial Guinea',             'Central Africa', 'XAF', 'Central African CFA Franc','Africa/Malabo'),
('GAB', 'Gabon',                         'Central Africa', 'XAF', 'Central African CFA Franc','Africa/Libreville'),
('STP', 'São Tomé and Príncipe',         'Central Africa', 'STN', 'São Tomé and Príncipe Dobra','Africa/Sao_Tome'),

-- ── Southern Africa (5) ──────────────────────────────────────────────────────
('BWA', 'Botswana',      'Southern Africa', 'BWP', 'Botswana Pula',      'Africa/Gaborone'),
('SWZ', 'Eswatini',      'Southern Africa', 'SZL', 'Swazi Lilangeni',    'Africa/Mbabane'),
('LSO', 'Lesotho',       'Southern Africa', 'LSL', 'Lesotho Loti',       'Africa/Maseru'),
('NAM', 'Namibia',       'Southern Africa', 'NAD', 'Namibian Dollar',    'Africa/Windhoek'),
('ZAF', 'South Africa',  'Southern Africa', 'ZAR', 'South African Rand', 'Africa/Johannesburg');

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

-- COO Departments
INSERT INTO departments (name, type, parent_id, head_id) VALUES
('Sales & Client Acquisition',          'SALES_CLIENT_ACQUISITION',          NULL, NULL),
('Client Success & Account Management', 'CLIENT_SUCCESS_ACCOUNT_MANAGEMENT', NULL, NULL),
('Marketing & Business Operations',     'MARKETING_BUSINESS_OPERATIONS',     NULL, NULL);

-- CTO Departments
INSERT INTO departments (name, type, parent_id, head_id) VALUES
('Technology Infrastructure & Security',        'TECHNOLOGY_INFRASTRUCTURE_SECURITY',        NULL, NULL),
('Software Engineering & Product Development',  'SOFTWARE_ENGINEERING_PRODUCT_DEVELOPMENT',  NULL, NULL),
('Engineering Operations & Delivery',           'ENGINEERING_OPERATIONS_DELIVERY',           NULL, NULL);

-- ============================================================================
-- DEFAULT CEO USER
-- Email:    ceo@techswifttrix.com
-- Password: Admin@TST2024!
-- ⚠️  Change this password immediately after first login.
-- ============================================================================

INSERT INTO users (
  email,
  password_hash,
  full_name,
  phone,
  country,
  role_id
)
SELECT
  'ceo@techswifttrix.com',
  '$2b$12$UtK8wO6j06fG1PL4Wyg/nukOAKrLhEKcFfnyx28Ljy5/yStn1OvzK',
  'Joshua Ngala',
  '+254700000000',
  'Kenya',
  r.id
FROM roles r
WHERE r.name = 'CEO'
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- DEV SEED USERS — one per role for local development
-- ⚠️  These accounts are for development only. Remove before production.
-- ============================================================================

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'cfo@tst.com', '$2b$10$WPevPOFUqESXETSU6a5Uce/USh.zWaGv5304xoGTyAX4m8f2YVNbu',
       'CFO User', '+254700000001', 'Kenya', r.id FROM roles r WHERE r.name = 'CFO'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'cos@tst.com', '$2b$10$rQWOcfkx17y9OY0IcvAgRO6c8iZSgvYjY8EwcNZlhtwdcKakkUVVq',
       'CoS User', '+254700000002', 'Kenya', r.id FROM roles r WHERE r.name = 'CoS'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'ea@tst.com', '$2b$10$kBQook4FpVFWztTmkV.j9uon4OauqCDDtIMlmDILKond2yhcvTz2a',
       'EA User', '+254700000003', 'Kenya', r.id FROM roles r WHERE r.name = 'EA'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'coo@tst.com', '$2b$10$j.IfTswmAZ1Czo0Ehk3iWOrCA6sioqN47cbcWDBay1cyrBzqUfWLC',
       'COO User', '+254700000004', 'Kenya', r.id FROM roles r WHERE r.name = 'COO'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'cto@tst.com', '$2b$10$QL8Yanjxl7x0zf8lDRZuI.nffRPRWnGdeZyOf5A0nVq1vERBn85eW',
       'CTO User', '+254700000005', 'Kenya', r.id FROM roles r WHERE r.name = 'CTO'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'ops@tst.com', '$2b$10$uWt70ux5LN.4pVIOpW9HKuFpjeMirmqfo4qivmULIJN1VVdxSJC7a',
       'Operations User', '+254700000006', 'Kenya', r.id FROM roles r WHERE r.name = 'OPERATIONS_USER'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'headtrainer@tst.com', '$2b$10$hDFwXDnAOFtxcXBnNDiddeuN6fe1kGzDDwV6g.SzAkh0tLAyvtiuG',
       'Head of Trainers', '+254700000007', 'Kenya', r.id FROM roles r WHERE r.name = 'HEAD_OF_TRAINERS'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'trainer@tst.com', '$2b$10$BupkvxOvdRS8jfF7D.MwBuQ4XuypS5j..Oykr1xlZWXlIQGeq9T12',
       'Trainer User', '+254700000008', 'Kenya', r.id FROM roles r WHERE r.name = 'TRAINER'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'tech@tst.com', '$2b$10$jatc8k3smGN3HkbwWLJiBez2yp/i3ZZjrK7g4L1axEcNEWo23S9u2',
       'Tech Lead', '+254700000009', 'Kenya', r.id FROM roles r WHERE r.name = 'TECHNOLOGY_USER'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'dev@tst.com', '$2b$10$/SyTI26anhomvSmL9tRR0OhyuW77d3Kab9tzrI6tSbvCOA2Hmf/Uu',
       'Developer User', '+254700000010', 'Kenya', r.id FROM roles r WHERE r.name = 'DEVELOPER'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone, country, role_id)
SELECT 'agent@tst.com', '$2b$10$PcKoJu9jDs1PVHg/Nmz7gOg6B/a0QpnlS6qkCiFfPQ7iUaMfXmcPi',
       'Agent User', '+254700000011', 'Kenya', r.id FROM roles r WHERE r.name = 'AGENT'
ON CONFLICT (email) DO NOTHING;
