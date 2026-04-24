import React from 'react';
import { Card, StatusIndicator } from '../../../shared/components';
import type { StatusType } from '../../../shared/components';
import type { SecurityAlert, AlertSeverity } from '../types';

interface SecurityAlertsProps {
  alerts: SecurityAlert[];
}

const SEVERITY_STATUS: Record<AlertSeverity, StatusType> = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'error',
  CRITICAL: 'error',
};

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-red-100 text-red-700',
  CRITICAL: 'bg-red-200 text-red-900 font-bold',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SecurityAlerts({ alerts }: SecurityAlertsProps) {
  const unresolved = alerts.filter((a) => !a.resolved);
  const resolved = alerts.filter((a) => a.resolved);

  return (
    <section aria-label="Security alerts and fraud detection">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Security Alerts
        {unresolved.length > 0 && (
          <span className="ml-2 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {unresolved.length} active
          </span>
        )}
      </h2>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <Card
            key={alert.id}
            variant="default"
            padding="md"
            className={alert.resolved ? 'opacity-60' : ''}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{alert.type}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_BADGE[alert.severity]}`}
                    aria-label={`Severity: ${alert.severity}`}
                  >
                    {alert.severity}
                  </span>
                  <StatusIndicator
                    status={alert.resolved ? 'success' : SEVERITY_STATUS[alert.severity]}
                    label={alert.resolved ? 'Resolved' : 'Active'}
                    size="sm"
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                {alert.affectedUser && (
                  <p className="text-xs text-gray-400 mt-1">Affected: {alert.affectedUser}</p>
                )}
              </div>
              <time
                dateTime={alert.detectedAt}
                className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0"
              >
                {formatTime(alert.detectedAt)}
              </time>
            </div>
          </Card>
        ))}
        {alerts.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No security alerts.</p>
        )}
        {resolved.length > 0 && (
          <p className="text-xs text-gray-400 text-right">{resolved.length} resolved alert(s) shown above</p>
        )}
      </div>
    </section>
  );
}

export default SecurityAlerts;
