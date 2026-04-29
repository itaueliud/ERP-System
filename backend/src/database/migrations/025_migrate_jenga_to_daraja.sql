-- Migration 025: Replace Jenga API with Daraja API (Safaricom M-Pesa)
-- Adds Daraja-specific fields to the payments table for STK Push tracking.

-- Add checkout_request_id column for Daraja STK Push CheckoutRequestID
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS checkout_request_id VARCHAR(255);

-- Add merchant_request_id column for Daraja STK Push MerchantRequestID
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS merchant_request_id VARCHAR(255);

-- Index for fast lookup by checkout_request_id (used in webhook callbacks)
CREATE INDEX IF NOT EXISTS idx_payments_checkout_request_id
  ON payments (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

-- Update payment_method constraint to keep existing methods
-- (MPESA, AIRTEL_MONEY, BANK_TRANSFER, VISA, MASTERCARD remain unchanged)
-- No schema change needed for payment_method values.

-- Comment: transaction_id now stores Daraja CheckoutRequestID for M-Pesa STK Push,
-- ConversationID for B2C transfers, and a generated reference for Airtel/Card payments.
