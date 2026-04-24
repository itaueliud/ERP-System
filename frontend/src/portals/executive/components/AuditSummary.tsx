import React from 'react';
import { Card, Table, StatusIndicator } from '../../../shared/components';
import type { TableColumn } from '../../../shared/components';
import type { AuditSummaryEntry } from '../types';

interface AuditSummaryProps {
  entries: AuditSummaryEntry[];
  onViewFull?: () => void;
}

type AuditRow = Record<string, unknown> & AuditSummaryEntry;

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditSummary({ entries, onViewFull }: AuditSummaryProps) {
  const columns: TableColumn<AuditRow>[] = [
    {
      key: 'timestamp',
      header: 'Time',
      sortable: true,
      render: (val) => (
        <time dateTime={String(val)} className="text-xs text-gray-500 whitespace-nowrap">
          {formatTimestamp(String(val))}
        </time>
      ),
    },
    { key: 'user', header: 'User', sortable: true },
    {
      key: 'action',
      header: 'Action',
      render: (val) => (
        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
          {String(val)}
        </span>
      ),
    },
    { key: 'resource', header: 'Resource' },
    {
      key: 'result',
      header: 'Result',
      render: (val) => (
        <StatusIndicator
          status={val === 'success' ? 'success' : 'error'}
          label={String(val)}
          size="sm"
        />
      ),
    },
  ];

  const viewFullButton = (
    <button
      onClick={onViewFull}
      aria-label="View full audit log"
      className="text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
    >
      View Full Log
    </button>
  );

  return (
    <section aria-label="Audit log summary">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Audit Summary</h2>
      <Card
        variant="default"
        padding="none"
        title="Recent Financial Actions"
        subtitle={`${entries.length} recent entries`}
        actions={viewFullButton}
      >
        <Table<AuditRow>
          columns={columns}
          data={entries as AuditRow[]}
          rowKey="id"
          pageSize={8}
          emptyMessage="No audit entries."
          caption="Recent financial audit log entries"
        />
      </Card>
    </section>
  );
}

export default AuditSummary;
