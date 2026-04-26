-- Migration 033: Add default Software Engineering user for Portal 5 testing
-- Security Manager: tech@tst.com (already exists, dept = TECHNOLOGY_INFRASTRUCTURE_SECURITY)
-- Lead Software Architect: softeng@tst.com (new, dept = SOFTWARE_ENGINEERING_PRODUCT_DEVELOPMENT)

DO $$
DECLARE
  v_tech_staff_role_id UUID;
  v_softeng_dept_id    UUID;
BEGIN
  -- Get TECH_STAFF role id
  SELECT id INTO v_tech_staff_role_id FROM roles WHERE name = 'TECH_STAFF' LIMIT 1;

  -- Get first SOFTWARE_ENGINEERING_PRODUCT_DEVELOPMENT department
  SELECT id INTO v_softeng_dept_id
  FROM departments
  WHERE type = 'SOFTWARE_ENGINEERING_PRODUCT_DEVELOPMENT'
  LIMIT 1;

  -- Insert Lead Software Architect user (password: SoftEng@12345!)
  INSERT INTO users (email, password_hash, full_name, phone, country, role_id, department_id, language_preference, timezone)
  VALUES (
    'softeng@tst.com',
    '$2b$10$jatc8k3smGN3HkbwWLJiBez2yp/i3ZZjrK7g4L1axEcNEWo23S9u2',
    'Lead Software Architect',
    '+254700000099',
    'Kenya',
    v_tech_staff_role_id,
    v_softeng_dept_id,
    'en',
    'Africa/Nairobi'
  )
  ON CONFLICT (email) DO UPDATE
    SET role_id = v_tech_staff_role_id,
        department_id = v_softeng_dept_id,
        full_name = 'Lead Software Architect';

  -- Also update tech@tst.com full_name to Security Manager for clarity
  UPDATE users SET full_name = 'Security Manager' WHERE email = 'tech@tst.com';
END $$;
