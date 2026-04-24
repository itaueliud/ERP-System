-- Migration 006: Add report_overdue_flags table
-- Requirement 10.5: Mark users as REPORT_OVERDUE if no report submitted by 11 PM

CREATE TABLE report_overdue_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    marked_overdue_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (user_id, report_date)
);

CREATE INDEX idx_report_overdue_flags_user_id
    ON report_overdue_flags(user_id);

CREATE INDEX idx_report_overdue_flags_date
    ON report_overdue_flags(report_date);

CREATE INDEX idx_report_overdue_flags_unresolved
    ON report_overdue_flags(user_id, report_date)
    WHERE resolved_at IS NULL;

COMMENT ON TABLE report_overdue_flags IS
    'Tracks users who failed to submit daily reports by 11 PM deadline';
