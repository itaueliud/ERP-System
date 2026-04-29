import { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PortalButton, SectionHeader } from '../../../shared/components/layout/PortalLayout';

interface ExpenseReport {
  id: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  submitterId: string;
  submitterName?: string;
  createdAt: string;
  approvedAt?: string;
}

export default function ExpenseReports({ themeHex }: { themeHex: string }) {
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', currency: 'KES', description: '' });
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get('/api/v1/expense-reports');
      setReports(res.data?.reports || res.data?.data || res.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { loadReports(); }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.amount) {
      setMsgOk(false); setMsg('Title and amount are required'); return;
    }
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.post('/api/v1/expense-reports', { ...form, amount: parseFloat(form.amount) });
      setMsgOk(true); setMsg('Expense report submitted!');
      setForm({ title: '', amount: '', currency: 'KES', description: '' });
      setShowForm(false);
      loadReports();
    } catch (err: any) {
      setMsgOk(false); setMsg(err?.response?.data?.error || 'Failed to submit');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.post(`/api/v1/expense-reports/${id}/approve`);
      loadReports();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to approve');
    }
  };

  return (
    <div>
      <SectionHeader title="Expense Reports" subtitle="Submit and approve expense reports"
        action={<PortalButton color={themeHex} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New Report'}</PortalButton>} />
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
          {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${msgOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Amount *</label>
              <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Currency *</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                <option value="KES">KES</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
          </div><div className="mt-4"><PortalButton color={themeHex} fullWidth onClick={handleSubmit}>Submit Report</PortalButton></div>
        </div>
      )}
      {loading ? <p className="text-sm text-gray-400">Loading reports...</p> : (
        <DataTable columns={[
          { key: 'title', label: 'Title' },
          { key: 'amount', label: 'Amount', render: (v, r: any) => `${r.currency} ${Number(v).toLocaleString()}` },
          { key: 'submitterName', label: 'Submitter', render: v => v || '—' },
          { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
          { key: 'createdAt', label: 'Submitted', render: v => v ? new Date(v).toLocaleDateString() : '—' },
          { key: 'id', label: 'Actions', render: (id, row: any) => row.status === 'PENDING' ? (
            <PortalButton size="sm" color={themeHex} onClick={() => handleApprove(id)}>Approve</PortalButton>
          ) : <span className="text-xs text-green-600 font-semibold">✓ Approved</span>},
        ]} rows={reports} emptyMessage="No expense reports found" />
      )}
    </div>
  );
}
