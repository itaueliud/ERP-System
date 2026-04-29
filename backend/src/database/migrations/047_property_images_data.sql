-- Migration 047: Store image bytes and URL in marketer_property_images
ALTER TABLE marketer_property_images ADD COLUMN IF NOT EXISTS data bytea;
ALTER TABLE marketer_property_images ADD COLUMN IF NOT EXISTS url text;
