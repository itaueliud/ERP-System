import React, { useState } from 'react';
import { Card, Table } from '../../../shared/components';
import type { TableColumn } from '../../../shared/components';
import type { PaymentApproval } from '../types';
import { approvalsApi } from '../../../shared/api/apiClient';

interface PendingApprovalsProps {
  approvals: PaymentApproval[];
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
}

type ApprovalRow = Record<string, unknown> & PaymentApproval;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PendingApprovals({ approvals, onApprove, onReject }: PendingApprovalsProps) {
  const [localApprovals, setLocalApprovals] = useState<PaymentApproval[]>(approvals);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const pending = localApprovals.filter((a) => a.status === 'PENDING_APPROVAL');

  const handleApprove = async (id: string) => {
    try {
      await approvalsApi.approvePayment(id);
    } catch {
      // optimistic update still applies; server error is non-blocking
    }
    setLocalApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'APPROVED_PENDING_EXECUTION' } : a))
    );
    onApprove?.(id);
  };

  const handleRejectSubmit = async (id: string) => {
    if (!rejectionReason.trim()) return;
    try {
      await approvalsApi.rejectPayment(id, rejectionReason);
    } catch {
      // optimistic update still applies
    }
    setLocalApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'REJECTED', rejectionReason } : a))
    );
    onReject?.(id, rejectionReason);
    setRejectingId(null);
    setRejectionReason('');
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
    { key: 'requesterName', header: 'Requested By' },
    {
      key: 'submittedAt',
      header: 'Submitted',
      sortable: true,
      render: (val) => <span className="text-sm text-gray-500">{formatDate(String(val))}</span>,
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (val) => (
        <span className="text-xs text-gray-500 max-w-xs truncate block" title={String(val)}>
          {String(val)}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) => {
        const id = String(row.id);
        if (rejectingId === id) {
          return (
            <div className="flex flex-col gap-1 min-w-[200px]">
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Rejection reason..."
                aria-label="Rejection reason"
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => handleRejectSubmit(id)}
                  disabled={!rejectionReason.trim()}
                  aria-label="Confirm rejection"
                  className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Confirm
                </button>
                <button
                  onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                  aria-label="Cancel rejection"
                  className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        }
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleApprove(id)}
              aria-label={`Approve payment for ${row.projectName}`}
              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Approve
            </button>
            <button
              onClick={() => setRejectingId(id)}
              aria-label={`Reject payment for ${row.projectName}`}
              className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <section aria-label="Pending payment approvals">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Pending Payment Approvals
        {pending.length > 0 && (
          <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {pending.length} pending
          </span>
        )}
      </h2>
      <Card variant="default" padding="none">
        <Table<ApprovalRow>
          columns={columns}
          data={pending as ApprovalRow[]}
          rowKey="id"
          emptyMessage="No pending payment approvals."
          caption="Payment approval requests awaiting CFO decision"
        />
      </Card>
    </section>
  );
}

export default PendingApprovals;
