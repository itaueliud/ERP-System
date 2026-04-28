import { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PortalButton, SectionHeader } from '../../../shared/components/layout/PortalLayout';

interface BudgetRequest {
  id: string;
  purpose: string;
  amount: number;
  currency: string;
  status: string;
  requesterId: string;
  requesterName?: string;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export default function BudgetRequests({ themeHex }: { themeHex: string }) {
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ purpose: '', amount: '', currency: 'KES' });
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get('/api/v1/budget-requests');
      setRequests(res.data?.requests || res.data?.data || res.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { loadRequests(); }, []);

  const handleSubmit = async () => {
    if (!form.purpose || !form.amount) {
      setMsgOk(false); setMsg('Purpose and amount are required'); return;
    }
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.post('/api/v1/budget-requests', {
        ...form,
        amount: parseFloat(form.amount)
      });
      setMsgOk(true); setMsg('Budget request submitted!');
      setForm({ purpose: '', amount: '', currency: 'KES' });
      setShowForm(false);
      loadRequests();
    } catch (err: any) {
      setMsgOk(false); setMsg(err?.response?.data?.error || 'Failed to submit request');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.post(`/api/v1/budget-requests/${id}/approve`);
      loadRequests();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.post(`/api/v1/budget-requests/${id}/reject`, { reason });
      loadRequests();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to reject');
    }
  };

  return (
    <div>
      <SectionHeader
        title="Budget Requests"
        subtitle="Submit and approve budget requests"
        action={
          <PortalButton color={themeHex} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'New Request'}
          </PortalButton>
        }
      />

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
          {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${msgOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Purpose *</label>
              <input type="text" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                placeholder="e.g. New equipment purchase"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount *</label>
              <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency *</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <PortalButton color={themeHex} fullWidth onClick={handleSubmit}>Submit Request</PortalButton>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading requests...</p>
      ) : (
        <DataTable
          columns={[
            { key: 'purpose', label: 'Purpose' },
            { key: 'amount', label: 'Amount', render: (v, r: any) => `${r.currency} ${Number(v).toLocaleString()}` },
            { key: 'requesterName', label: 'Requester', render: v => v || '—' },
            { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
            { key: 'createdAt', label: 'Requested', render: v => v ? new Date(v).toLocaleDateString() : '—' },
            { key: 'id', label: 'Actions', render: (id, row: any) => (
              row.status === 'PENDING' ? (
                <div className="flex gap-2">
                  <PortalButton size="sm" color={themeHex} onClick={() => handleApprove(id)}>Approve</PortalButton>
                  <PortalButton size="sm" variant="danger" onClick={() => handleReject(id)}>Reject</PortalButton>
                </div>
              ) : row.status === 'APPROVED' ? (
                <span className="text-xs text-green-600 font-semibold">✓ Approved</span>
              ) : (
                <span className="text-xs text-red-600 font-semibold">✗ Rejected</span>
              )
            )},
          ]}
          rows={requests}
          emptyMessage="No budget requests found"
        />
      )}
    </div>
  );
}
