-- Migration 043: Marketer tables for TST PlotConnect Agent portal (Tabs 2–5)
-- Doc: Agent Portal spec — Tab 2, Tab 3, Tab 4, Tab 5, Section 14

-- Main property listings table
CREATE TABLE IF NOT EXISTS marketer_properties (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Section A — Basic Info
  owner_name           VARCHAR(255) NOT NULL,
  owner_phone          VARCHAR(50)  NOT NULL,
  owner_phone2         VARCHAR(50),
  owner_whatsapp       VARCHAR(50),
  property_name        VARCHAR(255) NOT NULL,
  -- Section B — Location
  county               VARCHAR(100) NOT NULL,
  area                 VARCHAR(255) NOT NULL,
  map_link             TEXT,
  booking_type         VARCHAR(20)  NOT NULL DEFAULT 'MONTHLY',
  -- Section C — Property Types (JSONB array of type keys)
  property_types       JSONB        NOT NULL DEFAULT '[]',
  -- Section D — Rooms table (JSONB array of room rows)
  rooms                JSONB        NOT NULL DEFAULT '[]',
  -- Section E — Package
  package              VARCHAR(20)  NOT NULL DEFAULT 'BASIC',
  -- Section 14 Type 1 — Student Single Rooms
  number_of_rooms      VARCHAR(20),
  price_per_room       VARCHAR(20),
  -- Section 14 Type 2 — Other types
  contact_person       VARCHAR(255),
  description          TEXT,
  website_link         TEXT,
  -- Status & payment
  status               VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
  payment_status       VARCHAR(50)  NOT NULL DEFAULT 'UNPAID',
  payment_confirmed_at TIMESTAMP,
  -- Ownership
  submitted_by         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_properties_submitted_by ON marketer_properties(submitted_by);
CREATE INDEX IF NOT EXISTS idx_marketer_properties_status       ON marketer_properties(status);
CREATE INDEX IF NOT EXISTS idx_marketer_properties_payment      ON marketer_properties(payment_status);

-- Property images (up to 8 per property — Section B)
CREATE TABLE IF NOT EXISTS marketer_property_images (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID        NOT NULL REFERENCES marketer_properties(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL,
  mimetype    VARCHAR(100),
  size        INTEGER,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_property_images_property ON marketer_property_images(property_id);

-- Manual M-Pesa messages (Tab 5)
CREATE TABLE IF NOT EXISTS marketer_mpesa_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message    TEXT        NOT NULL,
  status     VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  sent_by    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_mpesa_messages_sent_by ON marketer_mpesa_messages(sent_by);

-- Package amounts — EA-editable, CEO-confirmed (Section E / Section 14)
-- Agents see live amounts from this table; cannot edit
CREATE TABLE IF NOT EXISTS marketer_packages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(20) NOT NULL UNIQUE,
  label       VARCHAR(50) NOT NULL,
  price       INTEGER     NOT NULL,
  description VARCHAR(255),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  updated_by  UUID        REFERENCES users(id),
  updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Seed default package amounts
INSERT INTO marketer_packages (key, label, price, description, sort_order)
VALUES
  ('BASIC',    'Basic',    4000,  'Starter visibility for the listing',          1),
  ('STANDARD', 'Standard', 8000,  'More reach and additional features',          2),
  ('ADVANCED', 'Advanced', 12000, 'Top placement and highest priority visibility', 3)
ON CONFLICT (key) DO NOTHING;
