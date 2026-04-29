import React, { useState, useEffect } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { PayoutDetailsManager } from '../../shared/components/admin/PayoutDetailsManager';
import { useMultiPortalData } from '../../shared/utils/usePortalData';
import { ContractGeneratorForm } from '../../shared/components/contracts/ContractGeneratorForm';
import ChatPanel from '../../shared/components/chat/ChatPanel';
import { EXECUTIVE_FAQS } from '../../shared/data/portalFAQs';
import PlotConnectProperties from '../../shared/components/plotconnect/PlotConnectProperties';
import { SandboxBanner } from '../../shared/components/payments/SandboxBanner';

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

// ─── Shared: Payment Approval Row ────────────────────────────────────────────
function ExecPaymentRow({ row, themeHex, currentUserId, onRefetch }: { row: any; themeHex: string; currentUserId?: string; onRefetch: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [execMethod, setExecMethod] = React.useState('BANK_TRANSFER');
  const [showExec, setShowExec] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const doAction = async (url: string, body: Record<string, unknown> = {}) => {
    setBusy(true); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post(url, body);
      onRefetch();
    } catch (err: any) { setMsg(err?.response?.data?.error || 'Action failed'); }
    finally { setBusy(false); }
  };

  const status = row.status || 'PENDING_APPROVAL';
  const isPending  = status === 'PENDING_APPROVAL';
  const isApproved = status === 'APPROVED_PENDING_EXECUTION';
  // Execute only available to the person who approved it
  const iApproved  = isApproved && (!row.approverId || row.approverId === currentUserId);

  const inputCls = 'px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none';

  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-gray-800">{row.purpose || '—'}</p>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-gray-500">
            <span className="font-medium">KSh {(row.amount || 0).toLocaleString()}</span>
            <span className="ml-2 text-gray-400">· {row.requesterName || row.requesterId || '—'}</span>
            {row.createdAt && <span className="ml-2 text-gray-400">· {new Date(row.createdAt).toLocaleDateString()}</span>}
          </p>
          {msg && <p className="text-xs text-red-500 mt-1">{msg}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {isPending && (
            <>
              <PortalButton size="sm" color={themeHex} disabled={busy}
                onClick={() => doAction(`/api/v1/payments/approvals/${row.id}/approve`)}>
                Approve
              </PortalButton>
              <PortalButton size="sm" variant="danger" disabled={busy}
                onClick={async () => {
                  const reason = prompt('Rejection reason (optional):') || 'Rejected';
                  await doAction(`/api/v1/payments/approvals/${row.id}/reject`, { reason });
                }}>
                Reject
              </PortalButton>
            </>
          )}
          {iApproved && !showExec && (
            <PortalButton size="sm" color={themeHex} disabled={busy}
              onClick={() => setShowExec(true)}>
              Execute
            </PortalButton>
          )}
          {isApproved && !iApproved && (
            <span className="text-xs text-gray-400 italic">Awaiting execution by approver</span>
          )}
        </div>
      </div>
      {iApproved && showExec && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
          <select value={execMethod} onChange={e => setExecMethod(e.target.value)} className={inputCls}>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="MPESA">M-Pesa</option>
            <option value="AIRTEL_MONEY">Airtel Money</option>
          </select>
          <PortalButton size="sm" color={themeHex} disabled={busy}
            onClick={() => doAction(`/api/v1/payments/approvals/${row.id}/execute`, {
              paymentDetails: { paymentMethod: execMethod }
            })}>
            {busy ? 'Executing…' : 'Confirm Execute'}
          </PortalButton>
          <PortalButton size="sm" variant="secondary" onClick={() => setShowExec(false)}>Cancel</PortalButton>
        </div>
      )}
    </div>
  );
}

