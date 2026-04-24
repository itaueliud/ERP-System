-- Migration: Add two-factor authentication backup codes table
-- Requirements: 48.4, 48.5, 48.8

CREATE TABLE IF NOT EXISTS two_fa_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_code_hash CHECK (length(code_hash) = 64)
);

CREATE INDEX idx_two_fa_backup_codes_user_id ON two_fa_backup_codes(user_id);
CREATE INDEX idx_two_fa_backup_codes_used ON two_fa_backup_codes(user_id, used);

COMMENT ON TABLE two_fa_backup_codes IS 'Stores hashed backup codes for two-factor authentication recovery';
COMMENT ON COLUMN two_fa_backup_codes.code_hash IS 'SHA-256 hash of the backup code';
COMMENT ON COLUMN two_fa_backup_codes.used IS 'Whether this backup code has been used (single-use only)';
