import React, { useState } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';

const theme = PORTAL_THEMES.executive;
const cardCls = 'rounded-2xl p-5';
const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)' };
const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

const I = {
  overview: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  revenue: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  payment: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  tax: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>,
  finance: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>,
  audit: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  service: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  team: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  invite: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
  chat: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  notif: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  report: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  execute: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  contract: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  region: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  agent: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  ops: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  coord: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  visibility: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
};

// ─── Shared: Daily Report Form ────────────────────────────────────────────────
function DailyReportForm() {
  const [form, setForm] = useState({ accomplishments: '', challenges: '', tomorrowPlan: '', hoursWorked: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', { ...form, hoursWorked: parseFloat(form.hoursWorked) || undefined, reportDate: new Date().toISOString().split('T')[0] });
      setOk(true); setMsg('Report submitted!'); setForm({ accomplishments: '', challenges: '', tomorrowPlan: '', hoursWorked: '' });
    } catch (err: any) { setOk(false); setMsg(err?.response?.data?.error || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="max-w-2xl">
      {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
      <form onSubmit={submit} className={cardCls} style={cardStyle}>
        <div className="mb-4"><label className={labelCls}>Accomplishments *</label><textarea rows={3} required value={form.accomplishments} onChange={set('accomplishments')} className={`${inputCls} resize-none`} /></div>
        <div className="mb-4"><label className={labelCls}>Challenges</label><textarea rows={3} value={form.challenges} onChange={set('challenges')} className={`${inputCls} resize-none`} /></div>
        <div className="mb-4"><label className={labelCls}>Plan for tomorrow</label><textarea rows={3} value={form.tomorrowPlan} onChange={set('tomorrowPlan')} className={`${inputCls} resize-none`} /></div>
        <div className="mb-6"><label className={labelCls}>Hours worked</label><input type="number" min={0} max={24} value={form.hoursWorked} onChange={set('hoursWorked')} className={inputCls} /></div>
        <PortalButton color={theme.hex} fullWidth disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Report'}</PortalButton>
      </form>
    </div>
  );
}

// ─── Shared: Chat UI ──────────────────────────────────────────────────────────
function ChatSection() {
  const [messages, setMessages] = useState<{ from: string; text: string; time: string }[]>([]);
  const [input, setInput] = useState('');
  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { from: 'You', text: input.trim(), time: new Date().toLocaleTimeString() }]);
    setInput('');
  };
  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <div className={`${cardCls} min-h-64 flex flex-col gap-2`} style={cardStyle}>
        {messages.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No messages yet</p>}
        {messages.map((m, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-xs font-semibold text-gray-600 w-10 flex-shrink-0">{m.from}</span>
            <span className="text-sm text-gray-800 flex-1">{m.text}</span>
            <span className="text-xs text-gray-400">{m.time}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message…" className={`${inputCls} flex-1`} />
        <PortalButton color={theme.hex} onClick={send}>Send</PortalButton>
      </div>
    </div>
  );
}

// ─── Shared: Notifications ────────────────────────────────────────────────────
function NotificationsSection({ notifs }: { notifs: any[] }) {
  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {notifs.length === 0 && <p className="text-sm text-gray-400">No notifications</p>}
      {notifs.map((n: any, i: number) => (
        <div key={n.id || i} className={`${cardCls} flex items-start gap-3`} style={cardStyle}>
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-gray-300' : 'bg-blue-500'}`} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{n.title || n.message || 'Notification'}</p>
            {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
            <p className="text-xs text-gray-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared: Service Amounts ──────────────────────────────────────────────────
function ServiceAmountsSection({ amounts, refetch }: { amounts: any[]; refetch: () => void }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ newAmount: '', reason: '' });
  const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false);
  const submit = async (sa: any) => {
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post(`/api/v1/service-amounts/${sa.id}/propose`, { newAmount: parseFloat(form.newAmount), reason: form.reason });
      setOk(true); setMsg('Proposed for CEO approval'); setEditId(null); refetch();
    } catch (err: any) { setOk(false); setMsg(err?.response?.data?.error || 'Failed'); }
  };
  return (
    <div>
      <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">All changes require CEO approval.</div>
      {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
      <DataTable
        columns={[
          { key: 'serviceName', label: 'Service', render: (v, r: any) => v || r.name || '—' },
          { key: 'category', label: 'Category' },
          { key: 'currentAmount', label: 'Amount (KSh)', render: (v, r: any) => ((v || r.amount || 0)).toLocaleString() },
          { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v || 'ACTIVE'} /> },
          { key: 'id', label: 'Actions', render: (_v, row: any) => (
            editId === (row.id || row.serviceName) ? (
              <div className="flex gap-2 items-center">
                <input type="number" placeholder="New amount" value={form.newAmount} onChange={e => setForm(f => ({ ...f, newAmount: e.target.value }))} className="w-28 px-2 py-1 rounded-lg border border-gray-200 text-xs" />
                <input placeholder="Reason" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="w-32 px-2 py-1 rounded-lg border border-gray-200 text-xs" />
                <PortalButton size="sm" color={theme.hex} onClick={() => submit(row)}>Save</PortalButton>
                <PortalButton size="sm" variant="secondary" onClick={() => setEditId(null)}>Cancel</PortalButton>
              </div>
            ) : (
              <PortalButton size="sm" color={theme.hex} onClick={() => { setEditId(row.id || row.serviceName); setForm({ newAmount: '', reason: '' }); }}>Edit</PortalButton>
            )
          )},
        ]}
        rows={amounts}
        emptyMessage="No service amounts configured"
      />
    </div>
  );
}


// ─── CFO Dashboard ────────────────────────────────────────────────────────────
const CFO_NAV = [
  { id: 'overview', label: 'Overview', icon: I.overview },
  { id: 'revenue', label: 'Revenue Collection', icon: I.revenue },
  { id: 'payments', label: 'Payment Management', icon: I.payment },
  { id: 'tax', label: 'Tax & Compliance', icon: I.tax },
  { id: 'finance-module', label: 'Finance Module', icon: I.finance },
  { id: 'anti-corruption', label: 'Anti-Corruption', icon: I.audit },
  { id: 'service-amounts', label: 'Service Amounts', icon: I.service },
  { id: 'cfo-assistants', label: 'CFO Assistants', icon: I.team },
  { id: 'invite-users', label: 'Invite Users', icon: I.invite },
  { id: 'chat', label: 'Chat', icon: I.chat },
  { id: 'notifications', label: 'Notifications', icon: I.notif },
  { id: 'daily-report', label: 'Daily Report', icon: I.report },
];

function CFODashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: string[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [revenueTab, setRevenueTab] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [totRate, setTotRate] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState(''); const [inviteOk, setInviteOk] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; time: string }[]>([]);

  const fs = data.financialSummary || {};
  const payments = data.payments || [];
  const taxRecords = data.taxRecords || [];
  const payeRecords = data.payeRecords || [];
  const auditTrail = data.auditTrail || [];
  const ledger = data.ledger || [];
  const invoices = data.invoices || [];
  const assistants = data.assistants || [];
  const notifs = data.notifications || [];
  const serviceAmounts = data.serviceAmounts || [];
  const pending = payments.filter((p: any) => p.status === 'PENDING_APPROVAL' || p.status === 'PENDING');

  const nav = CFO_NAV.map(n => n.id === 'notifications' ? { ...n, badge: notifs.filter((x: any) => !x.read).length } : n);

  const approvePayment = async (id: string) => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/payments/approvals/${id}/approve`, {}); refetch(['payments']); } catch { /* silent */ }
  };
  const rejectPayment = async (id: string) => {
    const reason = prompt('Rejection reason:'); if (!reason) return;
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/payments/approvals/${id}/reject`, { reason }); refetch(['payments']); } catch { /* silent */ }
  };

  return (
    <PortalLayout theme={theme} user={{ name: user?.name || 'CFO', email: user?.email || '', role: 'CFO' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout}>

      {section === 'overview' && (
        <div>
          <SectionHeader title="CFO Overview" subtitle="Financial health at a glance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Revenue" value={fs.totalRevenue ? `KSh ${(fs.totalRevenue / 1e6).toFixed(1)}M` : '—'} icon={I.revenue} color={theme.hex} />
            <StatCard label="Payments Pending" value={pending.length} icon={I.payment} color={theme.hex} />
            <StatCard label="Executed This Month" value={fs.executedThisMonth ?? '—'} icon={I.execute} color={theme.hex} />
            <StatCard label="Tax Filing Status" value={fs.taxFilingStatus || 'Up to date'} icon={I.tax} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'revenue' && (
        <div>
          <SectionHeader title="Revenue Collection" subtitle="Revenue across all platforms" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[{ name: 'TST PlotConnect', key: 'plotconnect' }, { name: 'CashFlow Connect', key: 'cashflow' }, { name: 'TST Billing System', key: 'billing' }].map(p => (
              <div key={p.key} className={cardCls} style={cardStyle}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{p.name}</p>
                <p className="text-2xl font-bold text-gray-800">KSh {((fs[p.key + 'Revenue'] || 0) / 1e6).toFixed(2)}M</p>
                <p className="text-xs text-gray-400 mt-1">This month</p>
              </div>
            ))}
          </div>
          <div className={cardCls} style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Revenue Chart</h3>
              <div className="flex gap-1">
                {(['daily', 'weekly', 'monthly'] as const).map(t => (
                  <button key={t} onClick={() => setRevenueTab(t)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${revenueTab === t ? 'text-white' : 'text-gray-500 bg-gray-100'}`} style={revenueTab === t ? { background: theme.hex } : {}}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-40 flex items-end gap-2">
              {Array.from({ length: revenueTab === 'daily' ? 7 : revenueTab === 'weekly' ? 4 : 12 }, (_, i) => (
                <div key={i} className="flex-1 rounded-t-lg transition-all" style={{ height: `${20 + Math.random() * 80}%`, background: `linear-gradient(to top, ${theme.hex}cc, ${theme.hex}44)` }} />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              {revenueTab === 'daily' && ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}
              {revenueTab === 'weekly' && ['Wk1','Wk2','Wk3','Wk4'].map(d => <span key={d}>{d}</span>)}
              {revenueTab === 'monthly' && ['J','F','M','A','M','J','J','A','S','O','N','D'].map(d => <span key={d}>{d}</span>)}
            </div>
          </div>
        </div>
      )}

      {section === 'payments' && (
        <div>
          <SectionHeader title="Payment Management" subtitle="Review, comment, and approve payment requests" />
          <DataTable
            columns={[
              { key: 'purpose', label: 'Purpose' },
              { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
              { key: 'requesterId', label: 'Requester' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'id', label: 'Actions', render: (_v, row: any) => (
                <div className="flex gap-2">
                  <PortalButton size="sm" color={theme.hex} onClick={() => approvePayment(row.id)}>Approve</PortalButton>
                  <PortalButton size="sm" variant="danger" onClick={() => rejectPayment(row.id)}>Reject</PortalButton>
                </div>
              )},
            ]}
            rows={pending}
            emptyMessage="No pending payment requests"
          />
          <div className="mt-6">
            <SectionHeader title="Payment History" />
            <DataTable
              columns={[
                { key: 'purpose', label: 'Purpose' },
                { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
                { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'COMPLETED'} /> },
                { key: 'updatedAt', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              ]}
              rows={payments.filter((p: any) => p.status !== 'PENDING_APPROVAL' && p.status !== 'PENDING')}
              emptyMessage="No payment history"
            />
          </div>
        </div>
      )}

      {section === 'tax' && (
        <div>
          <SectionHeader title="Tax & Compliance" subtitle="TOT/VAT, PAYE, NSSF, and contract reviews" />
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">TOT / VAT Filing Records</h3>
            <DataTable columns={[{ key: 'period', label: 'Period' }, { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'FILED'} /> }, { key: 'filedAt', label: 'Filed', render: v => v ? new Date(v).toLocaleDateString() : '—' }]} rows={taxRecords} emptyMessage="No TOT/VAT records" />
          </div>
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">PAYE & NSSF Records</h3>
            <DataTable columns={[{ key: 'period', label: 'Period' }, { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'FILED'} /> }]} rows={payeRecords} emptyMessage="No PAYE/NSSF records" />
          </div>
          <PortalButton color={theme.hex} icon={I.report} onClick={async () => { try { const { apiClient } = await import('../../shared/api/apiClient'); const r = await apiClient.get('/api/v1/reports/tax/generate'); if ((r.data as any)?.url) window.open((r.data as any).url, '_blank'); } catch { /* silent */ } }}>Generate Tax Report</PortalButton>
        </div>
      )}

      {section === 'finance-module' && (
        <div>
          <SectionHeader title="Finance Module" subtitle="Accounting ledger, ToT settings, and invoices" />
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Accounting Ledger</h3>
            <DataTable columns={[{ key: 'date', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' }, { key: 'description', label: 'Description' }, { key: 'debit', label: 'Debit (KSh)', render: v => v ? (v).toLocaleString() : '—' }, { key: 'credit', label: 'Credit (KSh)', render: v => v ? (v).toLocaleString() : '—' }, { key: 'balance', label: 'Balance', render: v => v ? (v).toLocaleString() : '—' }]} rows={ledger} emptyMessage="No ledger entries" />
          </div>
          <div className="mb-6 max-w-sm">
            <h3 className="font-semibold text-gray-700 mb-3">ToT Percentage Setting</h3>
            <div className={cardCls} style={cardStyle}>
              <label className={labelCls}>ToT Rate (%)</label>
              <div className="flex gap-2">
                <input type="number" min={0} max={100} step={0.1} value={totRate} onChange={e => setTotRate(e.target.value)} className={inputCls} placeholder="e.g. 1.5" />
                <PortalButton color={theme.hex} onClick={async () => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.put('/api/v1/finance/tot-rate', { rate: parseFloat(totRate) }); } catch { /* silent */ } }}>Save</PortalButton>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Invoice Management</h3>
            <DataTable columns={[{ key: 'invoiceNumber', label: 'Invoice #' }, { key: 'client', label: 'Client' }, { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'DRAFT'} /> }, { key: 'dueDate', label: 'Due', render: v => v ? new Date(v).toLocaleDateString() : '—' }]} rows={invoices} emptyMessage="No invoices" />
          </div>
        </div>
      )}

      {section === 'anti-corruption' && (
        <div>
          <SectionHeader title="Anti-Corruption" subtitle="Audit trail, cross-check alerts, and fraud flags" />
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Audit Trail</h3>
            <DataTable columns={[{ key: 'user', label: 'User' }, { key: 'action', label: 'Action' }, { key: 'timestamp', label: 'Timestamp', render: v => v ? new Date(v).toLocaleString() : '—' }, { key: 'oldValue', label: 'Old Value' }, { key: 'newValue', label: 'New Value' }]} rows={auditTrail} emptyMessage="No audit records" />
          </div>
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Cross-Check Alerts</h3>
            <div className="flex flex-col gap-2">
              {(data.crossCheckAlerts || []).length === 0 && <p className="text-sm text-gray-400">No alerts</p>}
              {(data.crossCheckAlerts || []).map((a: any, i: number) => (
                <div key={i} className={`${cardCls} flex items-center gap-3`} style={cardStyle}>
                  <span className="text-amber-500">⚠</span>
                  <span className="text-sm text-gray-700">{a.message || a.description || 'Alert'}</span>
                  <StatusBadge status={a.severity || 'PENDING'} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Fraud Flag Reports</h3>
            <DataTable columns={[{ key: 'flaggedBy', label: 'Flagged By' }, { key: 'description', label: 'Description' }, { key: 'severity', label: 'Severity', render: v => <StatusBadge status={v || 'PENDING'} /> }, { key: 'createdAt', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' }]} rows={data.fraudFlags || []} emptyMessage="No fraud flags" />
          </div>
        </div>
      )}

      {section === 'service-amounts' && (
        <div>
          <SectionHeader title="Service Amounts" subtitle="Configure service pricing — requires CEO approval" />
          <ServiceAmountsSection amounts={serviceAmounts} refetch={() => refetch(['serviceAmounts'])} />
        </div>
      )}

      {section === 'cfo-assistants' && (
        <div>
          <SectionHeader title="CFO Assistants" subtitle="Manage your assistants (max 3)" />
          <div className="flex flex-col gap-3 max-w-lg mb-6">
            {assistants.slice(0, 3).map((a: any, i: number) => (
              <div key={a.id || i} className={`${cardCls} flex items-center justify-between`} style={cardStyle}>
                <div>
                  <p className="font-medium text-gray-800">{a.name || a.email}</p>
                  <p className="text-xs text-gray-500">{a.email}</p>
                </div>
                <PortalButton size="sm" variant="danger" onClick={async () => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.delete(`/api/v1/users/${a.id}`); refetch(['assistants']); } catch { /* silent */ } }}>Remove</PortalButton>
              </div>
            ))}
            {assistants.length === 0 && <p className="text-sm text-gray-400">No assistants added yet</p>}
          </div>
        </div>
      )}

      {section === 'invite-users' && (
        <div>
          <SectionHeader title="Invite Users" subtitle="Invite a CFO Assistant by email" />
          <div className="max-w-md">
            {inviteMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${inviteOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{inviteMsg}</div>}
            <div className={cardCls} style={cardStyle}>
              <label className={labelCls}>Email address</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className={`${inputCls} mb-4`} placeholder="assistant@example.com" />
              <PortalButton color={theme.hex} fullWidth onClick={async () => {
                if (!inviteEmail) return;
                try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post('/api/v1/invitations', { email: inviteEmail, role: 'CFO_ASSISTANT' }); setInviteOk(true); setInviteMsg('Invitation sent!'); setInviteEmail(''); }
                catch (err: any) { setInviteOk(false); setInviteMsg(err?.response?.data?.error || 'Failed to send invitation'); }
              }}>Send Invitation</PortalButton>
            </div>
          </div>
        </div>
      )}

      {section === 'chat' && (<div><SectionHeader title="Chat" /><ChatSection /></div>)}
      {section === 'notifications' && (<div><SectionHeader title="Notifications" /><NotificationsSection notifs={notifs} /></div>)}
      {section === 'daily-report' && (<div><SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" /><DailyReportForm /></div>)}
    </PortalLayout>
  );
}


// ─── CoS Dashboard ────────────────────────────────────────────────────────────
const COS_NAV = [
  { id: 'overview', label: 'Overview', icon: I.overview },
  { id: 'financial-visibility', label: 'Financial Visibility', icon: I.visibility },
  { id: 'operations-visibility', label: 'Operations Visibility', icon: I.ops },
  { id: 'coordination', label: 'Coordination Tools', icon: I.coord },
  { id: 'service-amounts', label: 'Service Amounts', icon: I.service },
  { id: 'chat', label: 'Chat', icon: I.chat },
  { id: 'notifications', label: 'Notifications', icon: I.notif },
  { id: 'daily-report', label: 'Daily Report', icon: I.report },
];

function CoSDashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: string[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const fs = data.financialSummary || {};
  const notifs = data.notifications || [];
  const serviceAmounts = data.serviceAmounts || [];
  const trainers = data.trainers || [];
  const agents = data.agents || [];
  const cooAchievements = data.cooAchievements || [];
  const budgetRequests = data.budgetRequests || [];
  const techRequests = data.techRequests || [];
  const plData = data.plData || [];
  const taxReports = data.taxReports || [];
  const cashFlow = data.cashFlow || [];

  const nav = COS_NAV.map(n => n.id === 'notifications' ? { ...n, badge: notifs.filter((x: any) => !x.read).length } : n);

  const handleBudget = async (id: string, action: 'approve' | 'reject') => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/budget-requests/${id}/${action}`, {}); refetch(['budgetRequests']); } catch { /* silent */ }
  };

  return (
    <PortalLayout theme={theme} user={{ name: user?.name || 'CoS', email: user?.email || '', role: 'Chief of Staff' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout}>

      {section === 'overview' && (
        <div>
          <SectionHeader title="CoS Overview" subtitle="Company-wide performance snapshot" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={fs.totalRevenue ? `KSh ${(fs.totalRevenue / 1e6).toFixed(1)}M` : '—'} icon={I.revenue} color={theme.hex} />
            <StatCard label="Closed Deals This Month" value={fs.closedDealsThisMonth ?? '—'} icon={I.agent} color={theme.hex} />
            <StatCard label="Active Leads" value={fs.activeLeads ?? '—'} icon={I.overview} color={theme.hex} />
            <StatCard label="Best Performing Agents" value={fs.topAgentsCount ?? '—'} icon={I.team} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'financial-visibility' && (
        <div>
          <SectionHeader title="Financial Visibility" subtitle="Revenue, P&L, tax, and cash flow" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className={cardCls} style={cardStyle}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-800">KSh {((fs.totalRevenue || 0) / 1e6).toFixed(2)}M</p>
            </div>
            <div className={cardCls} style={cardStyle}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Daily Cash Flow</p>
              <p className="text-2xl font-bold text-gray-800">KSh {((fs.dailyCashFlow || 0) / 1e3).toFixed(1)}K</p>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Monthly P&L</h3>
            <DataTable columns={[{ key: 'month', label: 'Month' }, { key: 'revenue', label: 'Revenue (KSh)', render: v => (v || 0).toLocaleString() }, { key: 'expenses', label: 'Expenses (KSh)', render: v => (v || 0).toLocaleString() }, { key: 'profit', label: 'Profit (KSh)', render: v => (v || 0).toLocaleString() }]} rows={plData} emptyMessage="No P&L data" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Tax Reports</h3>
            <DataTable columns={[{ key: 'period', label: 'Period' }, { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'FILED'} /> }]} rows={taxReports} emptyMessage="No tax reports" />
          </div>
        </div>
      )}

      {section === 'operations-visibility' && (
        <div>
          <SectionHeader title="Operations Visibility" subtitle="Trainer and agent performance across regions" />
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Trainer Performance</h3>
            <DataTable columns={[{ key: 'name', label: 'Trainer' }, { key: 'country', label: 'Country' }, { key: 'agentsCount', label: 'Agents' }, { key: 'performanceScore', label: 'Score', render: v => v ? `${v}%` : '—' }]} rows={trainers} emptyMessage="No trainer data" />
          </div>
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Agent Performance</h3>
            <DataTable columns={[{ key: 'name', label: 'Agent' }, { key: 'region', label: 'Region' }, { key: 'deals', label: 'Deals' }, { key: 'leads', label: 'Leads' }]} rows={agents} emptyMessage="No agent data" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">COO Achievements by Country</h3>
            <DataTable columns={[{ key: 'country', label: 'Country' }, { key: 'achievement', label: 'Achievement' }, { key: 'value', label: 'Value' }, { key: 'period', label: 'Period' }]} rows={cooAchievements} emptyMessage="No COO achievements" />
          </div>
        </div>
      )}

      {section === 'coordination' && (
        <div>
          <SectionHeader title="Coordination Tools" subtitle="Budget and tech funding approvals" />
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Budget Requests (COO / CTO)</h3>
            <DataTable
              columns={[
                { key: 'requester', label: 'Requester' },
                { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
                { key: 'purpose', label: 'Purpose' },
                { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
                { key: 'id', label: 'Actions', render: (_v, row: any) => (
                  <div className="flex gap-2">
                    <PortalButton size="sm" color={theme.hex} onClick={() => handleBudget(row.id, 'approve')}>Approve</PortalButton>
                    <PortalButton size="sm" variant="danger" onClick={() => handleBudget(row.id, 'reject')}>Reject</PortalButton>
                  </div>
                )},
              ]}
              rows={budgetRequests}
              emptyMessage="No budget requests"
            />
          </div>
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Tech Funding Requests</h3>
            <DataTable columns={[{ key: 'project', label: 'Project' }, { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> }]} rows={techRequests} emptyMessage="No tech funding requests" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Cost Approval Tracking</h3>
            <DataTable columns={[{ key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() }, { key: 'approvedBy', label: 'Approved By' }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'APPROVED'} /> }]} rows={data.costApprovals || []} emptyMessage="No cost approvals" />
          </div>
        </div>
      )}

      {section === 'service-amounts' && (
        <div>
          <SectionHeader title="Service Amounts" subtitle="View and propose service pricing changes" />
          <ServiceAmountsSection amounts={serviceAmounts} refetch={() => refetch(['serviceAmounts'])} />
        </div>
      )}

      {section === 'chat' && (<div><SectionHeader title="Chat" /><ChatSection /></div>)}
      {section === 'notifications' && (<div><SectionHeader title="Notifications" /><NotificationsSection notifs={notifs} /></div>)}
      {section === 'daily-report' && (<div><SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" /><DailyReportForm /></div>)}
    </PortalLayout>
  );
}


// ─── EA Dashboard ─────────────────────────────────────────────────────────────
const EA_NAV = [
  { id: 'overview', label: 'Overview', icon: I.overview },
  { id: 'payment-execution', label: 'Payment Execution', icon: I.execute },
  { id: 'contract-generator', label: 'Contract Generator', icon: I.contract },
  { id: 'region-country', label: 'Region & Country', icon: I.region },
  { id: 'agent-performance', label: 'Agent Performance', icon: I.agent },
  { id: 'service-amounts', label: 'Service Amounts', icon: I.service },
  { id: 'chat', label: 'Chat', icon: I.chat },
  { id: 'notifications', label: 'Notifications', icon: I.notif },
];

const AFRICAN_COUNTRIES = ['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Congo','DR Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Ivory Coast','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','São Tomé and Príncipe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'];

function EADashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: string[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [contractForm, setContractForm] = useState({ developerTeam: '', project: '', amount: '', date: '', stamp: null as File | null });
  const [contractMsg, setContractMsg] = useState(''); const [contractOk, setContractOk] = useState(false);
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [regionForm, setRegionForm] = useState({ name: '' });
  const [countryForm, setCountryForm] = useState({ name: '', region: '' });
  const [regionMsg, setRegionMsg] = useState('');

  const notifs = data.notifications || [];
  const serviceAmounts = data.serviceAmounts || [];
  const approvedPayments = (data.payments || []).filter((p: any) => p.status === 'APPROVED' || p.status === 'APPROVED_PENDING_EXECUTION');
  const regions = data.regions || [];
  const agents = data.agents || [];
  const pendingContracts = data.contracts || [];

  const nav = EA_NAV.map(n => n.id === 'notifications' ? { ...n, badge: notifs.filter((x: any) => !x.read).length } : n);

  const executePayment = async (id: string) => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/payments/approvals/${id}/execute`, { paymentDetails: { method: 'BANK_TRANSFER' } }); refetch(['payments']); } catch { /* silent */ }
  };

  const generateContract = async (e: React.FormEvent) => {
    e.preventDefault(); setContractSubmitting(true); setContractMsg('');
    try {
      const fd = new FormData();
      fd.append('developerTeam', contractForm.developerTeam);
      fd.append('project', contractForm.project);
      fd.append('amount', contractForm.amount);
      fd.append('date', contractForm.date);
      if (contractForm.stamp) fd.append('stamp', contractForm.stamp);
      const { apiClient } = await import('../../shared/api/apiClient');
      const res = await apiClient.post('/api/v1/contracts/generate-direct', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setContractOk(true); setContractMsg('Contract generated!');
      if ((res.data as any)?.downloadUrl) window.open((res.data as any).downloadUrl, '_blank');
      refetch(['contracts']);
    } catch (err: any) { setContractOk(false); setContractMsg(err?.response?.data?.error || 'Failed to generate contract'); }
    finally { setContractSubmitting(false); }
  };

  return (
    <PortalLayout theme={theme} user={{ name: user?.name || 'EA', email: user?.email || '', role: 'Executive Assistant' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout}>

      {section === 'overview' && (
        <div>
          <SectionHeader title="EA Overview" subtitle="Your pending tasks at a glance" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Payments to Execute" value={approvedPayments.length} icon={I.execute} color={theme.hex} />
            <StatCard label="Contracts to Generate" value={pendingContracts.filter((c: any) => c.status === 'PENDING').length} icon={I.contract} color={theme.hex} />
            <StatCard label="Upcoming Admin Tasks" value={data.adminTasks?.length ?? 0} icon={I.overview} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'payment-execution' && (
        <div>
          <SectionHeader title="Payment Execution" subtitle="Execute CFO-approved payments" />
          <DataTable
            columns={[
              { key: 'purpose', label: 'Purpose' },
              { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
              { key: 'approvedAt', label: 'Approved', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'APPROVED'} /> },
              { key: 'id', label: 'Actions', render: (_v, row: any) => (
                <PortalButton size="sm" color={theme.hex} icon={I.execute} onClick={() => executePayment(row.id)}>Execute Payment</PortalButton>
              )},
            ]}
            rows={approvedPayments}
            emptyMessage="No approved payments awaiting execution"
          />
        </div>
      )}

      {section === 'contract-generator' && (
        <div>
          <SectionHeader title="Contract Generator" subtitle="Generate contracts directly" />
          {contractMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${contractOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{contractMsg}</div>}
          <form onSubmit={generateContract} className={`${cardCls} max-w-lg`} style={cardStyle}>
            <div className="mb-4"><label className={labelCls}>Developer / Team Name *</label><input required value={contractForm.developerTeam} onChange={e => setContractForm(f => ({ ...f, developerTeam: e.target.value }))} className={inputCls} /></div>
            <div className="mb-4"><label className={labelCls}>Project Assigned *</label><input required value={contractForm.project} onChange={e => setContractForm(f => ({ ...f, project: e.target.value }))} className={inputCls} /></div>
            <div className="mb-4"><label className={labelCls}>Amount (KSh) *</label><input type="number" required min={0} value={contractForm.amount} onChange={e => setContractForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} /></div>
            <div className="mb-4"><label className={labelCls}>Date *</label><input type="date" required value={contractForm.date} onChange={e => setContractForm(f => ({ ...f, date: e.target.value }))} className={inputCls} /></div>
            <div className="mb-6">
              <label className={labelCls}>Stamp (PNG)</label>
              <input type="file" accept="image/png" onChange={e => setContractForm(f => ({ ...f, stamp: e.target.files?.[0] || null }))} className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700" />
            </div>
            <PortalButton color={theme.hex} fullWidth disabled={contractSubmitting}>{contractSubmitting ? 'Generating…' : 'Generate Contract'}</PortalButton>
          </form>
        </div>
      )}

      {section === 'region-country' && (
        <div>
          <SectionHeader title="Region & Country Management" subtitle="Manage African regions and countries" />
          {regionMsg && <div className="p-3 rounded-xl text-sm mb-4 bg-green-50 text-green-700">{regionMsg}</div>}
          <div className="mb-6">
            <DataTable columns={[{ key: 'name', label: 'Region / Country' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'ACTIVE'} /> }]} rows={regions} emptyMessage="No regions/countries configured" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={cardCls} style={cardStyle}>
              <h3 className="font-semibold text-gray-700 mb-3">Add Region</h3>
              <label className={labelCls}>Region Name</label>
              <input value={regionForm.name} onChange={e => setRegionForm({ name: e.target.value })} className={`${inputCls} mb-3`} placeholder="e.g. East Africa" />
              <PortalButton color={theme.hex} onClick={async () => {
                if (!regionForm.name) return;
                try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post('/api/v1/regions', { name: regionForm.name }); setRegionMsg('Region added!'); setRegionForm({ name: '' }); refetch(['regions']); } catch { /* silent */ }
              }}>Add Region</PortalButton>
            </div>
            <div className={cardCls} style={cardStyle}>
              <h3 className="font-semibold text-gray-700 mb-3">Add Country</h3>
              <label className={labelCls}>Country</label>
              <select value={countryForm.name} onChange={e => setCountryForm(f => ({ ...f, name: e.target.value }))} className={`${inputCls} mb-3`}>
                <option value="">Select country…</option>
                {AFRICAN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className={labelCls}>Region</label>
              <select value={countryForm.region} onChange={e => setCountryForm(f => ({ ...f, region: e.target.value }))} className={`${inputCls} mb-3`}>
                <option value="">Select region…</option>
                {regions.map((r: any) => <option key={r.id || r.name} value={r.id || r.name}>{r.name}</option>)}
              </select>
              <PortalButton color={theme.hex} onClick={async () => {
                if (!countryForm.name || !countryForm.region) return;
                try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post('/api/v1/countries', { name: countryForm.name, regionId: countryForm.region }); setRegionMsg('Country added!'); setCountryForm({ name: '', region: '' }); refetch(['regions']); } catch { /* silent */ }
              }}>Add Country</PortalButton>
            </div>
          </div>
        </div>
      )}

      {section === 'agent-performance' && (
        <div>
          <SectionHeader title="Agent Performance" subtitle="Best agents across all regions" />
          <DataTable columns={[{ key: 'name', label: 'Agent' }, { key: 'region', label: 'Region' }, { key: 'country', label: 'Country' }, { key: 'deals', label: 'Deals' }, { key: 'leads', label: 'Leads' }, { key: 'score', label: 'Score', render: v => v ? `${v}%` : '—' }]} rows={agents} emptyMessage="No agent data" />
        </div>
      )}

      {section === 'service-amounts' && (
        <div>
          <SectionHeader title="Service Amounts" subtitle="View and edit commitment, PlotConnect, and category amounts" />
          <ServiceAmountsSection amounts={serviceAmounts} refetch={() => refetch(['serviceAmounts'])} />
        </div>
      )}

      {section === 'chat' && (<div><SectionHeader title="Chat" /><ChatSection /></div>)}
      {section === 'notifications' && (<div><SectionHeader title="Notifications" /><NotificationsSection notifs={notifs} /></div>)}
    </PortalLayout>
  );
}


// ─── Main Entry ───────────────────────────────────────────────────────────────
export default function ExecutivePortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, refetch } = useMultiPortalData([
    { key: 'financialSummary',  endpoint: '/api/v1/dashboard/metrics',                 fallback: {} },
    { key: 'payments',          endpoint: '/api/v1/payments/approvals',                fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || r.approvals || []) },
    { key: 'taxRecords',        endpoint: '/api/v1/reports/tax',                       fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'payeRecords',       endpoint: '/api/v1/reports/paye',                      fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'auditTrail',        endpoint: '/api/v1/audit/trail',                       fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'crossCheckAlerts',  endpoint: '/api/v1/audit/alerts',                      fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'fraudFlags',        endpoint: '/api/v1/audit/fraud-flags',                 fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'ledger',            endpoint: '/api/v1/finance/ledger',                    fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'invoices',          endpoint: '/api/v1/finance/invoices',                  fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'assistants',        endpoint: '/api/v1/users?role=CFO_ASSISTANT',          fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'notifications',     endpoint: '/api/v1/notifications',                     fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'serviceAmounts',    endpoint: '/api/v1/service-amounts',                   fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'contracts',         endpoint: '/api/v1/contracts',                         fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'budgetRequests',    endpoint: '/api/v1/budget-requests',                   fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'techRequests',      endpoint: '/api/v1/tech-funding-requests',             fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'costApprovals',     endpoint: '/api/v1/cost-approvals',                    fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'plData',            endpoint: '/api/v1/reports/pl',                        fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'trainers',          endpoint: '/api/v1/trainers/performance',              fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'agents',            endpoint: '/api/v1/agents/performance',                fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'cooAchievements',   endpoint: '/api/v1/coo/achievements',                  fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'regions',           endpoint: '/api/v1/regions',                           fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'adminTasks',        endpoint: '/api/v1/admin-tasks',                       fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'cashFlow',          endpoint: '/api/v1/finance/cash-flow',                 fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
  ] as any);

  const handleLogout = () => { logout(); navigate('/login'); };
  const role = user?.role;

  // Wrap logout into each sub-dashboard via a patched user object
  const patchedUser = { ...user, logout: handleLogout };

  if (role === 'CFO' || role === 'CFO_ASSISTANT') {
    return <CFODashboard data={data as any} refetch={refetch as any} user={patchedUser} onLogout={handleLogout} />;
  }
  if (role === 'CoS') {
    return <CoSDashboard data={data as any} refetch={refetch as any} user={patchedUser} onLogout={handleLogout} />;
  }
  if (role === 'EA') {
    return <EADashboard data={data as any} refetch={refetch as any} user={patchedUser} onLogout={handleLogout} />;
  }

  // Fallback for unknown executive roles
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 100%)' }}>
      <div className={cardCls} style={{ ...cardStyle, maxWidth: 400, textAlign: 'center' }}>
        <p className="text-gray-600 mb-4">Your role <strong>{role || 'Unknown'}</strong> does not have an executive dashboard configured.</p>
        <PortalButton color={theme.hex} onClick={handleLogout}>Sign Out</PortalButton>
      </div>
    </div>
  );
}
