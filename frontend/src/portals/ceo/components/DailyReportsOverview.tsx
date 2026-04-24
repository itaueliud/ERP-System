import React from 'react';
import { Card, Table, StatusIndicator } from '../../../shared/components';
import type { TableColumn } from '../../../shared/components';
import type { StatusType } from '../../../shared/components';
import type { DailyReport, ReportSubmissionStatus } from '../types';

interface DailyReportsOverviewProps {
  reports: DailyReport[];
}

type ReportRow = Record<string, unknown> & DailyReport;

const STATUS_MAP: Record<ReportSubmissionStatus, StatusType> = {
  submitted: 'success',
  overdue: 'error',
  pending: 'pending',
};

export function DailyReportsOverview({ reports }: DailyReportsOverviewProps) {
  const submitted = reports.filter((r) => r.submissionStatus === 'submitted').length;
  const overdue = reports.filter((r) => r.submissionStatus === 'overdue').length;

  const columns: TableColumn<ReportRow>[] = [
    { key: 'userName', header: 'Name', sortable: true },
    { key: 'role', header: 'Role' },
    { key: 'department', header: 'Department', sortable: true },
    {
      key: 'submissionStatus',
      header: 'Status',
      render: (val) => (
        <StatusIndicator
          status={STATUS_MAP[val as ReportSubmissionStatus]}
          label={String(val).charAt(0).toUpperCase() + String(val).slice(1)}
          size="sm"
        />
      ),
    },
    {
      key: 'submissionTime',
      header: 'Submitted At',
      render: (val) => val ? <span className="text-gray-600">{String(val)}</span> : <span className="text-gray-300">—</span>,
    },
  ];

  return (
    <section aria-label="Daily reports overview">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Daily Reports</h2>
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-green-700 font-medium">{submitted} submitted</span>
        <span className="text-red-600 font-medium">{overdue} overdue</span>
        <span className="text-gray-500">{reports.length - submitted - overdue} pending</span>
      </div>
      <Card variant="default" padding="none">
        <Table<ReportRow>
          columns={columns}
          data={reports as ReportRow[]}
          rowKey="id"
          emptyMessage="No daily reports found."
          caption="Daily report submission status for all users"
        />
      </Card>
    </section>
  );
}

export default DailyReportsOverview;