// ─── Shared: Daily Report Form ────────────────────────────────────────────────
function DailyReportForm() {
  const [form, setForm] = useState({ accomplishments: '', challenges: '', tomorrowPlan: '', hoursWorked: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const clear = () => setForm({ accomplishments: '', challenges: '', tomorrowPlan: '', hoursWorked: '' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', { ...form, hoursWorked: parseFloat(form.hoursWorked) || undefined, reportDate: new Date().toISOString().split('T')[0] });
      setOk(true); setMsg('Report submitted!'); clear();
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
        <div className="flex gap-2">
          <PortalButton color={theme.hex} fullWidth disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Report'}</PortalButton>
          <PortalButton variant="secondary" onClick={clear} disabled={submitting}>Clear</PortalButton>
        </div>
      </form>
    </div>
  );
}

// ─── Shared: Chat UI ──────────────────────────────────────────────────────────
function ChatSection({ token, currentUserId, portal }: { token: string; currentUserId: string; portal: string }) {
  return (
    <div style={{ height: 'calc(100vh - 180px)', minHeight: 400 }}>
      <ChatPanel token={token} currentUserId={currentUserId} portal={portal} inlineMode />
    </div>
  );
}

// ─── Shared: Notifications ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function NotificationsSection({ notifs, refetch }: { notifs: any[]; refetch?: () => void }) {
  const [localNotifs, setLocalNotifs] = React.useState(notifs);
  React.useEffect(() => setLocalNotifs(notifs), [notifs]);
  const markRead = async (id: string) => {
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.patch(`/api/v1/notifications/${id}/read`);
      setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      refetch?.();
    } catch { /* silent */ }
  };
  const markAllRead = async () => {
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await Promise.all(localNotifs.filter(n => !n.read).map(n => apiClient.patch(`/api/v1/notifications/${n.id}/read`)));
      setLocalNotifs(prev => prev.map(n => ({ ...n, read: true })));
      refetch?.();
    } catch { /* silent */ }
  };
  const unread = localNotifs.filter(n => !n.read).length;
  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {unread > 0 && (
        <div className="flex justify-end">
          <PortalButton size="sm" variant="secondary" onClick={markAllRead}>Mark all as read ({unread})</PortalButton>
        </div>
      )}
      {localNotifs.length === 0 && <p className="text-sm text-gray-400">No notifications</p>}
      {localNotifs.map((n: any, i: number) => (
        <div key={n.id || i} className={`${cardCls} flex items-start gap-3`} style={cardStyle}>
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-gray-300' : 'bg-blue-500'}`} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{n.title || n.message || 'Notification'}</p>
            {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
            <p className="text-xs text-gray-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
          </div>
          {!n.read && (
            <button onClick={() => markRead(n.id)} className="text-xs text-blue-600 hover:underline flex-shrink-0 mt-0.5">Mark read</button>
          )}
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

// ─── Pay Staff Section ────────────────────────────────────────────────────────
function PayStaffSection({ themeHex }: { themeHex: string }) {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [bulkAmount, setBulkAmount] = useState('');
  const [label, setLabel] = useState('');
  const [paymentType, setPaymentType] = useState('SALARY');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [viewRun, setViewRun] = useState<any | null>(null);
  const [runItems, setRunItems] = useState<any[]>([]);
  const [histFilter, setHistFilter] = useState({ dateFrom: '', dateTo: '', status: '', type: '' });

  const loadStaff = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const res = await apiClient.get('/api/v1/staff-payments/eligible');
      setStaff(res.data?.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const loadRuns = async () => {
    setRunsLoading(true);
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const res = await apiClient.get('/api/v1/staff-payments/runs');
      setRuns(res.data?.data || []);
    } catch { /* silent */ } finally { setRunsLoading(false); }
  };

  useEffect(() => { loadStaff(); loadRuns(); }, []);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    staff.forEach(s => { next[s.id] = checked; });
    setSelected(next);
  };

  const applyBulkAmount = () => {
    if (!bulkAmount || parseFloat(bulkAmount) <= 0) return;
    setAmounts(prev => {
      const next = { ...prev };
      staff.filter(s => selected[s.id]).forEach(s => { next[s.id] = bulkAmount; });
      return next;
    });
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const totalAmount = staff
    .filter(s => selected[s.id])
    .reduce((sum, s) => sum + (parseFloat(amounts[s.id] || '0') || 0), 0);

  const handlePay = async () => {
    if (!label.trim()) { setMsgOk(false); setMsg('Enter a label for this payment run (e.g. "April 2026 Salary").'); return; }
    if (selectedCount === 0) { setMsgOk(false); setMsg('Select at least one staff member.'); return; }
    const items = staff
      .filter(s => selected[s.id])
      .map(s => ({ userId: s.id, amount: parseFloat(amounts[s.id] || '0') }));
    const invalid = items.find(i => !i.amount || i.amount <= 0);
    if (invalid) { setMsgOk(false); setMsg('Enter a valid amount (> 0) for all selected staff.'); return; }

    setBusy(true); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const res = await apiClient.post('/api/v1/staff-payments/runs', { label: label.trim(), paymentType, items });
      const d = res.data?.data;
      setMsgOk(true);
      setMsg(`✓ Payment run complete — ${d.paidCount} paid, ${d.failedCount} failed. Total: KSh ${Number(d.totalAmount).toLocaleString()}`);
      setSelected({}); setAmounts({}); setLabel('');
      loadRuns();
    } catch (err: any) {
      setMsgOk(false);
      setMsg(err?.response?.data?.error || 'Payment run failed');
    } finally { setBusy(false); }
  };

  const openRun = async (runId: string) => {
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const res = await apiClient.get(`/api/v1/staff-payments/runs/${runId}`);
      setViewRun(res.data?.data?.run);
      setRunItems(res.data?.data?.items || []);
    } catch { /* silent */ }
  };

  const statusColor = (s: string) => {
    if (s === 'PAID' || s === 'COMPLETED') return 'bg-green-100 text-green-700';
    if (s === 'FAILED') return 'bg-red-100 text-red-600';
    if (s === 'PARTIAL') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-500';
  };

  if (viewRun) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setViewRun(null)} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">← Back</button>
          <h2 className="font-semibold text-gray-800">{viewRun.label}</h2>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(viewRun.status)}`}>{viewRun.status}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Total Paid Out</p>
            <p className="text-xl font-bold text-gray-800">KSh {Number(viewRun.total_amount).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Executed</p>
            <p className="text-sm font-medium text-gray-700">{viewRun.executed_at ? new Date(viewRun.executed_at).toLocaleString() : '—'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Initiated By</p>
            <p className="text-sm font-medium text-gray-700">{viewRun.initiated_by_name}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Paid At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {runItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.role}</td>
                  <td className="px-4 py-3 text-gray-600">{item.payout_method}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.payout_account}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">KSh {Number(item.amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(item.status)}`}>{item.status}</span>
                    {item.failure_reason && <p className="text-xs text-red-500 mt-0.5">{item.failure_reason}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{item.paid_at ? new Date(item.paid_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SandboxBanner />
      {/* New Payment Run */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">New Payment Run</h3>
        <p className="text-xs text-gray-500 mb-4">Select staff, enter amounts, then click Pay. Money is sent directly to their M-Pesa or bank account.</p>

        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">Run Label *</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. April 2026 Salary" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type</label>
            <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none">
              <option value="SALARY">Salary</option>
              <option value="STAFF_SUPPORT">Staff Support</option>
              <option value="GENERAL">General</option>
            </select>
          </div>
        </div>

        {/* Bulk amount setter */}
        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Set amount for all selected:</span>
          <input
            type="number" min="1" step="1"
            value={bulkAmount}
            onChange={e => setBulkAmount(e.target.value)}
            placeholder="e.g. 5000"
            className="w-36 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={applyBulkAmount}
            disabled={!bulkAmount || selectedCount === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-all"
            style={{ background: themeHex }}
          >
            Apply to {selectedCount > 0 ? `${selectedCount} selected` : 'selected'}
          </button>
          {selectedCount > 0 && (
            <span className="text-xs text-gray-400 ml-1">You can still edit individual amounts below.</span>
          )}
        </div>

        {msg && (
          <div className={`p-3 rounded-xl text-sm mb-4 ${msgOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg}</div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading staff…</p>
        ) : (
          <div className="rounded-xl border border-gray-100 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-left w-8">
                    <input type="checkbox" checked={selectedCount === staff.length && staff.length > 0}
                      onChange={e => toggleAll(e.target.checked)}
                      className="rounded" />
                  </th>
                  <th className="px-3 py-2.5 text-left">Name</th>
                  <th className="px-3 py-2.5 text-left">Role</th>
                  <th className="px-3 py-2.5 text-left">Payout</th>
                  <th className="px-3 py-2.5 text-right">Amount (KSh) *</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map(s => {
                  const account = s.payout_method === 'MPESA' ? s.payout_phone : s.payout_bank_account;
                  const hasPayout = s.payout_method && account;
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 ${selected[s.id] ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={!!selected[s.id]} disabled={!hasPayout}
                          onChange={e => setSelected(prev => ({ ...prev, [s.id]: e.target.checked }))}
                          className="rounded" />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-800">{s.full_name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{s.role}</td>
                      <td className="px-3 py-2.5">
                        {hasPayout ? (
                          <div>
                            <span className="text-xs font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">{s.payout_method}</span>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono">{account}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-red-500 font-medium">⚠ Not set</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number" min="1" step="1"
                          disabled={!selected[s.id]}
                          value={amounts[s.id] || ''}
                          onChange={e => setAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder="0"
                          className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-300"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedCount > 0 && (
              <span>{selectedCount} selected · Total: <strong>KSh {totalAmount.toLocaleString()}</strong></span>
            )}
          </div>
          <button
            onClick={handlePay}
            disabled={busy || selectedCount === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: themeHex }}
          >
            {busy ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Processing…</>
            ) : (
              <>💸 Pay {selectedCount > 0 ? `${selectedCount} Staff` : 'Staff'}</>
            )}
          </button>
        </div>
      </div>

      {/* Payment History */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Payment History</h3>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="date" placeholder="From" value={histFilter.dateFrom} onChange={e => setHistFilter(f => ({ ...f, dateFrom: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
          <input type="date" placeholder="To" value={histFilter.dateTo} onChange={e => setHistFilter(f => ({ ...f, dateTo: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
          <select value={histFilter.status} onChange={e => setHistFilter(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
            <option value="">All Statuses</option>
            {['COMPLETED','PARTIAL','FAILED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={histFilter.type} onChange={e => setHistFilter(f => ({ ...f, type: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
            <option value="">All Types</option>
            {['SALARY','STAFF_SUPPORT','GENERAL'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(histFilter.dateFrom || histFilter.dateTo || histFilter.status || histFilter.type) && (
            <button onClick={() => setHistFilter({ dateFrom: '', dateTo: '', status: '', type: '' })}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">Clear</button>
          )}
        </div>
        {runsLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-gray-400">No payment runs yet.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Paid / Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {runs.filter(run => {
                  if (histFilter.status && run.status !== histFilter.status) return false;
                  if (histFilter.type && run.payment_type !== histFilter.type) return false;
                  if (histFilter.dateFrom && run.created_at && new Date(run.created_at) < new Date(histFilter.dateFrom)) return false;
                  if (histFilter.dateTo && run.created_at && new Date(run.created_at) > new Date(histFilter.dateTo + 'T23:59:59')) return false;
                  return true;
                }).map(run => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{run.label}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{run.payment_type}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">KSh {Number(run.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                      <span className="text-green-600 font-semibold">{run.paid_count}</span>
                      <span className="text-gray-400"> / {run.item_count}</span>
                      {Number(run.failed_count) > 0 && <span className="text-red-500 ml-1">({run.failed_count} failed)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(run.status)}`}>{run.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{run.created_at ? new Date(run.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openRun(run.id)} className="text-xs font-medium text-blue-600 hover:underline">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CFO Dashboard ────────────────────────────────────────────────────────────
const CFO_NAV = [
  { id: 'overview',        label: 'Overview',            icon: I.overview },
  { id: 'revenue',         label: 'Revenue Collection',  icon: I.revenue },
  { id: 'pl-summary',      label: 'P&L Summary',         icon: I.finance },
  { id: 'revenue-forecast',label: 'Revenue Forecast',    icon: I.finance },
  { id: 'payments',        label: 'Payment Management',  icon: I.payment },
  { id: 'pay-staff',       label: 'Pay Staff',           icon: I.agent },
  { id: 'agent-payouts',   label: 'Agent Payouts',       icon: I.agent },
  { id: 'payout-details',  label: 'Staff Payout Details',icon: I.team },
  { id: 'tax',             label: 'Tax & Compliance',    icon: I.tax },
  { id: 'finance-module',  label: 'Finance Module',      icon: I.finance },
  { id: 'anti-corruption', label: 'Anti-Corruption',     icon: I.audit },
  { id: 'coordination',    label: 'Tech Funding',        icon: I.coord },
  { id: 'service-amounts', label: 'Service Amounts',     icon: I.service },
  { id: 'cfo-assistants',  label: 'CFO Assistants',      icon: I.team },
  { id: 'invite-users',    label: 'Invite Users',        icon: I.invite },
  { id: 'chat',            label: 'Chat',                icon: I.chat },
  { id: 'daily-report',    label: 'Daily Report',        icon: I.report },
];

function CFODashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: string[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [revenueTab, setRevenueTab] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [totRate, setTotRate] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState(''); const [inviteOk, setInviteOk] = useState(false);

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
  const techRequests = data.techRequests || [];
  const budgetRequests = data.budgetRequests || [];

  const nav = CFO_NAV.map(n => n.id === 'notifications' ? { ...n, badge: notifs.filter((x: any) => !x.read).length } : n);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const approvePayment = async (id: string) => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/payments/approvals/${id}/approve`, {}); refetch(['payments']); } catch { /* silent */ }
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const rejectPayment = async (id: string) => {
    const reason = prompt('Rejection reason:'); if (!reason) return;
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/payments/approvals/${id}/reject`, { reason }); refetch(['payments']); } catch { /* silent */ }
  };
  const handleTechFunding = async (id: string, action: 'approve' | 'reject') => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/tech-funding-requests/${id}/${action}`, {}); refetch(['techRequests']); } catch { /* silent */ }
  };
  const handleBudget = async (id: string, action: 'approve' | 'reject') => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/budget-requests/${id}/${action}`, {}); refetch(['budgetRequests']); } catch { /* silent */ }
  };
  const executeBudget = async (id: string) => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/budget-requests/${id}/execute`, {}); refetch(['budgetRequests']); } catch { /* silent */ }
  };

  return (
    <PortalLayout theme={theme} user={{ name: user?.name || 'CFO', email: user?.email || '', role: 'CFO' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={EXECUTIVE_FAQS} portalName="Executive Portal — CFO">

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
          <SectionHeader title="Payment Management" subtitle="Approve or reject pending requests · Execute approved payments — CFO, CoS and CEO only" />
          <SandboxBanner />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {[...pending, ...(data.approvedPayments || [])].length === 0
              ? <p className="px-5 py-8 text-center text-gray-400 text-sm">No payment requests</p>
              : [...pending, ...(data.approvedPayments || [])].map((row: any) => (
                <div key={row.id} className="px-5">
                  <ExecPaymentRow row={row} themeHex={theme.hex} currentUserId={user?.id} onRefetch={() => refetch(['payments', 'approvedPayments'])} />
                </div>
              ))
            }
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
            <DataTable columns={[
              { key: 'invoiceNumber', label: 'Invoice #' },
              { key: 'client', label: 'Client' },
              { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'DRAFT'} /> },
              { key: 'dueDate', label: 'Due', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'id', label: 'Actions', render: (_v, row: any) => (
                <div className="flex gap-1.5">
                  <PortalButton size="sm" variant="secondary" onClick={() => alert(`Invoice #${row.invoiceNumber}\n\nClient: ${row.client || '—'}\nAmount: KSh ${(row.amount || 0).toLocaleString()}\nStatus: ${row.status || 'DRAFT'}\nDue: ${row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}`)}>View</PortalButton>
                  {row.downloadUrl && (
                    <PortalButton size="sm" color={theme.hex} onClick={() => window.open(row.downloadUrl, '_blank')}>Download</PortalButton>
                  )}
                </div>
              )},
            ]} rows={invoices} emptyMessage="No invoices" />
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

      {section === 'agent-payouts' && (
        <div>
          <SectionHeader title="Agent Payouts" subtitle="Every Friday 4:00 PM – 10:00 PM — agent commission payments" />
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            Payment window: <strong>Every Friday, 4:00 PM – 10:00 PM</strong>. Payments outside this window will be rejected.
          </div>
          <DataTable
            columns={[
              { key: 'full_name', label: 'Agent' },
              { key: 'email', label: 'Email' },
              { key: 'payout_method', label: 'Method', render: v => v ? <StatusBadge status={v} /> : <span className="text-red-500 text-xs font-medium">⚠ Not set</span> },
              { key: 'payout_phone', label: 'M-Pesa / Account', render: (v, r: any) => v || r.payout_bank_account || '—' },
              { key: 'total_clients', label: 'Clients', render: v => v ?? '—' },
              { key: 'closed_deals', label: 'Closed', render: v => v ?? '—' },
              { key: 'commissions_this_month', label: 'Commission (Month)', render: v => v ? `KSh ${Number(v).toLocaleString()}` : '—' },
              { key: 'id', label: 'Pay', render: (_v, row: any) => (
                <PortalButton size="sm" color={theme.hex} onClick={async () => {
                  if (!row.payout_method) { alert('This agent has no payout details set. Update in Staff Payout Details first.'); return; }
                  try {
                    const { apiClient } = await import('../../shared/api/apiClient');
                    await apiClient.post('/api/v1/payments/approvals', {
                      amount: row.commissions_this_month || 0,
                      purpose: `Agent commission — ${row.full_name}`,
                    });
                    alert('Payment request created and approved for execution.');
                  } catch (err: any) { alert(err?.response?.data?.error || 'Failed'); }
                }}>Pay</PortalButton>
              )},
            ]}
            rows={data.agents || []}
            emptyMessage="No agents found"
          />
        </div>
      )}

      {section === 'payout-details' && (
        <div>
          <SectionHeader title="Staff Payout Details" subtitle="View and update bank / M-Pesa payout accounts for all payable staff" />
          <PayoutDetailsManager />
        </div>
      )}

      {section === 'pay-staff' && (
        <div>
          <SectionHeader title="Pay Staff" subtitle="Select staff members, set amounts, and execute payment — funds sent directly to their M-Pesa or bank account" />
          <PayStaffSection themeHex={theme.hex} />
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
                try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post('/api/v1/users/invite', { email: inviteEmail, roleId: 'CFO_ASSISTANT' }); setInviteOk(true); setInviteMsg('Invitation sent!'); setInviteEmail(''); }
                catch (err: any) { setInviteOk(false); setInviteMsg(err?.response?.data?.error || 'Failed to send invitation'); }
              }}>Send Invitation</PortalButton>
            </div>
          </div>
        </div>
      )}

      {section === 'chat' && (<div><SectionHeader title="Chat" /><ChatSection token={user?.token || ''} currentUserId={user?.id || ''} portal="Executive Portal" /></div>)}
      {section === 'coordination' && (
        <div>
          <SectionHeader title="Tech Funding & Budget Requests" subtitle="Submitted by CTO/COO — CFO, CoS or CEO can approve" />
          <div className="mb-8">
            <h3 className="font-semibold text-gray-700 mb-3">Budget Requests (COO)</h3>
            <DataTable
              columns={[
                { key: 'requester', label: 'Requester' },
                { key: 'amount', label: 'Amount (KSh)', render: (v: any) => (v || 0).toLocaleString() },
                { key: 'purpose', label: 'Purpose' },
                { key: 'department', label: 'Department' },
                { key: 'status', label: 'Status', render: (v: any) => <StatusBadge status={v || 'PENDING'} /> },
                { key: 'id', label: 'Actions', render: (id: any, row: any) => (
                  row.status === 'PENDING' || !row.status ? (
                    <div className="flex gap-2">
                      <PortalButton size="sm" color={theme.hex} onClick={() => handleBudget(id, 'approve')}>Approve</PortalButton>
                      <PortalButton size="sm" variant="danger" onClick={() => handleBudget(id, 'reject')}>Reject</PortalButton>
                    </div>
                  ) : row.status === 'APPROVED' ? (
                    <div className="flex gap-2">
                      <PortalButton size="sm" color={theme.hex} onClick={() => executeBudget(id)}>Execute</PortalButton>
                      <StatusBadge status={row.status} />
                    </div>
                  ) : <StatusBadge status={row.status} />
                )},
              ]}
              rows={budgetRequests}
              emptyMessage="No budget requests"
            />
          </div>
          <h3 className="font-semibold text-gray-700 mb-3">Tech Funding Requests (CTO)</h3>
          <DataTable
            columns={[
              { key: 'project',       label: 'Project' },
              { key: 'amount',        label: 'Amount (KSh)', render: (v: any) => (v || 0).toLocaleString() },
              { key: 'justification', label: 'Justification', render: (v: any) => v ? String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '') : '—' },
              { key: 'requesterName', label: 'Requested By', render: (v: any) => v || '—' },
              { key: 'status',        label: 'Status', render: (v: any) => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'id', label: 'Actions', render: (id: any, row: any) => (
                row.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <PortalButton size="sm" color={theme.hex} onClick={() => handleTechFunding(id, 'approve')}>Approve</PortalButton>
                    <PortalButton size="sm" variant="danger" onClick={() => handleTechFunding(id, 'reject')}>Reject</PortalButton>
                  </div>
                ) : <StatusBadge status={row.status} />
              )},
            ]}
            rows={techRequests}
            emptyMessage="No tech funding requests"
          />
        </div>
      )}

      {section === 'pl-summary' && (
        <div>
          <SectionHeader title="P&L Summary" subtitle="Profit & Loss snapshot — revenue in vs expenses out" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={cardCls} style={{ ...cardStyle, borderLeft: '4px solid #22c55e' }}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-green-700">KSh {((fs.totalRevenue || 0) / 1e6).toFixed(2)}M</p>
            </div>
            <div className={cardCls} style={{ ...cardStyle, borderLeft: '4px solid #ef4444' }}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">KSh {((fs.totalExpenses || 0) / 1e6).toFixed(2)}M</p>
            </div>
            <div className={cardCls} style={{ ...cardStyle, borderLeft: `4px solid ${theme.hex}` }}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Net Profit</p>
              <p className="text-2xl font-bold" style={{ color: (fs.totalRevenue || 0) - (fs.totalExpenses || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                KSh {(((fs.totalRevenue || 0) - (fs.totalExpenses || 0)) / 1e6).toFixed(2)}M
              </p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: 'month', label: 'Month' },
              { key: 'revenue', label: 'Revenue (KSh)', render: v => (v || 0).toLocaleString() },
              { key: 'expenses', label: 'Expenses (KSh)', render: v => (v || 0).toLocaleString() },
              { key: 'profit', label: 'Profit (KSh)', render: (v, r: any) => {
                const p = v ?? ((r.revenue || 0) - (r.expenses || 0));
                return <span style={{ color: p >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{p.toLocaleString()}</span>;
              }},
            ]}
            rows={(data as any).plData || []}
            emptyMessage="No P&L data available"
          />
        </div>
      )}

      {section === 'revenue-forecast' && (
        <div>
          <SectionHeader title="Revenue Forecast" subtitle="Next month projection based on pipeline value and historical close rate" />
          {(() => {
            const allClients: any[] = (data as any).clients || [];
            const pipelineValue = allClients
              .filter((c: any) => ['NEW_LEAD','CONVERTED','LEAD_ACTIVATED','LEAD_QUALIFIED','NEGOTIATION'].includes(c.status))
              .reduce((s: number, c: any) => s + (parseFloat(c.estimatedValue || c.serviceAmount) || 0), 0);
            const closedWon = allClients.filter((c: any) => c.status === 'CLOSED_WON').length;
            const totalLeads = allClients.length || 1;
            const closeRate = Math.min(1, closedWon / totalLeads);
            const forecast = pipelineValue * closeRate;
            const currentRevenue = fs.totalRevenue || 0;
            const growth = currentRevenue > 0 ? ((forecast - currentRevenue) / currentRevenue) * 100 : 0;
            return (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className={cardCls} style={cardStyle}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pipeline Value</p>
                    <p className="text-2xl font-bold text-gray-800">KSh {(pipelineValue / 1e6).toFixed(2)}M</p>
                    <p className="text-xs text-gray-400 mt-1">{allClients.filter((c: any) => ['NEW_LEAD','CONVERTED','LEAD_ACTIVATED','LEAD_QUALIFIED','NEGOTIATION'].includes(c.status)).length} active leads</p>
                  </div>
                  <div className={cardCls} style={cardStyle}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Historical Close Rate</p>
                    <p className="text-2xl font-bold text-gray-800">{(closeRate * 100).toFixed(1)}%</p>
                    <p className="text-xs text-gray-400 mt-1">{closedWon} closed of {totalLeads} total</p>
                  </div>
                  <div className={cardCls} style={{ ...cardStyle, borderLeft: `4px solid ${theme.hex}` }}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Projected Next Month</p>
                    <p className="text-2xl font-bold" style={{ color: theme.hex }}>KSh {(forecast / 1e6).toFixed(2)}M</p>
                    <p className="text-xs mt-1" style={{ color: growth >= 0 ? '#22c55e' : '#ef4444' }}>
                      {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}% vs current
                    </p>
                  </div>
                </div>
                <div className={cardCls} style={cardStyle}>
                  <h3 className="font-semibold text-gray-800 mb-3">Pipeline by Stage</h3>
                  <div className="space-y-3">
                    {['NEW_LEAD','CONVERTED','LEAD_ACTIVATED','LEAD_QUALIFIED','NEGOTIATION'].map(status => {
                      const items = allClients.filter((c: any) => c.status === status);
                      const val = items.reduce((s: number, c: any) => s + (parseFloat(c.estimatedValue || c.serviceAmount) || 0), 0);
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-36 flex-shrink-0">{status.replace(/_/g,' ')}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-lg overflow-hidden">
                            <div className="h-full rounded-lg flex items-center px-2 text-white text-xs font-medium"
                              style={{ width: `${pipelineValue > 0 ? Math.round((val / pipelineValue) * 100) : 0}%`, backgroundColor: theme.hex }}>
                              {items.length}
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 w-24 text-right">KSh {(val / 1e3).toFixed(0)}K</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {section === 'daily-report' && (<div><SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" /><DailyReportForm /></div>)}
    </PortalLayout>
  );
}


// ─── CoS Dashboard ────────────────────────────────────────────────────────────
const COS_NAV = [
  { id: 'overview',              label: 'Overview',              icon: I.overview },
  { id: 'payments',              label: 'Payment Management',    icon: I.payment },
  { id: 'financial-visibility',  label: 'Financial Visibility',  icon: I.visibility },
  { id: 'operations-visibility', label: 'Operations Visibility', icon: I.ops },
  { id: 'all-reports',           label: 'All Portal Reports',    icon: I.report },
  { id: 'escalations',           label: 'Escalation Tracker',    icon: I.audit },
  { id: 'coordination',          label: 'Coordination Tools',    icon: I.coord },
  { id: 'service-amounts',       label: 'Service Amounts',       icon: I.service },
  { id: 'chat',                  label: 'Chat',                  icon: I.chat },
  { id: 'daily-report',          label: 'Daily Report',          icon: I.report },
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
  const cashFlow = data.cashFlow || []; void cashFlow;
  const pending = (data.payments || []).filter((p: any) => p.status === 'PENDING_APPROVAL' || p.status === 'PENDING');
  const approvedPayments = data.approvedPayments || [];
  // Escalation state
  const [escalationForm, setEscalationForm] = React.useState({ title: '', description: '', priority: 'HIGH' });
  const [escalationMsg, setEscalationMsg] = React.useState('');
  const [escalationOk, setEscalationOk] = React.useState(false);
  const [escalations, setEscalations] = React.useState<any[]>([]);
  const [allReportsFilter, setAllReportsFilter] = React.useState({ portal: '', search: '' });

  React.useEffect(() => {
    if (section === 'escalations' && escalations.length === 0) {
      import('../../shared/api/apiClient').then(({ apiClient }) =>
        apiClient.get('/api/v1/escalations').then(r => setEscalations((r.data as any).data || r.data || [])).catch(() => {})
      );
    }
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = COS_NAV.map(n => n.id === 'notifications' ? { ...n, badge: notifs.filter((x: any) => !x.read).length } : n);

  const handleBudget = async (id: string, action: 'approve' | 'reject') => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/budget-requests/${id}/${action}`, {}); refetch(['budgetRequests']); } catch { /* silent */ }
  };
  const executeBudget = async (id: string) => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/budget-requests/${id}/execute`, {}); refetch(['budgetRequests']); } catch { /* silent */ }
  };

  const handleTechFunding = async (id: string, action: 'approve' | 'reject') => {
    try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/tech-funding-requests/${id}/${action}`, {}); refetch(['techRequests']); } catch { /* silent */ }
  };

  return (
    <PortalLayout theme={theme} user={{ name: user?.name || 'CoS', email: user?.email || '', role: 'Chief of Staff' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={EXECUTIVE_FAQS} portalName="Executive Portal — CoS">

      {section === 'payments' && (
        <div>
          <SectionHeader title="Payment Management" subtitle="Approve or reject pending requests · Execute approved payments — CFO, CoS and CEO only" />
          <SandboxBanner />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {[...pending, ...approvedPayments].length === 0
              ? <p className="px-5 py-8 text-center text-gray-400 text-sm">No payment requests</p>
              : [...pending, ...approvedPayments].map((row: any) => (
                <div key={row.id} className="px-5">
                  <ExecPaymentRow row={row} themeHex={theme.hex} currentUserId={user?.id} onRefetch={() => refetch(['payments', 'approvedPayments'])} />
                </div>
              ))
            }
          </div>
        </div>
      )}

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
          <SectionHeader title="Coordination Tools" subtitle="Budget requests from COO/CTO and tech funding approvals — approved by CFO, CoS or CEO" />
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Budget Requests (COO / CTO)</h3>
            <DataTable
              columns={[
                { key: 'requester', label: 'Requester' },
                { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
                { key: 'purpose', label: 'Purpose' },
                { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
                { key: 'id', label: 'Actions', render: (_v, row: any) => (
                  row.status === 'PENDING' || !row.status ? (
                    <div className="flex gap-2">
                      <PortalButton size="sm" color={theme.hex} onClick={() => handleBudget(row.id, 'approve')}>Approve</PortalButton>
                      <PortalButton size="sm" variant="danger" onClick={() => handleBudget(row.id, 'reject')}>Reject</PortalButton>
                    </div>
                  ) : row.status === 'APPROVED' ? (
                    <div className="flex gap-2">
                      <PortalButton size="sm" color={theme.hex} onClick={() => executeBudget(row.id)}>Execute</PortalButton>
                      <StatusBadge status={row.status} />
                    </div>
                  ) : <StatusBadge status={row.status} />
                )},
              ]}
              rows={budgetRequests}
              emptyMessage="No budget requests"
            />
          </div>
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Tech Funding Requests</h3>
            <DataTable
              columns={[
                { key: 'requesterName', label: 'Requested By', render: (v, r: any) => v || r.requesterEmail || '—' },
                { key: 'project', label: 'Project' },
                { key: 'amount', label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
                { key: 'justification', label: 'Justification', render: v => v ? String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '') : '—' },
                { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
                { key: 'id', label: 'Actions', render: (_v, row: any) => (
                  row.status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <PortalButton size="sm" color={theme.hex} onClick={() => handleTechFunding(row.id, 'approve')}>Approve</PortalButton>
                      <PortalButton size="sm" variant="danger" onClick={() => handleTechFunding(row.id, 'reject')}>Reject</PortalButton>
                    </div>
                  ) : <span className="text-xs text-gray-400">—</span>
                )},
              ]}
              rows={techRequests}
              emptyMessage="No tech funding requests"
            />
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

      {section === 'all-reports' && (
        <div>
          <SectionHeader title="All Portal Reports" subtitle="Daily reports submitted across all portals" />
          <div className="flex flex-wrap gap-3 mb-4">
            <input type="text" placeholder="Search by name…" value={allReportsFilter.search}
              onChange={e => setAllReportsFilter(f => ({ ...f, search: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 w-48" />
            <select value={allReportsFilter.portal} onChange={e => setAllReportsFilter(f => ({ ...f, portal: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
              <option value="">All Portals</option>
              {['Operations','Technology','Trainers','Agents','C-Level','Executive'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(allReportsFilter.search || allReportsFilter.portal) && (
              <button onClick={() => setAllReportsFilter({ portal: '', search: '' })}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">Clear</button>
            )}
          </div>
          <DataTable
            columns={[
              { key: 'userName', label: 'Submitted By', render: (v, r: any) => (
                <div>
                  <p className="font-medium text-gray-900 text-sm">{v || r.full_name || r.user || '—'}</p>
                  <p className="text-xs text-gray-400">{r.userRole || r.role || '—'}</p>
                </div>
              )},
              { key: 'reportDate', label: 'Date', render: (v, r: any) => { const d = v || r.report_date; return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }},
              { key: 'hoursWorked', label: 'Hours', render: (v, r: any) => (v || r.hours_worked) != null ? `${v || r.hours_worked}h` : '—' },
              { key: 'accomplishments', label: 'Accomplishments', render: v => <span className="text-xs text-gray-600">{v ? String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '') : '—'}</span> },
            ]}
            rows={((data as any).allReports || trainers.flatMap((t: any) => t.reports || [])).filter((r: any) => {
              if (allReportsFilter.search) {
                const q = allReportsFilter.search.toLowerCase();
                if (!((r.userName || r.full_name || '').toLowerCase().includes(q))) return false;
              }
              return true;
            })}
            emptyMessage="No reports found"
          />
        </div>
      )}

      {section === 'escalations' && (
        <div>
          <SectionHeader title="Escalation Tracker" subtitle="Flag issues that need CEO attention" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 max-w-2xl">
            <p className="font-semibold text-gray-800 mb-4">New Escalation</p>
            {escalationMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${escalationOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{escalationMsg}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Title *</label>
                <input type="text" value={escalationForm.title} onChange={e => setEscalationForm(f => ({ ...f, title: e.target.value }))}
                  className={inputCls} placeholder="Brief description of the issue" />
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select value={escalationForm.priority} onChange={e => setEscalationForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
                  {['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea rows={3} value={escalationForm.description} onChange={e => setEscalationForm(f => ({ ...f, description: e.target.value }))}
                  className={`${inputCls} resize-none`} placeholder="Provide context for the CEO…" />
              </div>
            </div>
            <PortalButton color={theme.hex} onClick={async () => {
              if (!escalationForm.title.trim()) { setEscalationOk(false); setEscalationMsg('Title is required.'); return; }
              try {
                const { apiClient } = await import('../../shared/api/apiClient');
                const res = await apiClient.post('/api/v1/escalations', escalationForm);
                setEscalationOk(true); setEscalationMsg('Escalation flagged for CEO!');
                setEscalations(prev => [res.data?.data || res.data, ...prev]);
                setEscalationForm({ title: '', description: '', priority: 'HIGH' });
              } catch (err: any) { setEscalationOk(false); setEscalationMsg(err?.response?.data?.error || 'Failed'); }
            }}>Flag for CEO</PortalButton>
          </div>
          <DataTable
            columns={[
              { key: 'title', label: 'Issue' },
              { key: 'priority', label: 'Priority', render: v => <StatusBadge status={v || 'HIGH'} /> },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'OPEN'} /> },
              { key: 'createdAt', label: 'Flagged', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'resolvedAt', label: 'Resolved', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'id', label: 'Actions', render: (id, row: any) => (
                row.status !== 'RESOLVED' ? (
                  <PortalButton size="sm" color={theme.hex} onClick={async () => {
                    try {
                      const { apiClient } = await import('../../shared/api/apiClient');
                      await apiClient.patch(`/api/v1/escalations/${id}`, { status: 'RESOLVED' });
                      setEscalations(prev => prev.map(e => e.id === id ? { ...e, status: 'RESOLVED', resolvedAt: new Date().toISOString() } : e));
                    } catch { /* silent */ }
                  }}>Resolve</PortalButton>
                ) : <span className="text-xs text-green-600 font-semibold">✓ Resolved</span>
              )},
            ]}
            rows={escalations}
            emptyMessage="No escalations flagged"
          />
        </div>
      )}

      {section === 'chat' && (<div><SectionHeader title="Chat" /><ChatSection token={user?.token || ''} currentUserId={user?.id || ''} portal="Executive Portal" /></div>)}
      {section === 'daily-report' && (<div><SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" /><DailyReportForm /></div>)}
    </PortalLayout>
  );
}


// ─── Image Uploader ───────────────────────────────────────────────────────────
function ImageUploader({ propertyId, onUploaded }: {
  propertyId: string;
  onUploaded: (imgs: { id: string; url: string }[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState('');

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 8);
    if (!files.length) return;
    setBusy(true); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const fd = new FormData();
      for (const f of files) fd.append('images', f, f.name);
      const res = await apiClient.post(
        `/api/v1/plotconnect/properties/${propertyId}/images`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const uploaded = (res.data as any)?.images || [];
      onUploaded(uploaded);
      setMsg(`✓ ${uploaded.length} image${uploaded.length !== 1 ? 's' : ''} uploaded.`);
    } catch (err: any) {
      setMsg(err?.response?.data?.error || 'Upload failed.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="mt-2">
      <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {busy ? 'Uploading…' : 'Upload Images (up to 8)'}
        <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} disabled={busy} />
      </label>
      {msg && (
        <p className={`text-xs mt-1.5 ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>
      )}
    </div>
  );
}

// ─── PlotConnect Property Review ─────────────────────────────────────────────
function PlotConnectReview({ properties, onRefetch }: { properties: any[]; onRefetch: () => void }) {
  const [busy,      setBusy]      = useState<string | null>(null);
  const [msg,       setMsg]       = useState('');
  const [editProp,  setEditProp]  = useState<any | null>(null);
  const [editForm,  setEditForm]  = useState<any>({});
  const [editBusy,  setEditBusy]  = useState(false);
  const [editMsg,   setEditMsg]   = useState('');
  const [upgradePkg,   setUpgradePkg]   = useState('STANDARD');
  const [upgradePhone, setUpgradePhone] = useState('');
  const [upgradeBusy,  setUpgradeBusy]  = useState(false);
  const [upgradeMsg,   setUpgradeMsg]   = useState('');
  const [viewImages,   setViewImages]   = useState<{ id: string; url: string }[]>([]);
  const [viewImgIdx,   setViewImgIdx]   = useState(0);
  const PRICES: Record<string, number> = { BASIC: 4000, STANDARD: 8000, ADVANCED: 12000 };

  const sendUpgradeStk = async () => {
    if (!editProp) return;
    if (!upgradePhone.trim()) { setUpgradeMsg('Enter the client M-Pesa number.'); return; }
    setUpgradeBusy(true); setUpgradeMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const res = await apiClient.post(`/api/v1/plotconnect/properties/${editProp.id}/upgrade-package`, {
        newPackage: upgradePkg,
        mpesaPhone: upgradePhone.trim(),
      });
      const d = (res.data as any);
      setUpgradeMsg(d.message || `STK Push sent for package upgrade to ${upgradePkg}.`);
      if (d.autoCompleted) onRefetch();
    } catch (err: any) {
      setUpgradeMsg(err?.response?.data?.error || 'Failed to send STK Push.');
    } finally { setUpgradeBusy(false); }
  };

  const openEdit = (p: any) => {
    setEditProp(p);
    setEditForm({
      propertyName:  p.propertyName  || '',
      ownerName:     p.ownerName     || '',
      ownerPhone:    p.ownerPhone    || '',
      county:        p.county        || '',
      area:          p.area          || '',
      contactPerson: p.contactPerson || '',
      description:   p.description   || '',
      websiteLink:   p.websiteLink   || '',
      mapLink:       p.mapLink       || '',
    });
    setEditMsg('');
    // Default to the next tier above the current package
    const pkgOrder = ['BASIC', 'STANDARD', 'ADVANCED'];
    const currentIdx = pkgOrder.indexOf(p.package || 'BASIC');
    setUpgradePkg(pkgOrder[Math.min(currentIdx + 1, pkgOrder.length - 1)]);
    setUpgradePhone('');
    setUpgradeMsg('');
    // Load images
    setViewImages([]); setViewImgIdx(0);
    import('../../shared/api/apiClient').then(({ apiClient }) =>
      apiClient.get(`/api/v1/plotconnect/properties/${p.id}/images`)
        .then(res => setViewImages((res.data as any)?.images || []))
        .catch(() => {})
    );
  };

  const saveEdit = async () => {
    if (!editProp) return;
    setEditBusy(true); setEditMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.patch(`/api/v1/plotconnect/properties/${editProp.id}`, editForm);
      setEditMsg('✓ Saved successfully.');
      onRefetch();
    } catch (err: any) {
      setEditMsg(err?.response?.data?.error || 'Failed to save.');
    } finally { setEditBusy(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    setBusy(id + status); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.patch(`/api/v1/plotconnect/properties/${id}/status`, { status });
      setMsg(`Property ${status.toLowerCase()} successfully.`);
      onRefetch();
    } catch (err: any) {
      setMsg(err?.response?.data?.error || 'Failed to update status.');
    } finally { setBusy(null); }
  };

  const payBadge = (v: string) => {
    const cls: Record<string,string> = {
      PAID: 'bg-green-100 text-green-800',
      UNPAID: 'bg-slate-100 text-slate-600',
      AWAITING_CONFIRMATION: 'bg-amber-100 text-amber-800',
      FAILED: 'bg-red-100 text-red-700',
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${cls[v] || 'bg-slate-100 text-slate-600'}`}>{(v||'').replace(/_/g,' ')}</span>;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const s = (status || '').toUpperCase();
    const map: Record<string, { bg: string; text: string; dot: string }> = {
      ACTIVE:           { bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a' },
      COMPLETED:        { bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a' },
      APPROVED:         { bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a' },
      PUBLISHED:        { bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a' },
      PENDING:          { bg: '#fffbeb', text: '#d97706', dot: '#d97706' },
      PENDING_APPROVAL: { bg: '#fffbeb', text: '#d97706', dot: '#d97706' },
      IN_PROGRESS:      { bg: '#eff6ff', text: '#2563eb', dot: '#2563eb' },
      DRAFT:            { bg: '#f1f5f9', text: '#64748b', dot: '#64748b' },
      REJECTED:         { bg: '#fef2f2', text: '#dc2626', dot: '#dc2626' },
      UNPUBLISHED:      { bg: '#f1f5f9', text: '#64748b', dot: '#64748b' },
    };
    const style = map[s] || { bg: '#f1f5f9', text: '#64748b', dot: '#64748b' };
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: style.bg, color: style.text }}>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
        {s.replace(/_/g, ' ')}
      </span>
    );
  };

  const inp = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';

  if (!properties.length) {
    return <p className="text-sm text-slate-400 py-6 text-center">No PlotConnect properties submitted yet.</p>;
  }

  return (
    <div className="space-y-3">
      {msg && <p className="text-sm px-3 py-2 rounded-lg bg-blue-50 text-blue-700">{msg}</p>}

      {/* Edit modal */}
      {editProp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setEditProp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Edit — {editProp.propertyName}</h3>
              <button onClick={() => setEditProp(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              {editMsg && (
                <p className={`text-sm px-3 py-2 rounded-lg ${editMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {editMsg}
                </p>
              )}

              {/* Image gallery */}
              <div className="pt-1 pb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Property Images</p>
                  {viewImages.length > 0 ? (
                    <>
                      <div className="relative rounded-xl overflow-hidden bg-slate-100" style={{ height: 200 }}>
                        <img src={viewImages[viewImgIdx]?.url} alt="property"
                          className="w-full h-full object-cover" />
                        {viewImages.length > 1 && (
                          <>
                            <button onClick={() => setViewImgIdx(i => (i - 1 + viewImages.length) % viewImages.length)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60">‹</button>
                            <button onClick={() => setViewImgIdx(i => (i + 1) % viewImages.length)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60">›</button>
                            <span className="absolute bottom-2 right-3 text-xs text-white bg-black/40 px-2 py-0.5 rounded-full">
                              {viewImgIdx + 1}/{viewImages.length}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                        {viewImages.map((img, i) => (
                          <div key={img.id || i} className="relative flex-shrink-0 group">
                            <button onClick={() => setViewImgIdx(i)}
                              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all block ${i === viewImgIdx ? 'border-orange-500' : 'border-transparent'}`}>
                              <img src={img.url} alt="" className="w-full h-full object-cover" />
                            </button>
                            {img.id && (
                              <button
                                onClick={async () => {
                                  if (!confirm('Delete this image?')) return;
                                  try {
                                    const { apiClient } = await import('../../shared/api/apiClient');
                                    await apiClient.delete(`/api/v1/plotconnect/properties/${editProp!.id}/images/${img.id}`);
                                    setViewImages(prev => prev.filter(x => x.id !== img.id));
                                    setViewImgIdx(0);
                                  } catch { alert('Failed to delete image.'); }
                                }}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                title="Delete image">×</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic mb-1">No images uploaded yet.</p>
                  )}
                  <ImageUploader propertyId={editProp.id} onUploaded={(imgs) => {
                    setViewImages(prev => [...prev, ...imgs]);
                    setViewImgIdx(0);
                  }} />
              </div>
              {([
                ['propertyName',  'Property Name'],
                ['ownerName',     'Owner Name'],
                ['ownerPhone',    'Owner Phone'],
                ['county',        'County'],
                ['area',          'Area / Neighbourhood'],
                ['contactPerson', 'Contact Person'],
                ['websiteLink',   'Website Link'],
                ['mapLink',       'Map Link'],
              ] as [string, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input className={inp} value={editForm[field] || ''}
                    onChange={e => setEditForm((f: any) => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea rows={3} className={`${inp} resize-none`} value={editForm.description || ''}
                  onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Package upgrade section */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Package Upgrade</p>
                <p className="text-xs text-slate-400 mb-3">
                  Current: <span className="font-semibold text-slate-700">{editProp?.package || '—'}</span>
                  {editProp?.package && ` (KSh ${(PRICES[editProp.package] || 0).toLocaleString()})`}
                  . Client pays the difference via M-Pesa STK Push.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Upgrade To</label>
                    <select className={inp} value={upgradePkg}
                      onChange={e => setUpgradePkg(e.target.value)}>
                      {(['BASIC', 'STANDARD', 'ADVANCED'] as const)
                        .filter(pkg => (PRICES[pkg] || 0) > (PRICES[editProp?.package || ''] || 0))
                        .map(pkg => (
                          <option key={pkg} value={pkg}>
                            {pkg.charAt(0) + pkg.slice(1).toLowerCase()} — KSh {(PRICES[pkg] || 0).toLocaleString()}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Client M-Pesa Number</label>
                    <input className={inp} placeholder="07XXXXXXXX" value={upgradePhone}
                      onChange={e => setUpgradePhone(e.target.value)} />
                  </div>
                  {editProp?.package && upgradePkg && PRICES[upgradePkg] > (PRICES[editProp.package] || 0) && (
                    <p className="text-xs text-slate-500">
                      Amount to charge: <span className="font-semibold text-slate-800">
                        KSh {(PRICES[upgradePkg] - (PRICES[editProp.package] || 0)).toLocaleString()}
                      </span>
                    </p>
                  )}
                  <button disabled={upgradeBusy} onClick={sendUpgradeStk}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors">
                    {upgradeBusy ? 'Sending STK…' : 'Send STK Push for Upgrade'}
                  </button>
                  {upgradeMsg && (
                    <p className={`text-xs px-3 py-2 rounded-lg ${upgradeMsg.startsWith('✓') || upgradeMsg.includes('sent') || upgradeMsg.includes('SANDBOX') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {upgradeMsg}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
              <button disabled={editBusy} onClick={saveEdit}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
                {editBusy ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditProp(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Property', 'Location', 'Package', 'Agent', 'Payment', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {properties.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{p.propertyName}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{[p.area, p.county].filter(Boolean).join(', ') || '—'}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.package || '—'}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{p.agentName || '—'}</td>
                <td className="px-4 py-3">{payBadge(p.paymentStatus || 'UNPAID')}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status || 'PENDING'} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {/* Edit button — always available to EA */}
                    <button onClick={() => openEdit(p)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                      Edit
                    </button>
                    {/* Status actions */}
                    {(p.status === 'PENDING' || p.status === 'REJECTED') && (
                      <button disabled={!!busy} onClick={() => updateStatus(p.id, 'APPROVED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors">
                        {busy === p.id + 'APPROVED' ? '…' : 'Approve'}
                      </button>
                    )}
                    {(p.status === 'PENDING' || p.status === 'APPROVED') && (
                      <button disabled={!!busy} onClick={() => updateStatus(p.id, 'REJECTED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 transition-colors">
                        {busy === p.id + 'REJECTED' ? '…' : 'Reject'}
                      </button>
                    )}
                    {p.status === 'APPROVED' && (
                      <button disabled={!!busy} onClick={() => updateStatus(p.id, 'PUBLISHED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
                        {busy === p.id + 'PUBLISHED' ? '…' : 'Publish'}
                      </button>
                    )}
                    {p.status === 'PUBLISHED' && (
                      <button disabled={!!busy} onClick={() => updateStatus(p.id, 'UNPUBLISHED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                        {busy === p.id + 'UNPUBLISHED' ? '…' : 'Unpublish'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── EA Dashboard ─────────────────────────────────────────────────────────────
// EA does NOT execute or request payments. EA handles contracts, regions, agent oversight.
const EA_NAV = [
  { id: 'overview',           label: 'Overview',              icon: I.overview },
  { id: 'plotconnect',        label: 'PlotConnect Review',   icon: I.ops },
  { id: 'contract-generator', label: 'Contract Generator',    icon: I.contract },
  { id: 'contract-status',    label: 'Contract Status Board', icon: I.contract },
  { id: 'region-country',     label: 'Region & Country',      icon: I.region },
  { id: 'agent-performance',  label: 'Agent Performance',     icon: I.agent },
  { id: 'agent-comparison',   label: 'Agent Comparison',      icon: I.agent },
  { id: 'service-amounts',    label: 'Service Amounts',       icon: I.service },
  { id: 'chat',               label: 'Chat',                  icon: I.chat },
];

const AFRICAN_COUNTRIES = ['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Congo','DR Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Ivory Coast','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','São Tomé and Príncipe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'];

function EADashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: string[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [regionForm, setRegionForm] = useState({ name: '' });
  const [countryForm, setCountryForm] = useState({ name: '', region: '' });
  const [regionMsg, setRegionMsg] = useState('');

  const notifs = data.notifications || [];
  const serviceAmounts = data.serviceAmounts || [];
  const regions = data.regions || [];
  const agents = data.agents || [];
  const pendingContracts = data.contracts || [];
  const projects = data.projects || [];
  const clients = data.clients || [];
  const teams = data.teams || [];
  const properties = data.properties || [];

  const nav = EA_NAV.map(n => n.id === 'notifications' ? { ...n, badge: notifs.filter((x: any) => !x.read).length } : n);

  return (
    <PortalLayout theme={theme} user={{ name: user?.name || 'EA', email: user?.email || '', role: 'Executive Assistant' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={EXECUTIVE_FAQS} portalName="Executive Portal — EA">

      {section === 'overview' && (
        <div>
          <SectionHeader title="EA Overview" subtitle="Your pending tasks at a glance" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Contracts to Generate" value={pendingContracts.filter((c: any) => c.status === 'PENDING').length} icon={I.contract} color={theme.hex} />
            <StatCard label="Regions Managed" value={regions.length} icon={I.region} color={theme.hex} />
            <StatCard label="Agents Overseen" value={agents.length} icon={I.agent} color={theme.hex} />
            <StatCard label="Properties Pending Review" value={properties.filter((p: any) => p.status === 'PENDING').length} icon={I.ops} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'payment-execution' && null /* EA no longer executes payments — handled by CFO/CoS/CEO */}

      {section === 'plotconnect' && (
        <div>
          <SectionHeader title="PlotConnect Property Review" subtitle="Review and manage property submissions" />
          <PlotConnectReview properties={properties} onRefetch={() => refetch(['properties'])} />
        </div>
      )}

      {section === 'contract-generator' && (
        <div>
          <SectionHeader title="Contract Generator" subtitle="Generate contracts directly" />
          <ContractGeneratorForm
            projects={projects}
            clients={clients}
            teams={teams}
            accentColor={theme.hex}
            onGenerated={() => refetch(['contracts'])}
          />
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
          <div className="mt-8">
            <h2 className="text-base font-semibold text-slate-800 mb-1">TST PlotConnect Package Amounts</h2>
            <p className="text-sm text-slate-500 mb-4">Propose changes to PlotConnect listing package prices. CEO must confirm before changes take effect.</p>
            <PlotConnectProperties themeHex={theme.hex} canManagePkg={true} canApprove={true} canPublish={true} showAgent={false} showRevenue={false} />
          </div>
        </div>
      )}

      {section === 'contract-status' && (
        <div>
          <SectionHeader title="Contract Status Board" subtitle="All contracts grouped by status" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(['DRAFT','SENT','SIGNED','EXPIRED'] as const).map(status => {
              const items = (pendingContracts as any[]).filter((c: any) => (c.status || 'DRAFT').toUpperCase() === status);
              const colors: Record<string, string> = { DRAFT: '#94a3b8', SENT: '#3b82f6', SIGNED: '#22c55e', EXPIRED: '#ef4444' };
              return (
                <div key={status} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[status] }} />
                    <span className="text-sm font-bold text-gray-800">{status}</span>
                    <span className="ml-auto text-xs text-gray-400">{items.length}</span>
                  </div>
                  <div className="p-3 space-y-2 min-h-32">
                    {items.map((c: any, i: number) => (
                      <div key={c.id || i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-800 font-mono">{c.referenceNumber || c.id || '—'}</p>
                        {c.clientName && <p className="text-[10px] text-gray-500 mt-0.5">{c.clientName}</p>}
                        {c.teamName && <p className="text-[10px] text-indigo-600 mt-0.5">{c.teamName}</p>}
                        {c.createdAt && <p className="text-[10px] text-gray-400 mt-0.5">{new Date(c.createdAt).toLocaleDateString()}</p>}
                      </div>
                    ))}
                    {!items.length && <p className="text-xs text-gray-400 text-center py-4">No contracts</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {section === 'agent-comparison' && (
        <div>
          <SectionHeader title="Agent Comparison" subtitle="Side-by-side performance across regions" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Agent','Region','Country','Deals','Leads','Score'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(agents as any[]).length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No agent data</td></tr>
                )}
                {(agents as any[]).sort((a: any, b: any) => (b.score || b.performanceScore || 0) - (a.score || a.performanceScore || 0)).map((a: any, i: number) => {
                  const score = a.score || a.performanceScore || 0;
                  const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <tr key={a.id || i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: theme.hex }}>
                            {(a.name || '?')[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800">{a.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.region || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.country || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{a.deals ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.leads ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: scoreColor }} />
                          </div>
                          <span className="text-xs font-bold" style={{ color: scoreColor }}>{score > 0 ? `${score}%` : '—'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'chat' && (<div><SectionHeader title="Chat" /><ChatSection token={user?.token || ''} currentUserId={user?.id || ''} portal="Executive Portal" /></div>)}
    </PortalLayout>
  );
}


// ─── Main Entry ───────────────────────────────────────────────────────────────
export default function ExecutivePortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, refetch } = useMultiPortalData([
    { key: 'financialSummary',  endpoint: '/api/v1/dashboard/metrics',                 fallback: {} },
    { key: 'payments',          endpoint: '/api/v1/payments/approvals/pending',        fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || r.approvals || []) },
    { key: 'approvedPayments',  endpoint: '/api/v1/payments/approvals/approved-pending-execution', fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || r.approvals || []) },
    { key: 'taxRecords',        endpoint: '/api/v1/reports/tax',                       fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'payeRecords',       endpoint: '/api/v1/reports/paye',                      fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'auditTrail',        endpoint: '/api/v1/audit/trail',                       fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'crossCheckAlerts',  endpoint: '/api/v1/audit/alerts',                      fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'fraudFlags',        endpoint: '/api/v1/audit/fraud-flags',                 fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'ledger',            endpoint: '/api/v1/finance/ledger',                    fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'invoices',          endpoint: '/api/v1/finance/invoices',                  fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'assistants',        endpoint: '/api/v1/users?role=CFO_ASSISTANT',          fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'notifications',     endpoint: '/api/v1/notifications',                     fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r?.notifications || r?.data || []) },
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
    { key: 'projects',          endpoint: '/api/v1/projects?limit=200',                fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.projects || r.data || []) },
    { key: 'clients',           endpoint: '/api/v1/clients/all',                       fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || r.clients || []) },
    { key: 'teams',             endpoint: '/api/v1/organization/teams',                fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'properties',       endpoint: '/api/v1/plotconnect/properties?limit=200',  fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
  ] as any, [
    'data:payment:created', 'data:payment:approved', 'data:payment:rejected', 'data:payment:executed',
    'data:metrics:updated', 'data:notification:new', 'data:service_amount:changed',
    'data:contract:generated', 'data:client:status_changed', 'data:property:updated',
  ]);

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
