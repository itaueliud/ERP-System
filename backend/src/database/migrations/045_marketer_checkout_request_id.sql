-- Migration 045: Add checkout_request_id to marketer_properties
-- Stores the Safaricom CheckoutRequestID so we can actively query payment status
-- without relying solely on the callback URL being reachable.

ALTER TABLE marketer_properties
  ADD COLUMN IF NOT EXISTS checkout_request_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_marketer_properties_checkout_request_id
  ON marketer_properties (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;
