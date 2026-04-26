-- Migration: 017_add_performance_indexes.sql
-- Adds optimized indexes for common query patterns to improve database performance.
-- Requirement 21.6: Create indexes on frequently queried fields:
--   user_id, client_id, project_id, transaction_id, timestamp

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
  ON users (email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_id
  ON users (role_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_department_id
  ON users (department_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at
  ON users (created_at DESC);

-- ─── Clients ──────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_agent_id
  ON clients (agent_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_status
  ON clients (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_created_at
  ON clients (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_agent_status
  ON clients (agent_id, status);

-- ─── Projects ─────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_client_id
  ON projects (client_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status
  ON projects (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_at
  ON projects (created_at DESC);

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_client_id
  ON payments (client_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_project_id
  ON payments (project_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_transaction_id
  ON payments (transaction_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status
  ON payments (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_timestamp
  ON payments (timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_client_status
  ON payments (client_id, status);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp
  ON audit_logs (timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_type
  ON audit_logs (action_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_type_id
  ON audit_logs (resource_type, resource_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_timestamp
  ON audit_logs (user_id, timestamp DESC);

-- ─── Notifications ────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id
  ON notifications (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at
  ON notifications (created_at DESC);

-- ─── Chat Messages ────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_room_id
  ON chat_messages (room_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_sender_id
  ON chat_messages (sender_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_created_at
  ON chat_messages (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_room_created
  ON chat_messages (room_id, created_at DESC);

-- ─── Tasks ────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_id
  ON tasks (project_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assigned_to
  ON tasks (assigned_to);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status
  ON tasks (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_due_date
  ON tasks (due_date);

-- ─── Contracts ────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_project_id
  ON contracts (project_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_created_at
  ON contracts (created_at DESC);

-- ─── Daily Reports ────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_reports_user_id
  ON daily_reports (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_reports_submitted_at
  ON daily_reports (submitted_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_reports_user_date
  ON daily_reports (user_id, submitted_at DESC);
