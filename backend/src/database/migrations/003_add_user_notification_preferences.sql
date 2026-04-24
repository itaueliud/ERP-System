-- Migration: Add user_notification_preferences table
-- Requirement 14.6: Allow users to configure notification preferences per event type

CREATE TABLE user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    channels JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_notification_type CHECK (notification_type IN (
        'PAYMENT_APPROVAL',
        'PAYMENT_EXECUTED',
        'LEAD_CONVERTED',
        'REPORT_OVERDUE',
        'SERVICE_AMOUNT_CHANGE',
        'CONTRACT_GENERATED',
        'MESSAGE_RECEIVED',
        'TASK_ASSIGNED',
        'TASK_DUE'
    )),
    UNIQUE (user_id, notification_type)
);

CREATE INDEX idx_user_notification_preferences_user_id
    ON user_notification_preferences(user_id);

COMMENT ON TABLE user_notification_preferences IS
    'Stores per-user, per-type notification preferences (enabled flag and channel overrides)';
