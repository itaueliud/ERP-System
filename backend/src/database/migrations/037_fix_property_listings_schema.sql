-- Migration 037: Align property_listings schema with propertyService expectations
-- The service uses: title, price, currency, property_type, size, view_count, status (AVAILABLE/SOLD/UNAVAILABLE)
-- The old schema used: property_name, price_per_room, no currency/size/view_count columns

-- 1. Rename property_name → title
ALTER TABLE property_listings RENAME COLUMN property_name TO title;

-- 2. Add missing columns (if they don't already exist)
ALTER TABLE property_listings
  ADD COLUMN IF NOT EXISTS price        DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency     VARCHAR(10)   NOT NULL DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS property_type VARCHAR(50)  NOT NULL DEFAULT 'RESIDENTIAL',
  ADD COLUMN IF NOT EXISTS size         DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count   INTEGER       NOT NULL DEFAULT 0;

-- 3. Drop the old status constraint and replace with the values the service uses
ALTER TABLE property_listings DROP CONSTRAINT IF EXISTS valid_property_status;
ALTER TABLE property_listings DROP CONSTRAINT IF EXISTS valid_property_type;

-- Update any existing rows that have old status values
UPDATE property_listings SET status = 'AVAILABLE'   WHERE status = 'PUBLISHED';
UPDATE property_listings SET status = 'UNAVAILABLE'  WHERE status = 'UNPUBLISHED';
UPDATE property_listings SET status = 'AVAILABLE'    WHERE status = 'PENDING_PAYMENT';

-- 4. Add new constraints
ALTER TABLE property_listings
  ADD CONSTRAINT valid_property_status CHECK (status IN ('AVAILABLE', 'SOLD', 'UNAVAILABLE')),
  ADD CONSTRAINT valid_property_type   CHECK (property_type IN (
    'STUDENT_RESIDENCE', 'APARTMENT', 'AIRBNB', 'LODGE', 'RENTAL_FLAT',
    'LAND', 'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'AGRICULTURAL', 'OTHER'
  ));

-- 5. Make previously required columns nullable since the new form doesn't always supply them
ALTER TABLE property_listings
  ALTER COLUMN contact_person DROP NOT NULL;
