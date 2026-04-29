-- Uptime Monitoring Tables
-- Track service health checks and uptime statistics

-- Uptime checks table
CREATE TABLE IF NOT EXISTS uptime_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
  response_time_ms INTEGER NOT NULL,
  error_message TEXT,
  checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_uptime_checks_service ON uptime_checks(service);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_checked_at ON uptime_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_service_checked_at ON uptime_checks(service, checked_at DESC);

-- Service status summary (materialized view for quick stats)
CREATE MATERIALIZED VIEW IF NOT EXISTS uptime_summary AS
SELECT 
  service,
  COUNT(*) as total_checks,
  COUNT(*) FILTER (WHERE status = 'up') as up_checks,
  COUNT(*) FILTER (WHERE status = 'down') as down_checks,
  COUNT(*) FILTER (WHERE status = 'degraded') as degraded_checks,
  AVG(response_time_ms) as avg_response_time,
  MAX(checked_at) as last_check,
  ROUND((COUNT(*) FILTER (WHERE status = 'up')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) as uptime_percentage
FROM uptime_checks
WHERE checked_at > NOW() - INTERVAL '24 hours'
GROUP BY service;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_uptime_summary_service ON uptime_summary(service);

-- Function to refresh uptime summary
CREATE OR REPLACE FUNCTION refresh_uptime_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY uptime_summary;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old uptime checks (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_uptime_checks()
RETURNS void AS $$
BEGIN
  DELETE FROM uptime_checks
  WHERE checked_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE uptime_checks IS 'Service health check results for uptime monitoring';
COMMENT ON MATERIALIZED VIEW uptime_summary IS 'Aggregated uptime statistics per service (last 24 hours)';
