import React, { useState } from 'react';
import { Card, Table, StatusIndicator } from '../../../shared/components';
import type { TableColumn } from '../../../shared/components';
import type { PaymentApproval } from '../types';

interface ExecutePaymentsProps {
  approvals: PaymentApproval[];
  currentUserId?: string;
  onExecute?: (id: string) => void;
}

type ApprovalRow = Record<string, unknown> & PaymentApproval;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ExecutePayments({ approvals, currentUserId, onExecute }: ExecutePaymentsProps) {
  const [localApprovals, setLocalApprovals] = useState<PaymentApproval[]>(approvals);

  // Only show payments approved and pending execution
  const executable = localApprovals.filter((a) => a.status === 'APPROVED_PENDING_EXECUTION');

  const handleExecute = (id: string, approverId?: string) => {
    // Enforce separation of duties: executor cannot be the same as approver
    if (currentUserId && approverId && currentUserId === approverId) return;
    setLocalApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'EXECUTED', executorId: currentUserId } : a))
    );
    onExecute?.(id);
  };

  const columns: TableColumn<ApprovalRow>[] = [
    {
      key: 'projectName',
      header: 'Project',
      sortable: true,
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900 text-sm">{String(row.projectName)}</div>
          <div className="text-xs text-gray-400">{String(row.projectId)}</div>
        </div>
      ),
    },
    { key: 'clientName', header: 'Client', sortable: true },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (_, row) => (
        <span className="font-semibold text-gray-800">
          {formatCurrency(Number(row.amount), String(row.currency))}
        </span>
      ),
    },
    {
      key: 'approverName',
      header: 'Approved By',
      render: (val) => <span className="text-sm text-gray-600">{String(val ?? '—')}</span>,
    },
    {
      key: 'approvedAt',
      header: 'Approved On',
      sortable: true,
      render: (val) => (
        <span className="text-sm text-gray-500">{val ? formatDate(String(val)) : '—'}</span>
      ),
    },
    { key: 'purpose', header: 'Purpose',
      render: (val) => (
        <span className="text-xs text-gray-500 max-w-xs truncate block" title={String(val)}>
          {String(val)}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Action',
      render: (_, row) => {
        const id = String(row.id);
        const approverId = row.approverId ? String(row.approverId) : undefined;
        const isSameUser = currentUserId && approverId && currentUserId === approverId;

        return isSameUser ? (
          <StatusIndicator
            status="warning"
            label="Cannot execute own approval"
            size="sm"
          />
        ) : (
          <button
            onClick={() => handleExecute(id, approverId)}
            aria-label={`Execute payment for ${row.projectName}`}
            className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Execute
          </button>
        );
      },
    },
  ];

  return (
    <section aria-label="Approved payments pending execution">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Execute Approved Payments
        {executable.length > 0 && (
          <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {executable.length} ready
          </span>
        )}
      </h2>
      <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800" role="note">
        Separation of duties enforced: the user who approved a payment cannot execute it.
      </div>
      <Card variant="default" padding="none">
        <Table<ApprovalRow>
          columns={columns}
          data={executable as ApprovalRow[]}
          rowKey="id"
          emptyMessage="No approved payments pending execution."
          caption="Approved payments ready for EA execution"
        />
      </Card>
    </section>
  );
}

export default ExecutePayments;
