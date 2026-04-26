-- Migration 018: Default portal users
-- One login account per portal role, all country = Kenya, currency = KES
--
-- Portal          URL            Email                 Password
-- ─────────────────────────────────────────────────────────────────────────────
-- CEO             /ceo           ceo@tst.com           Ceo@123456789!
-- Executive/CoS   /executive     cos@tst.com           Cos@123456789!
-- Executive/CFO   /executive     cfo@tst.com           Cfo@123456789!
-- Executive/EA    /executive     ea@tst.com            Ea@1234567890!
-- C-Level/COO     /clevel        coo@tst.com           Coo@123456789!
-- C-Level/CTO     /clevel        cto@tst.com           Cto@123456789!
-- Operations      /operations    ops@tst.com           Ops@123456789!
-- Technology      /technology    tech@tst.com          Tech@12345678!
-- Technology/Dev  /technology    dev@tst.com           Dev@123456789!
-- Agents          /agents        agent@tst.com         Agent@1234567!
-- Trainers/Head   /trainers      headtrainer@tst.com   Head@12345678!
-- Trainers        /trainers      trainer@tst.com       Train@1234567!

DO $$
DECLARE
  v_ceo_role     UUID;
  v_cos_role     UUID;
  v_cfo_role     UUID;
  v_coo_role     UUID;
  v_cto_role     UUID;
  v_ea_role      UUID;
  v_hot_role     UUID;
  v_trainer_role UUID;
  v_agent_role   UUID;
  v_ops_role     UUID;
  v_tech_role    UUID;
  v_dev_role     UUID;
  v_sales_dept   UUID;
  v_coo_dept     UUID;
  v_cto_dept     UUID;
BEGIN
  SELECT id INTO v_ceo_role     FROM roles WHERE name = 'CEO'              LIMIT 1;
  SELECT id INTO v_cos_role     FROM roles WHERE name = 'CoS'              LIMIT 1;
  SELECT id INTO v_cfo_role     FROM roles WHERE name = 'CFO'              LIMIT 1;
  SELECT id INTO v_coo_role     FROM roles WHERE name = 'COO'              LIMIT 1;
  SELECT id INTO v_cto_role     FROM roles WHERE name = 'CTO'              LIMIT 1;
  SELECT id INTO v_ea_role      FROM roles WHERE name = 'EA'               LIMIT 1;
  SELECT id INTO v_hot_role     FROM roles WHERE name = 'HEAD_OF_TRAINERS' LIMIT 1;
  SELECT id INTO v_trainer_role FROM roles WHERE name = 'TRAINER'          LIMIT 1;
  SELECT id INTO v_agent_role   FROM roles WHERE name = 'AGENT'            LIMIT 1;
  SELECT id INTO v_ops_role     FROM roles WHERE name = 'OPERATIONS_USER'  LIMIT 1;
  SELECT id INTO v_tech_role    FROM roles WHERE name = 'TECH_STAFF'  LIMIT 1;
  SELECT id INTO v_dev_role     FROM roles WHERE name = 'DEVELOPER'        LIMIT 1;

  SELECT id INTO v_sales_dept FROM departments WHERE name = 'Sales'              LIMIT 1;
  SELECT id INTO v_coo_dept   FROM departments WHERE name = 'Client Acquisition' LIMIT 1;
  SELECT id INTO v_cto_dept   FROM departments WHERE name = 'Core & Security'    LIMIT 1;

  -- CEO  (portal: /ceo)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, language_preference, timezone)
  VALUES ('ceo@tst.com',
          '$2b$10$wnu1/eWm/gG23dKIeL14yeJ4JlJmQvrUpYH61nKYy/C4144kLLtne',
          'CEO User', '+254700000001', 'Kenya', v_ceo_role, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- CoS  (portal: /executive)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, language_preference, timezone)
  VALUES ('cos@tst.com',
          '$2b$10$rKj8yozSuohYpTqZd.uSi.XFHyO7F5kOsYOxjrp5a/6bK8pTAfyqy',
          'Chief of Staff', '+254700000002', 'Kenya', v_cos_role, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- CFO  (portal: /executive)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, language_preference, timezone)
  VALUES ('cfo@tst.com',
          '$2b$10$ILsW.egsD3Xw78D66QvVnuvksY.ES.R7oiuNAaJvp9u926Y5tZYAG',
          'CFO User', '+254700000003', 'Kenya', v_cfo_role, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- EA   (portal: /executive)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, language_preference, timezone)
  VALUES ('ea@tst.com',
          '$2b$10$iYmrbRbm5PIWbrN31D.SSufs4Z26ACF.tH9VTWew99qlIAXYRYr72',
          'Executive Assistant', '+254700000006', 'Kenya', v_ea_role, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- COO  (portal: /clevel)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, department_id, language_preference, timezone)
  VALUES ('coo@tst.com',
          '$2b$10$rlXNZHdzNq0W9FZXpoyGYOFcYRu2IGAqDqe7ebg3McsCDh.yu8djC',
          'COO User', '+254700000004', 'Kenya', v_coo_role, v_coo_dept, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- CTO  (portal: /clevel)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, department_id, language_preference, timezone)
  VALUES ('cto@tst.com',
          '$2b$10$3pSPJUzmoYcD60zDR4av8uZ3bLRG7S5EM9kE8.THha.N5NqRYvth6',
          'CTO User', '+254700000005', 'Kenya', v_cto_role, v_cto_dept, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- Operations User  (portal: /operations)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, department_id, language_preference, timezone)
  VALUES ('ops@tst.com',
          '$2b$10$NSq109Hg2fGoF5UbMdXp3u76gVvD9r8o9nBvC6oVCT5.UoX6V0gcm',
          'Operations User', '+254700000007', 'Kenya', v_ops_role, v_coo_dept, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- Technology User  (portal: /technology)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, department_id, language_preference, timezone)
  VALUES ('tech@tst.com',
          '$2b$10$.v6yhgYKiBTlC4MG/UQjfew3N7RzlbAP2N7op.AANp8YgV5S9KFTa',
          'Tech Lead', '+254700000008', 'Kenya', v_tech_role, v_cto_dept, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- Developer  (portal: /technology)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, department_id, language_preference, timezone)
  VALUES ('dev@tst.com',
          '$2b$10$2kGrU5TNhJ8tH2AmeLPAqOF5nh1dIImnzaFHF95/BdvnnOSlU8SEG',
          'Developer User', '+254700000009', 'Kenya', v_dev_role, v_cto_dept, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- Agent  (portal: /agents)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, department_id, language_preference, timezone)
  VALUES ('agent@tst.com',
          '$2b$10$NjaTQwFUCOwgGFRT10MoNubCPOnZ/8v69sFH3Xq3BtamIOR0W0WUG',
          'Sales Agent', '+254700000010', 'Kenya', v_agent_role, v_sales_dept, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- Head of Trainers  (portal: /trainers)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, language_preference, timezone)
  VALUES ('headtrainer@tst.com',
          '$2b$10$vRNeHTi2RxZr7j6fVygzyeMx30FekmoXSHZ8v6qejcFdYwcUPchv2',
          'Head of Trainers', '+254700000011', 'Kenya', v_hot_role, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

  -- Trainer  (portal: /trainers)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, language_preference, timezone)
  VALUES ('trainer@tst.com',
          '$2b$10$sl7LLo8t1kxzvoXtK5dz..lyKi4aXF9XxJJsjjnxoXr3rHMd3Au/u',
          'Trainer User', '+254700000012', 'Kenya', v_trainer_role, 'en', 'Africa/Nairobi')
  ON CONFLICT (email) DO NOTHING;

END $$;
