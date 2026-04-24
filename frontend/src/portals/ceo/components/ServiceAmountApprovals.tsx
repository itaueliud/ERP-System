import React, { useState } from 'react';
import { Card, Table } from '../../../shared/components';
import type { TableColumn } from '../../../shared/components';
import type { ServiceAmountApproval } from '../types';

interface ServiceAmountApprovalsProps {
  approvals: ServiceAmountApproval[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

type ApprovalRow = Record<string, unknown> & ServiceAmountApproval;

export function ServiceAmountApprovals({ approvals, onApprove, onReject }: ServiceAmountApprovalsProps) {
  const [localApprovals, setLocalApprovals] = useState<ServiceAmountApproval[]>(approvals);

  const handleApprove = (id: string) => {
    setLocalApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status: 'approved' } : a));
    onApprove?.(id);
  };

  const handleReject = (id: string) => {
    setLocalApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status: 'rejected' } : a));
    onReject?.(id);
  };

  const pending = localApprovals.filter((a) => a.status === 'pending');

  const columns: TableColumn<ApprovalRow>[] = [
    { key: 'clientName', header: 'Client', sortable: true },
    {
      key: 'originalAmount',
      header: 'Original',
      render: (_, row) => (
        <span className="text-gray-600">{row.currency} {Number(row.originalAmount).toLocaleString()}</span>
      ),
    },
    {
      key: 'requestedAmount',
      header: 'Requested',
      render: (_, row) => {
        const diff = Number(row.requestedAmount) - Number(row.originalAmount);
        return (
          <span className={diff > 0 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
            {row.currency} {Number(row.requestedAmount).toLocaleString()}
          </span>
        );
      },
    },
    { key: 'requester', header: 'Requester' },
    { key: 'dateSubmitted', header: 'Date', sortable: true },
    {
      key: 'justification',
      header: 'Justification',
      render: (val) => (
        <span className="text-gray-500 text-xs max-w-xs truncate block" title={String(val)}>{String(val)}</span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleApprove(String(row.id))}
            aria-label={`Approve service amount change for ${row.clientName}`}
            className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Approve
          </button>
          <button
            onClick={() => handleReject(String(row.id))}
            aria-label={`Reject service amount change for ${row.clientName}`}
            className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Reject
          </button>
        </div>
      ),
    },
  ];

  return (
    <section aria-label="Service amount change approvals">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Service Amount Approvals
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
          emptyMessage="No pending approvals."
          caption="Pending service amount change requests"
        />
      </Card>
    </section>
  );
}

export default ServiceAmountApprovals;
