import React, { useState, useEffect } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';
import { projectDisplayStatus } from '../../shared/utils/projectStatus';
import ChatPanel from '../../shared/components/chat/ChatPanel';
import { CLEVEL_FAQS } from '../../shared/data/portalFAQs';

const theme = PORTAL_THEMES.clevel;
const cardCls = 'rounded-2xl p-5';
const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)' };
const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

// ─── Icons ────────────────────────────────────────────────────────────────────
const I = {
  overview: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  dept: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  achieve: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  budget: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  reports: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  chat: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  notif: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  report: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  github: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>,
  addmember: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
  contract: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  funding: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  team: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
};

// ─── Shared: Daily Report Form ────────────────────────────────────────────────
function DailyReportForm() {
  const [form, setForm] = useState({ accomplishments: '', challenges: '', plan: '', hours: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const clear = () => setForm({ accomplishments: '', challenges: '', plan: '', hours: '' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', { ...form, hoursWorked: parseFloat(form.hours) || undefined, reportDate: new Date().toISOString().split('T')[0] });
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
        <div className="mb-4"><label className={labelCls}>Plan for tomorrow</label><textarea rows={3} value={form.plan} onChange={set('plan')} className={`${inputCls} resize-none`} /></div>
        <div className="mb-6"><label className={labelCls}>Hours worked</label><input type="number" min={0} max={24} value={form.hours} onChange={set('hours')} className={inputCls} /></div>
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
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-gray-300' : 'bg-cyan-500'}`} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{n.title || n.message || 'Notification'}</p>
            {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
            <p className="text-xs text-gray-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
          </div>
          {!n.read && (
            <button onClick={() => markRead(n.id)} className="text-xs text-cyan-600 hover:underline flex-shrink-0 mt-0.5">Mark read</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Shared: Payment Request Form ────────────────────────────────────────────
function PaymentRequestForm({ projects, themeHex, onSubmitted }: { projects: any[]; themeHex: string; onSubmitted?: () => void }) {
  const [form, setForm] = useState({ projectId: '', amount: '', purpose: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/payments/approvals', {
        projectId: form.projectId || undefined,
        amount: parseFloat(form.amount),
        purpose: form.purpose.trim(),
      });
      setOk(true); setMsg('Payment request submitted — awaiting CFO, CoS or CEO approval.');
      setForm({ projectId: '', amount: '', purpose: '' });
      onSubmitted?.();
    } catch (err: any) { setOk(false); setMsg(err?.response?.data?.error || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="max-w-lg">
      {/* No projects notice */}
      {projects.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
          <p className="text-sm font-semibold text-amber-800 mb-1">No projects found</p>
          <p className="text-xs text-amber-700 mb-3">
            Payment requests can be linked to a project. Projects are created when a client lead is
            converted — go to the <strong>Operations Portal</strong> and convert a qualified lead to a project,
            or submit this request without a project link below.
          </p>
          <div className="text-xs text-amber-700 space-y-1">
            <p className="font-semibold">How to create a project:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-1">
              <li>Open the <strong>Operations Portal</strong> (port 5176)</li>
              <li>Go to <strong>Leads</strong> section</li>
              <li>Find a qualified lead and click <strong>Convert</strong></li>
              <li>Fill in the service amount and dates — this creates a project</li>
            </ol>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
        <form onSubmit={submit}>
          <div className="mb-4">
            <label className={labelCls}>
              Project <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            {projects.length === 0 ? (
              <div className="w-full px-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 bg-gray-50">
                No projects available — request will be submitted without a project link
              </div>
            ) : (
              <select value={form.projectId} onChange={set('projectId')} className={inputCls}>
                <option value="">— No project (operational expense) —</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {[
                      p.referenceNumber || p.name || p.id,
                      p.clientName ? `${p.clientName}` : null,
                      p.serviceAmount ? `KSh ${Number(p.serviceAmount).toLocaleString()}` : null,
                    ].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mb-4">
            <label className={labelCls}>Amount (KSh) <span className="text-red-500">*</span></label>
            <input required type="number" min={1} step="0.01" value={form.amount} onChange={set('amount')} className={inputCls} placeholder="0.00" />
          </div>
          <div className="mb-5">
            <label className={labelCls}>Purpose / Description <span className="text-red-500">*</span></label>
            <textarea required rows={3} value={form.purpose} onChange={set('purpose')} className={`${inputCls} resize-none`}
              placeholder="Describe what this payment is for…" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: submitting ? '#94a3b8' : themeHex, cursor: submitting ? 'not-allowed' : 'pointer', border: 'none' }}>
            {submitting ? 'Submitting…' : 'Submit Payment Request'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── COO Dashboard ────────────────────────────────────────────────────────────
const COO_NAV = [
  { id: 'overview', label: 'Overview', icon: I.overview },
  { id: 'departments', label: 'Departments', icon: I.dept },
  { id: 'achievements', label: 'Achievements', icon: I.achieve },
  { id: 'budget', label: 'Budget & Expenses', icon: I.budget },
  { id: 'payment-request', label: 'Payment Request', icon: I.funding },
  { id: 'reports', label: 'Reports', icon: I.reports },
  { id: 'chat', label: 'Chat', icon: I.chat },
  { id: 'daily-report', label: 'Daily Report', icon: I.report },
];

const COO_DEPTS = [
  { name: 'Client Acquisition', headCount: 12, kpiScore: 78 },
  { name: 'Account Management', headCount: 9, kpiScore: 85 },
  { name: 'Marketing', headCount: 6, kpiScore: 71 },
];

function COODashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: any[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [budgetForm, setBudgetForm] = useState({ amount: '', purpose: '', department: '' });
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: '', description: '' });
  const [formMsg, setFormMsg] = useState('');
  const [formOk, setFormOk] = useState(false);

  const metrics = data.metrics || {};
  const achievements = data.achievements || [];
  const teamReports = data.teamReports || [];
  const budgetRequests = data.budgetRequests || [];
  const expenseReports = data.expenseReports || [];
  const notifs = data.notifications || [];
  const clients = data.clients || [];

  const _unread = notifs.filter((n: any) => !n.read).length;
  const nav = COO_NAV;

  const submitBudget = async (e: React.FormEvent) => {
    e.preventDefault(); setFormMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/budget-requests', { ...budgetForm, amount: parseFloat(budgetForm.amount) });
      setFormOk(true); setFormMsg('Budget request submitted!');
      setBudgetForm({ amount: '', purpose: '', department: '' });
      refetch(['budgetRequests']);
    } catch (err: any) { setFormOk(false); setFormMsg(err?.response?.data?.error || 'Failed'); }
  };

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault(); setFormMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/expense-reports', { ...expenseForm, amount: parseFloat(expenseForm.amount) });
      setFormOk(true); setFormMsg('Expense report submitted!');
      setExpenseForm({ amount: '', category: '', description: '' });
      refetch(['expenseReports']);
    } catch (err: any) { setFormOk(false); setFormMsg(err?.response?.data?.error || 'Failed'); }
  };

  const submitted = teamReports.length; // every row in daily_reports IS a submitted report

  return (
    <PortalLayout theme={theme} user={{ name: user?.name || 'COO', email: user?.email || '', role: 'COO' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={CLEVEL_FAQS} portalName="C-Level Portal — COO">

      {section === 'overview' && (
        <div>
          <SectionHeader title="COO Overview" subtitle="Operations at a glance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Clients Added by Team" value={clients.length || metrics?.clients?.total || 0} icon={I.team} color={theme.hex} />
            <StatCard label="Active Leads in Group" value={metrics?.clients?.leads ?? metrics?.clients?.qualifiedLeads ?? 0} icon={I.overview} color={theme.hex} />
            <StatCard label="Closed Deals" value={metrics?.projects?.completed ?? metrics?.closedDeals ?? 0} icon={I.achieve} color={theme.hex} />
            <StatCard label="Daily Reports Submitted" value={`${submitted} / ${teamReports.length || 0}`} icon={I.report} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'departments' && (
        <div>
          <SectionHeader title="Departments" subtitle="KPI performance by department" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COO_DEPTS.map(dept => (
              <div key={dept.name} className={cardCls} style={cardStyle}>
                <p className="font-semibold text-gray-800 mb-1">{dept.name}</p>
                <p className="text-xs text-gray-500 mb-3">Head count: {dept.headCount}</p>
                <div className="mb-1 flex justify-between text-xs text-gray-600">
                  <span>KPI Score</span><span>{dept.kpiScore}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${dept.kpiScore}%`, background: `linear-gradient(90deg, ${theme.hex}99, ${theme.hex})` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'achievements' && (
        <div>
          <SectionHeader title="Achievements" subtitle="Cross-country COO performance" />
          <DataTable
            columns={[
              { key: 'country', label: 'Country' },
              { key: 'achievement', label: 'Achievement' },
              { key: 'clients', label: 'Clients', render: v => v ?? '—' },
              { key: 'deals', label: 'Deals', render: v => v ?? '—' },
              { key: 'leads', label: 'Leads', render: v => v ?? '—' },
              { key: 'period', label: 'Period' },
            ]}
            rows={achievements}
            emptyMessage="No achievements recorded"
          />
        </div>
      )}

      {section === 'budget' && (
        <div>
          <SectionHeader title="Budget & Expenses" subtitle="Submit requests and track status" />
          {formMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${formOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{formMsg}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <form onSubmit={submitBudget} className={cardCls} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-4">Submit Budget Request</p>
              <div className="mb-3"><label className={labelCls}>Amount *</label><input type="number" required value={budgetForm.amount} onChange={e => setBudgetForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0.00" /></div>
              <div className="mb-3"><label className={labelCls}>Purpose *</label><input required value={budgetForm.purpose} onChange={e => setBudgetForm(f => ({ ...f, purpose: e.target.value }))} className={inputCls} /></div>
              <div className="mb-4">
                <label className={labelCls}>Department</label>
                <select value={budgetForm.department} onChange={e => setBudgetForm(f => ({ ...f, department: e.target.value }))} className={inputCls}>
                  <option value="">— Select department —</option>
                  {[...new Map((data.departments || []).map((d: any) => [d.name, d])).values()].map((d: any) => (
                    <option key={d.id || d.name} value={d.name}>{d.name}</option>
                  ))}
                  {(data.departments || []).length === 0 && [
                    'Operations', 'Technology', 'Finance', 'Sales & Marketing', 'Client Success', 'Human Resources', 'Administration',
                  ].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <PortalButton color={theme.hex} fullWidth>Submit Budget Request</PortalButton>
            </form>
            <form onSubmit={submitExpense} className={cardCls} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-4">Submit Expense Report</p>
              <div className="mb-3"><label className={labelCls}>Amount *</label><input type="number" required value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0.00" /></div>
              <div className="mb-3">
                <label className={labelCls}>Category *</label>
                <select required value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                  <option value="">— Select category —</option>
                  {['Travel & Transport', 'Accommodation', 'Meals & Entertainment', 'Office Supplies', 'Software & Subscriptions', 'Equipment & Hardware', 'Training & Development', 'Marketing & Advertising', 'Utilities', 'Maintenance & Repairs', 'Salaries & Wages', 'Contractor Fees', 'Legal & Compliance', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4"><label className={labelCls}>Description</label><textarea rows={2} value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} /></div>
              <PortalButton color={theme.hex} fullWidth>Submit Expense Report</PortalButton>
            </form>
          </div>
          <div className="mb-6">
            <SectionHeader title="Budget Requests" />
            <DataTable columns={[
              { key: 'purpose', label: 'Purpose' },
              { key: 'amount', label: 'Amount', render: v => (v || 0).toLocaleString() },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'id', label: 'Actions', render: (_id, row: any) => (
                <div className="flex gap-1.5">
                  <PortalButton size="sm" variant="secondary" onClick={() => alert(`Budget Request\n\nPurpose: ${row.purpose}\nAmount: KSh ${(row.amount || 0).toLocaleString()}\nDepartment: ${row.department || '—'}\nStatus: ${row.status || 'PENDING'}`)}>View</PortalButton>
                  {(row.status === 'PENDING' || !row.status) && (
                    <PortalButton size="sm" variant="danger" onClick={async () => {
                      if (!window.confirm('Cancel this budget request?')) return;
                      try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/budget-requests/${id}/reject`, {}); refetch(['budgetRequests']); } catch { /* silent */ }
                    }}>Cancel</PortalButton>
                  )}
                </div>
              )},
            ]} rows={budgetRequests} emptyMessage="No budget requests" />
          </div>
          <div>
            <SectionHeader title="Expense Reports" />
            <DataTable columns={[
              { key: 'category', label: 'Category' },
              { key: 'amount', label: 'Amount', render: v => (v || 0).toLocaleString() },
              { key: 'description', label: 'Description' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'id', label: 'Actions', render: (id, row: any) => (
                <PortalButton size="sm" variant="secondary" onClick={() => alert(`Expense Report\n\nCategory: ${row.category}\nAmount: KSh ${(row.amount || 0).toLocaleString()}\nDescription: ${row.description || '—'}\nStatus: ${row.status || 'PENDING'}`)}>View</PortalButton>
              )},
            ]} rows={expenseReports} emptyMessage="No expense reports" />
          </div>
        </div>
      )}

      {section === 'reports' && (
        <div>
          <SectionHeader title="Reports" subtitle="Team daily reports — who submitted, when, and what they did" />
          <DataTable
            columns={[
              { key: 'userName', label: 'Submitted By', render: (v, r: any) => (
                <div>
                  <p className="font-medium text-gray-900 text-sm">{v || r.user || r.userId || '—'}</p>
                  <p className="text-xs text-gray-400">{r.userEmail || r.userRole || '—'}</p>
                </div>
              )},
              { key: 'userRole', label: 'Role', render: v => v ? <StatusBadge status={v} /> : <span className="text-gray-400 text-xs">—</span> },
              { key: 'reportDate', label: 'Report Date', render: v => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
              { key: 'submittedAt', label: 'Submitted At', render: v => v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—' },
              { key: 'hoursWorked', label: 'Hours', render: v => v != null ? `${v}h` : '—' },
              { key: 'accomplishments', label: 'Summary', render: v => <span className="text-xs text-gray-600">{v ? String(v).slice(0, 55) + (String(v).length > 55 ? '…' : '') : '—'}</span> },
              { key: 'id', label: 'Actions', render: (_v, row: any) => (
                <PortalButton size="sm" variant="secondary" onClick={() => alert(
                  `DAILY REPORT\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `Submitted by: ${row.userName || row.user || '—'}\n` +
                  `Email:        ${row.userEmail || '—'}\n` +
                  `Role:         ${row.userRole || '—'}\n` +
                  `Department:   ${row.userDepartment || '—'}\n` +
                  `Report Date:  ${row.reportDate ? new Date(row.reportDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}\n` +
                  `Submitted At: ${row.submittedAt ? new Date(row.submittedAt).toLocaleString('en-GB') : '—'}\n` +
                  `Hours Worked: ${row.hoursWorked != null ? row.hoursWorked + 'h' : '—'}\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `ACCOMPLISHMENTS:\n${row.accomplishments || '—'}\n\n` +
                  `CHALLENGES:\n${row.challenges || '—'}\n\n` +
                  `PLAN FOR TOMORROW:\n${row.tomorrowPlan || '—'}`
                )}>View</PortalButton>
              )},
            ]}
            rows={teamReports}
            emptyMessage="No team reports submitted yet"
          />
        </div>
      )}

      {section === 'chat' && <div><SectionHeader title="Chat" /><ChatSection token={user?.token || ''} currentUserId={user?.id || ''} portal="C-Level Portal" /></div>}
      {section === 'daily-report' && <div><SectionHeader title="Daily Report" subtitle="Submit your daily report" /><DailyReportForm /></div>}
      {section === 'payment-request' && (
        <div>
          <SectionHeader title="Payment Request" subtitle="Submit a payment request — approved & executed by CFO, CoS or CEO" />
          <PaymentRequestForm projects={data.projects || []} themeHex={theme.hex} onSubmitted={() => refetch()} />
        </div>
      )}
    </PortalLayout>
  );
}

// ─── All Members Section (proper component — hooks cannot be in IIFE) ────────
function AllMembersSection({ themeHex }: { themeHex: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [viewProfile, setViewProfile] = useState<any | null>(null);
  const [editMember, setEditMember] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', country: '', payoutMethod: 'MPESA', payoutPhone: '', payoutBankName: '', payoutBankAccount: '' });
  const [editMsg, setEditMsg] = useState('');
  const [editOk, setEditOk] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';
  const inp = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';

  const ROLE_COLORS: Record<string, string> = {
    DEVELOPER: '#4f46e5', TECH_STAFF: '#0891b2',
    HEAD_OF_TRAINERS: '#16a34a', TRAINER: '#d97706',
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { apiClient } = await import('../../shared/api/apiClient');
        const res = await apiClient.get('/api/v1/users?limit=200');
        const all: any[] = res.data?.data || res.data?.users || [];
        const ctoRoles = ['DEVELOPER', 'TECH_STAFF', 'HEAD_OF_TRAINERS', 'TRAINER'];
        if (!cancelled) setMembers(all.filter((u: any) => ctoRoles.includes(u.roleName || u.role)));
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || (m.fullName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
    const matchRole = !roleFilter || (m.roleName || m.role) === roleFilter;
    return matchSearch && matchRole;
  });

  const openEdit = (m: any) => {
    setEditMember(m);
    setEditForm({ fullName: m.fullName || '', phone: m.phone || '', country: m.country || '', payoutMethod: m.payoutMethod || 'MPESA', payoutPhone: m.payoutPhone || '', payoutBankName: m.payoutBankName || '', payoutBankAccount: m.payoutBankAccount || '' });
    setEditMsg(''); setEditOk(false);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editForm.payoutMethod === 'MPESA' && !editForm.payoutPhone.trim()) { setEditOk(false); setEditMsg('M-Pesa number is required.'); return; }
    if (editForm.payoutMethod === 'BANK' && !editForm.payoutBankAccount.trim()) { setEditOk(false); setEditMsg('Bank account number is required.'); return; }
    setEditBusy(true); setEditMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.put(`/api/v1/users/${editMember.id}`, { fullName: editForm.fullName.trim(), phone: editForm.phone.trim(), country: editForm.country.trim() });
      await apiClient.patch(`/api/v1/users/${editMember.id}/payout`, { payoutMethod: editForm.payoutMethod, payoutPhone: editForm.payoutPhone.trim() || undefined, payoutBankName: editForm.payoutBankName.trim() || undefined, payoutBankAccount: editForm.payoutBankAccount.trim() || undefined });
      setEditOk(true); setEditMsg('✓ Member updated successfully!');
      setMembers(prev => prev.map(m => m.id === editMember.id ? { ...m, ...editForm } : m));
      setTimeout(() => setEditMember(null), 1200);
    } catch (err: any) { setEditOk(false); setEditMsg(err?.response?.data?.error || 'Failed to update'); }
    finally { setEditBusy(false); }
  };

  const deleteMember = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.delete(`/api/v1/users/${id}`);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch (err: any) { alert(err?.response?.data?.error || 'Failed to delete'); }
    finally { setDeletingId(null); }
  };

  return (
    <div>
      <SectionHeader title="All Members" subtitle="View, edit, update payout details or remove CTO department members" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
          className="flex-1 min-w-48 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 transition-all" />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 transition-all">
          <option value="">All Roles</option>
          <option value="DEVELOPER">Developer</option>
          <option value="TECH_STAFF">Tech Staff</option>
          <option value="HEAD_OF_TRAINERS">Head of Trainers</option>
          <option value="TRAINER">Trainer</option>
        </select>
        <span className="px-3.5 py-2.5 text-sm text-gray-500">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading members…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No members found</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Member', 'Role', 'Country', 'Payout', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((m: any) => {
                const role = m.roleName || m.role || '—';
                const hasPayout = m.payoutMethod && (m.payoutPhone || m.payoutBankAccount);
                return (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: ROLE_COLORS[role] || '#94a3b8' }}>
                          {(m.fullName || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{m.fullName || '—'}</p>
                          <p className="text-xs text-gray-400">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: ROLE_COLORS[role] || '#94a3b8' }}>{role.replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.country || '—'}</td>
                    <td className="px-4 py-3">
                      {hasPayout ? (
                        <div><span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{m.payoutMethod}</span><p className="text-xs text-gray-400 mt-0.5">{m.payoutPhone || m.payoutBankAccount}</p></div>
                      ) : <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">⚠ Not set</span>}
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{m.isActive !== false ? 'Active' : 'Suspended'}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setViewProfile(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="View profile">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => deleteMember(m.id, m.fullName)} disabled={deletingId === m.id} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* View Profile Modal */}
      {viewProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewProfile(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: themeHex + '10' }}>
              <h2 className="text-base font-bold text-gray-900">Member Profile</h2>
              <button onClick={() => setViewProfile(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0" style={{ backgroundColor: ROLE_COLORS[viewProfile.roleName || viewProfile.role] || '#94a3b8' }}>
                  {(viewProfile.fullName || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{viewProfile.fullName}</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: ROLE_COLORS[viewProfile.roleName || viewProfile.role] || '#94a3b8' }}>
                    {(viewProfile.roleName || viewProfile.role || '').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Email', value: viewProfile.email },
                  { label: 'Phone', value: viewProfile.phone || '—' },
                  { label: 'Country', value: viewProfile.country || '—' },
                  { label: 'GitHub', value: viewProfile.githubUsername ? `@${viewProfile.githubUsername}` : '—' },
                  { label: 'Team Leader', value: viewProfile.isTeamLeader ? 'Yes' : 'No' },
                  { label: 'Payout Method', value: viewProfile.payoutMethod || '⚠ Not set' },
                  { label: 'Payout Account', value: viewProfile.payoutPhone || viewProfile.payoutBankAccount || '—' },
                  { label: 'Status', value: viewProfile.isActive !== false ? 'Active' : 'Suspended' },
                  { label: 'Joined', value: viewProfile.createdAt ? new Date(viewProfile.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                ].map(f => (
                  <div key={f.label} className="flex items-start justify-between gap-4">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">{f.label}</span>
                    <span className="text-sm text-gray-800 text-right">{f.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <PortalButton color={themeHex} fullWidth onClick={() => { setViewProfile(null); openEdit(viewProfile); }}>Edit</PortalButton>
                <PortalButton variant="secondary" fullWidth onClick={() => setViewProfile(null)}>Close</PortalButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditMember(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-gray-900">Edit — {editMember.fullName}</h2>
              <button onClick={() => setEditMember(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              {editMsg && <div className={`p-3 rounded-xl text-sm ${editOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{editMsg}</div>}
              <div><label className={lbl}>Full Name *</label><input required value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inp} /></div>
              <div><label className={lbl}>Phone</label><input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inp} /></div>
              <div><label className={lbl}>Country</label><input value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inp} /></div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Payment Receiving Account <span className="text-red-500">*</span></p>
                <div className="mb-3"><label className={lbl}>Method *</label>
                  <select required value={editForm.payoutMethod} onChange={e => setEditForm(f => ({ ...f, payoutMethod: e.target.value }))} className={`${inp} bg-white`}>
                    <option value="MPESA">M-Pesa</option><option value="BANK">Bank Account</option>
                  </select>
                </div>
                {editForm.payoutMethod === 'MPESA' ? (
                  <div><label className={lbl}>M-Pesa Number *</label><input required value={editForm.payoutPhone} onChange={e => setEditForm(f => ({ ...f, payoutPhone: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} placeholder="E.G. 0712345678" className={inp} /></div>
                ) : (
                  <div className="space-y-3">
                    <div><label className={lbl}>Bank Name</label><input value={editForm.payoutBankName} onChange={e => setEditForm(f => ({ ...f, payoutBankName: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} placeholder="E.G. EQUITY BANK" className={inp} /></div>
                    <div><label className={lbl}>Account Number *</label><input required value={editForm.payoutBankAccount} onChange={e => setEditForm(f => ({ ...f, payoutBankAccount: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} placeholder="E.G. 0123456789" className={inp} /></div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <PortalButton color={themeHex} fullWidth disabled={editBusy}>{editBusy ? 'Saving…' : 'Save Changes'}</PortalButton>
                <PortalButton variant="secondary" fullWidth onClick={() => setEditMember(null)} disabled={editBusy}>Cancel</PortalButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CTO Dashboard ────────────────────────────────────────────────────────────
const CTO_NAV = [
  { id: 'overview',          label: 'Overview',            icon: I.overview },
  { id: 'departments',       label: 'Departments',         icon: I.dept },
  { id: 'github',            label: 'GitHub',              icon: I.github },
  { id: 'team-velocity',     label: 'Team Velocity',       icon: I.reports },
  { id: 'member-performance',label: 'Member Performance',  icon: I.achieve },
  { id: 'achievements',      label: 'Achievements',        icon: I.achieve },
  { id: 'add-members',       label: 'Add Members',         icon: I.addmember },
  { id: 'all-members',       label: 'All Members',         icon: I.team },
  { id: 'contracts',         label: 'Contracts',           icon: I.contract },
  { id: 'tech-funding',      label: 'Tech Funding',        icon: I.funding },
  { id: 'payment-request',   label: 'Payment Request',     icon: I.budget },
  { id: 'chat',              label: 'Chat',                icon: I.chat },
  { id: 'daily-report',      label: 'Daily Report',        icon: I.report },
];

function CTODashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: any[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [addTab, setAddTab] = useState<'trainer' | 'hot' | 'member' | 'leader' | 'team'>('trainer');
  const [trainerForm, setTrainerForm] = useState({ name: '', email: '', country: '', region: '' });
  const [hotForm, setHotForm] = useState({ name: '', email: '', country: '' });
  const [memberForm, setMemberForm] = useState({ name: '', email: '', github: '', role: 'DEVELOPER', payoutMethod: 'MPESA', payoutPhone: '', payoutBankName: '', payoutBankAccount: '' });
  const [leaderForm, setLeaderForm] = useState({ teamId: '', memberId: '' });
  const [teamForm, setTeamForm] = useState({
    teamName: '', githubOrg: '',
    leaderName: '', leaderEmail: '', leaderPaymentType: 'MPESA', leaderPayment: '',
    member2Name: '', member2Email: '', member2PaymentType: 'MPESA', member2Payment: '',
    member3Name: '', member3Email: '', member3PaymentType: 'MPESA', member3Payment: '',
  });
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [fundingForm, setFundingForm] = useState({ project: '', amount: '', justification: '' });
  const [formMsg, setFormMsg] = useState('');
  const [formOk, setFormOk] = useState(false);
  // Assignment state — must be at component level (Rules of Hooks)
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignTeamId, setAssignTeamId] = useState('');
  const [assignMsg, setAssignMsg] = useState('');
  const [assignOk, setAssignOk] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);

  const metrics = data.metrics || {};
  const projects = data.projects || [];
  const repos = data.repos || [];
  const commits = data.commits || [];
  const teams = data.teams || [];
  const achievements = data.achievements || [];
  const contracts = data.contracts || [];
  const techRequests = data.techRequests || [];
  const notifs = data.notifications || [];

  const _unread = notifs.filter((n: any) => !n.read).length;
  const nav = CTO_NAV;

  const ongoing   = projects.filter((p: any) => projectDisplayStatus(p) === 'ACTIVE').length;
  const completed = projects.filter((p: any) => projectDisplayStatus(p) === 'CLOSED').length;
  const pending   = projects.filter((p: any) => projectDisplayStatus(p) === 'UPCOMING' || projectDisplayStatus(p) === 'PENDING_APPROVAL').length;

  const postInvite = async (payload: Record<string, string>) => {
    setFormMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      // Resolve role name → roleId
      const rolesRes = await apiClient.get('/api/v1/users/roles');
      const roles: any[] = rolesRes.data?.data || [];
      const roleObj = roles.find((r: any) => r.name === payload.role);
      if (!roleObj) {
        setFormOk(false); setFormMsg(`Role "${payload.role}" not found`); return;
      }
      await apiClient.post('/api/v1/users/invite', {
        email: payload.email,
        roleId: roleObj.id,
        payoutMethod: payload.payoutMethod || undefined,
        payoutPhone: payload.payoutPhone || undefined,
        payoutBankName: payload.payoutBankName || undefined,
        payoutBankAccount: payload.payoutBankAccount || undefined,
      });
      setFormOk(true); setFormMsg('Invitation sent!');
    } catch (err: any) { setFormOk(false); setFormMsg(err?.response?.data?.error || 'Failed'); }
  };

  const submitFunding = async (e: React.FormEvent) => {
    e.preventDefault(); setFormMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/tech-funding-requests', { ...fundingForm, amount: parseFloat(fundingForm.amount) });
      setFormOk(true); setFormMsg('Funding request submitted!');
      setFundingForm({ project: '', amount: '', justification: '' });
      refetch(['techRequests']);
    } catch (err: any) { setFormOk(false); setFormMsg(err?.response?.data?.error || 'Failed'); }
  };

  const assignLeader = async (e: React.FormEvent) => {
    e.preventDefault(); setFormMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post(`/api/v1/organization/teams/${leaderForm.teamId}/leader`, { memberId: leaderForm.memberId });
      setFormOk(true); setFormMsg('Team leader assigned!');
    } catch (err: any) { setFormOk(false); setFormMsg(err?.response?.data?.error || 'Failed'); }
  };

  return (
    <PortalLayout theme={theme} user={{ name: user?.name || 'CTO', email: user?.email || '', role: 'CTO' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={CLEVEL_FAQS} portalName="C-Level Portal — CTO">

      {section === 'overview' && (
        <div>
          <SectionHeader title="CTO Overview" subtitle="Technology operations at a glance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Ongoing Projects" value={ongoing} icon={I.overview} color={theme.hex} />
            <StatCard label="Completed Projects" value={completed} icon={I.achieve} color={theme.hex} />
            <StatCard label="Pending Projects" value={pending} icon={I.reports} color={theme.hex} />
            <StatCard label="Developer Team Count" value={teams.length || metrics.developerTeams || 0} icon={I.team} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'departments' && (
        <div>
          <SectionHeader title="Departments" subtitle="Technology department overview" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={cardCls} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-2">Technology Infrastructure & Security</p>
              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <span>Status: <StatusBadge status="ACTIVE" /></span>
                <span className="mt-1">Members: {metrics.coreSecurityMembers ?? '—'}</span>
                <span>Active Tasks: {metrics.coreSecurityTasks ?? '—'}</span>
              </div>
            </div>
            <div className={cardCls} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-2">Software Engineering & Product Development</p>
              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <span>Feature Board: <StatusBadge status={metrics.featureBoardStatus || 'IN_PROGRESS'} /></span>
                <span className="mt-1">Open PRs: {metrics.openPRs ?? '—'}</span>
                <span>QA Status: {metrics.qaStatus ?? '—'}</span>
              </div>
            </div>
            <div className={cardCls} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-3">Engineering Operations & Delivery</p>
              <div className="flex flex-col gap-2">
                {teams.slice(0, 4).map((t: any, i: number) => (
                  <div key={t.id || i} className="text-xs text-gray-700">
                    <span className="font-medium">{t.name || `Team ${i + 1}`}</span>
                    <span className="text-gray-400 ml-2">{t.memberCount ?? 3} members</span>
                    {t.leader && <span className="ml-2 text-cyan-600">★ {t.leader}</span>}
                  </div>
                ))}
                {teams.length === 0 && <p className="text-xs text-gray-400">No teams yet</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'github' && (
        <div>
          <SectionHeader title="GitHub" subtitle="Org-level stats, linked accounts, repositories, and sprint activity" />
          {/* Org-level stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className={cardCls} style={cardStyle}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Commits (7d)</p>
              <p className="text-2xl font-bold text-gray-800">{commits.length || '—'}</p>
            </div>
            <div className={cardCls} style={cardStyle}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Open PRs</p>
              <p className="text-2xl font-bold text-gray-800">{repos.reduce((s: number, r: any) => s + (r.openPRs || 0), 0) || '—'}</p>
            </div>
            <div className={cardCls} style={cardStyle}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Open Issues</p>
              <p className="text-2xl font-bold text-gray-800">{((metrics as any).openIssues ?? repos.reduce((s: number, r: any) => s + (r.openIssues || 0), 0)) || '—'}</p>
            </div>
            <div className={cardCls} style={cardStyle}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Active Repos</p>
              <p className="text-2xl font-bold text-gray-800">{repos.length || '—'}</p>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Linked GitHub Accounts</h3>
            <DataTable
              columns={[
                { key: 'developer', label: 'Developer', render: (v, r: any) => v || r.name || '—' },
                { key: 'username', label: 'GitHub Username' },
                { key: 'repos', label: 'Repos', render: v => v ?? '—' },
                { key: 'lastCommit', label: 'Last Commit', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              ]}
              rows={repos}
              emptyMessage="No GitHub accounts linked"
            />
          </div>
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Repository Activity Feed</h3>
            <div className="flex flex-col gap-2">
              {commits.slice(0, 10).map((c: any, i: number) => (
                <div key={c.id || i} className={`${cardCls} flex items-center gap-3 py-3`} style={cardStyle}>
                  <span className="text-xs font-mono text-cyan-600 w-16 flex-shrink-0">{(c.sha || c.id || '').slice(0, 7)}</span>
                  <span className="text-sm text-gray-700 flex-1">{c.message || c.commit || '—'}</span>
                  <span className="text-xs text-gray-400">{c.author || c.developer || '—'}</span>
                  <span className="text-xs text-gray-400">{c.date ? new Date(c.date).toLocaleDateString() : '—'}</span>
                </div>
              ))}
              {commits.length === 0 && <p className="text-sm text-gray-400">No commit activity</p>}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Sprint / Commit Summaries per Team</h3>
            <DataTable
              columns={[
                { key: 'team', label: 'Team' },
                { key: 'sprint', label: 'Sprint' },
                { key: 'commits', label: 'Commits', render: v => v ?? '—' },
                { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'IN_PROGRESS'} /> },
              ]}
              rows={teams.map((t: any) => ({ team: t.name, sprint: t.currentSprint || '—', commits: t.commitCount, status: t.sprintStatus || 'IN_PROGRESS' }))}
              emptyMessage="No sprint data"
            />
          </div>
        </div>
      )}

      {section === 'achievements' && (
        <div>
          <SectionHeader title="Achievements" subtitle="Cross-country CTO performance comparison" />
          <DataTable
            columns={[
              { key: 'country', label: 'Country' },
              { key: 'ongoingProjects', label: 'Ongoing', render: (v, r: any) => v ?? r.ongoing ?? '—' },
              { key: 'completedProjects', label: 'Completed', render: (v, r: any) => v ?? r.completed ?? '—' },
              { key: 'pendingProjects', label: 'Pending', render: (v, r: any) => v ?? r.pending ?? '—' },
              { key: 'period', label: 'Period' },
            ]}
            rows={achievements}
            emptyMessage="No achievements recorded"
          />
        </div>
      )}

      {section === 'add-members' && (
        <div>
          <SectionHeader title="Add Members" subtitle="Invite trainers, heads, developers — and create developer teams" />
          {formMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${formOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{formMsg}</div>}
          <div className="flex gap-2 mb-6 flex-wrap">
            {(['trainer', 'hot', 'member', 'leader', 'team'] as const).map(t => (
              <button key={t} onClick={() => { setAddTab(t); setFormMsg(''); }} className="px-4 py-2 rounded-xl text-sm font-medium transition-all" style={addTab === t ? { background: theme.hex, color: 'white' } : { background: 'rgba(255,255,255,0.7)', color: '#374151', border: '1px solid rgba(0,0,0,0.08)' }}>
                {t === 'trainer' ? 'Add Trainer' : t === 'hot' ? 'Add Head of Trainers' : t === 'member' ? 'Add CTO Dept Member' : t === 'leader' ? 'Assign Team Leader' : '+ Create Dev Team'}
              </button>
            ))}
          </div>

          {addTab === 'trainer' && (
            <form onSubmit={async e => { e.preventDefault(); await postInvite({ ...trainerForm, role: 'TRAINER' }); setTrainerForm({ name: '', email: '', country: '', region: '' }); }} className={`${cardCls} max-w-md`} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-1">Add Trainer</p>
              <p className="text-xs text-gray-500 mb-4">An invitation email will be sent. The trainer must complete their profile including M-Pesa or bank account before their profile is marked complete.</p>
              <div className="mb-3"><label className={labelCls}>Name *</label><input required value={trainerForm.name} onChange={e => setTrainerForm(f => ({ ...f, name: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>Email *</label><input type="email" required value={trainerForm.email} onChange={e => setTrainerForm(f => ({ ...f, email: e.target.value.toLowerCase() }))} style={{ textTransform: 'lowercase' }} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>Country</label><input value={trainerForm.country} onChange={e => setTrainerForm(f => ({ ...f, country: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inputCls} /></div>
              <div className="mb-4"><label className={labelCls}>Region</label><input value={trainerForm.region} onChange={e => setTrainerForm(f => ({ ...f, region: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inputCls} /></div>
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                ⚠ The trainer must enter their M-Pesa or bank account during profile setup — mandatory before first payment.
              </div>
              <PortalButton color={theme.hex} fullWidth>Send Invitation</PortalButton>
            </form>
          )}

          {addTab === 'hot' && (
            <form onSubmit={async e => { e.preventDefault(); await postInvite({ ...hotForm, role: 'HEAD_OF_TRAINERS' }); setHotForm({ name: '', email: '', country: '' }); }} className={`${cardCls} max-w-md`} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-1">Add Head of Trainers</p>
              <p className="text-xs text-gray-500 mb-4">An invitation email will be sent. The HoT must complete their profile including M-Pesa or bank account before their profile is marked complete.</p>
              <div className="mb-3"><label className={labelCls}>Name *</label><input required value={hotForm.name} onChange={e => setHotForm(f => ({ ...f, name: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>Email *</label><input type="email" required value={hotForm.email} onChange={e => setHotForm(f => ({ ...f, email: e.target.value.toLowerCase() }))} style={{ textTransform: 'lowercase' }} className={inputCls} /></div>
              <div className="mb-4"><label className={labelCls}>Country</label><input value={hotForm.country} onChange={e => setHotForm(f => ({ ...f, country: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inputCls} /></div>
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                ⚠ The Head of Trainers must enter their M-Pesa or bank account during profile setup — mandatory before first payment.
              </div>
              <PortalButton color={theme.hex} fullWidth>Send Invitation</PortalButton>
            </form>
          )}

          {addTab === 'member' && (
            <form onSubmit={async e => {
              e.preventDefault();
              // Validate payout for direct member creation
              if (!memberForm.payoutMethod) { setFormOk(false); setFormMsg('Payment method is required.'); return; }
              if (memberForm.payoutMethod === 'MPESA' && !memberForm.payoutPhone?.trim()) { setFormOk(false); setFormMsg('M-Pesa number is required.'); return; }
              if (memberForm.payoutMethod === 'BANK' && !memberForm.payoutBankAccount?.trim()) { setFormOk(false); setFormMsg('Bank account number is required.'); return; }
              await postInvite({ ...memberForm });
              setMemberForm({ name: '', email: '', github: '', role: 'DEVELOPER', payoutMethod: 'MPESA', payoutPhone: '', payoutBankName: '', payoutBankAccount: '' });
            }} className={`${cardCls} max-w-md`} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-1">Add CTO Dept Member</p>
              <p className="text-xs text-gray-500 mb-4">An invitation email will be sent. GitHub account is mandatory for all CTO department members.</p>
              <div className="mb-3"><label className={labelCls}>Name *</label><input required value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>Email *</label><input type="email" required value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value.toLowerCase() }))} style={{ textTransform: 'lowercase' }} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>GitHub Username *</label><input required value={memberForm.github} onChange={e => setMemberForm(f => ({ ...f, github: e.target.value.toLowerCase() }))} style={{ textTransform: 'lowercase' }} className={inputCls} placeholder="@username" /></div>
              <div className="mb-3">
                <label className={labelCls}>Role</label>
                <select value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                  <option value="DEVELOPER">Developer</option>
                  <option value="TECH_STAFF">Tech Staff (Infrastructure / Software Eng)</option>
                </select>
              </div>
              {/* Payout — mandatory */}
              <div className="pt-3 border-t border-gray-100 mb-3">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Payment Receiving Account <span className="text-red-500">*</span></p>
                <div className="mb-3">
                  <label className={labelCls}>Method *</label>
                  <select required value={(memberForm as any).payoutMethod || 'MPESA'} onChange={e => setMemberForm(f => ({ ...f, payoutMethod: e.target.value } as any))} className={inputCls}>
                    <option value="MPESA">M-Pesa</option>
                    <option value="BANK">Bank Account</option>
                  </select>
                </div>
                {(memberForm as any).payoutMethod === 'BANK' ? (
                  <div className="space-y-3">
                    <div><label className={labelCls}>Bank Name</label><input value={(memberForm as any).payoutBankName || ''} onChange={e => setMemberForm(f => ({ ...f, payoutBankName: e.target.value.toUpperCase() } as any))} style={{ textTransform: 'uppercase' }} placeholder="E.G. EQUITY BANK" className={inputCls} /></div>
                    <div><label className={labelCls}>Account Number *</label><input required value={(memberForm as any).payoutBankAccount || ''} onChange={e => setMemberForm(f => ({ ...f, payoutBankAccount: e.target.value.toUpperCase() } as any))} style={{ textTransform: 'uppercase' }} placeholder="E.G. 0123456789" className={inputCls} /></div>
                  </div>
                ) : (
                  <div><label className={labelCls}>M-Pesa Number *</label><input required value={(memberForm as any).payoutPhone || ''} onChange={e => setMemberForm(f => ({ ...f, payoutPhone: e.target.value.toUpperCase() } as any))} style={{ textTransform: 'uppercase' }} placeholder="E.G. 0712345678" className={inputCls} /></div>
                )}
              </div>
              <PortalButton color={theme.hex} fullWidth>Send Invitation</PortalButton>
            </form>
          )}

          {addTab === 'leader' && (
            <form onSubmit={assignLeader} className={`${cardCls} max-w-md`} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-4">Assign Team Leader</p>
              <div className="mb-3">
                <label className={labelCls}>Team *</label>
                <select required value={leaderForm.teamId} onChange={e => setLeaderForm(f => ({ ...f, teamId: e.target.value }))} className={inputCls}>
                  <option value="">Select team…</option>
                  {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className={labelCls}>Member ID *</label>
                <input required value={leaderForm.memberId} onChange={e => setLeaderForm(f => ({ ...f, memberId: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} className={inputCls} placeholder="Member ID" />
              </div>
              <PortalButton color={theme.hex} fullWidth>Assign Leader</PortalButton>
            </form>
          )}

          {/* ── Create Developer Team — CTO only (doc §11 Dept 3) ── */}
          {addTab === 'team' && (
            <div className={`${cardCls} max-w-2xl`} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-1">Create Developer Team</p>
              <p className="text-xs text-gray-500 mb-4">Each team: exactly 3 developers + 1 designated Team Leader (who is one of the 3). GitHub account mandatory for all.</p>
              {teamSubmitting && <div className="p-3 rounded-xl text-sm mb-4 bg-blue-50 text-blue-700">Creating team…</div>}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!teamForm.teamName.trim()) { setFormOk(false); setFormMsg('Team name is required.'); return; }
                setTeamSubmitting(true); setFormMsg('');
                try {
                  const { apiClient } = await import('../../shared/api/apiClient');
                  const members = [
                    { name: teamForm.leaderName.trim(), email: teamForm.leaderEmail.trim(), isLeader: true, paymentType: teamForm.leaderPaymentType, paymentAccount: teamForm.leaderPayment.trim() },
                    { name: teamForm.member2Name.trim(), email: teamForm.member2Email.trim(), isLeader: false, paymentType: teamForm.member2PaymentType, paymentAccount: teamForm.member2Payment.trim() },
                    { name: teamForm.member3Name.trim(), email: teamForm.member3Email.trim(), isLeader: false, paymentType: teamForm.member3PaymentType, paymentAccount: teamForm.member3Payment.trim() },
                  ].filter(m => m.name || m.email);
                  // Validate payout for each member that has a name/email
                  const missingPayout = members.find(m => !m.paymentAccount.trim());
                  if (missingPayout) { setFormOk(false); setFormMsg(`Payment account is required for ${missingPayout.name || 'all members'}.`); setTeamSubmitting(false); return; }
                  await apiClient.post('/api/v1/organization/teams', {
                    name: teamForm.teamName.trim(),
                    githubOrg: teamForm.githubOrg.trim() || undefined,
                    members: members.length > 0 ? members : undefined,
                  });
                  setFormOk(true); setFormMsg('✓ Team created successfully!');
                  setTeamForm({ teamName: '', githubOrg: '', leaderName: '', leaderEmail: '', leaderPaymentType: 'MPESA', leaderPayment: '', member2Name: '', member2Email: '', member2PaymentType: 'MPESA', member2Payment: '', member3Name: '', member3Email: '', member3PaymentType: 'MPESA', member3Payment: '' });
                  refetch(['teams']);
                } catch (err: any) { setFormOk(false); setFormMsg(err?.response?.data?.error || 'Failed to create team'); }
                finally { setTeamSubmitting(false); }
              }}>
                <div className="mb-4">
                  <label className={labelCls}>Team Name *</label>
                  <input type="text" required value={teamForm.teamName} onChange={e => setTeamForm(f => ({ ...f, teamName: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} placeholder="E.G. JUPITER STACK TEAM 1" className={inputCls} />
                </div>
                <div className="mb-4">
                  <label className={labelCls}>GitHub Organization</label>
                  <input type="text" value={teamForm.githubOrg} onChange={e => setTeamForm(f => ({ ...f, githubOrg: e.target.value.toLowerCase() }))} style={{ textTransform: 'lowercase' }} placeholder="e.g. techswifttrix" className={inputCls} />
                </div>
                {[
                  { nameKey: 'leaderName', emailKey: 'leaderEmail', payTypeKey: 'leaderPaymentType', payKey: 'leaderPayment', label: 'Team Leader ★' },
                  { nameKey: 'member2Name', emailKey: 'member2Email', payTypeKey: 'member2PaymentType', payKey: 'member2Payment', label: 'Member 2' },
                  { nameKey: 'member3Name', emailKey: 'member3Email', payTypeKey: 'member3PaymentType', payKey: 'member3Payment', label: 'Member 3' },
                ].map(f => (
                  <div key={f.label} className="mb-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{f.label}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" value={(teamForm as any)[f.nameKey]} onChange={e => setTeamForm(p => ({ ...p, [f.nameKey]: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} placeholder="FULL NAME" className={`${inputCls} text-sm`} />
                      <input type="email" value={(teamForm as any)[f.emailKey]} onChange={e => setTeamForm(p => ({ ...p, [f.emailKey]: e.target.value.toLowerCase() }))} style={{ textTransform: 'lowercase' }} placeholder="email@example.com" className={`${inputCls} text-sm`} />
                      <select value={(teamForm as any)[f.payTypeKey]} onChange={e => setTeamForm(p => ({ ...p, [f.payTypeKey]: e.target.value }))} className={`${inputCls} text-sm`}>
                        <option value="MPESA">M-Pesa</option>
                        <option value="BANK">Bank Account</option>
                      </select>
                      <input type="text" value={(teamForm as any)[f.payKey]} onChange={e => setTeamForm(p => ({ ...p, [f.payKey]: e.target.value.toUpperCase() }))} style={{ textTransform: 'uppercase' }} placeholder={(teamForm as any)[f.payTypeKey] === 'BANK' ? 'BANK ACCOUNT' : 'MPESA NUMBER'} className={`${inputCls} text-sm`} />
                    </div>
                  </div>
                ))}
                <PortalButton color={theme.hex} fullWidth disabled={teamSubmitting}>
                  {teamSubmitting ? 'Creating…' : 'Create Team'}
                </PortalButton>
              </form>
            </div>
          )}
        </div>
      )}

      {section === 'all-members' && <AllMembersSection themeHex={theme.hex} />}

      {section === 'contracts' && (
        <div>
          <SectionHeader title="Contracts & Project Assignment" subtitle="Assign projects to developer teams and manage contracts" />

          {/* Assignment panel */}
          <div className={`${cardCls} mb-6`} style={cardStyle}>
            <p className="font-semibold text-gray-800 mb-4">Assign Project to Developer Team</p>
            {assignMsg && (
              <div className={`p-3 rounded-xl text-sm mb-4 ${assignOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{assignMsg}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Project *</label>
                <select value={assignProjectId} onChange={e => setAssignProjectId(e.target.value)} className={inputCls}>
                  <option value="">— Select project —</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.referenceNumber || p.id}{p.clientName ? ` · ${p.clientName}` : ''}{p.teamName ? ` [${p.teamName}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Developer Team *</label>
                <select value={assignTeamId} onChange={e => setAssignTeamId(e.target.value)} className={inputCls}>
                  <option value="">— Select team —</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}{t.leaderName ? ` · Lead: ${t.leaderName}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <PortalButton
              color={theme.hex}
              disabled={assignBusy || !assignProjectId || !assignTeamId}
              onClick={async () => {
                setAssignBusy(true); setAssignMsg('');
                try {
                  const { apiClient } = await import('../../shared/api/apiClient');
                  await apiClient.post(`/api/v1/projects/${assignProjectId}/assign-team`, { teamId: assignTeamId });
                  setAssignOk(true);
                  setAssignMsg('Project assigned to team successfully!');
                  setAssignProjectId(''); setAssignTeamId('');
                  refetch(['projects', 'contracts']);
                } catch (err: any) {
                  setAssignOk(false);
                  setAssignMsg(err?.response?.data?.error || 'Failed to assign project');
                } finally { setAssignBusy(false); }
              }}
            >
              {assignBusy ? 'Assigning…' : 'Assign Project to Team'}
            </PortalButton>
          </div>

          {/* All projects */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">All Projects ({projects.length})</p>
            <DataTable
              columns={[
                { key: 'referenceNumber', label: 'Ref #',   render: (v, r: any) => <span className="font-mono text-xs font-semibold">{v || r.reference_number || '—'}</span> },
                { key: 'clientName',      label: 'Client',  render: v => v || '—' },
                { key: 'serviceAmount',   label: 'Amount',  render: (v, r: any) => v ? `${r.currency || 'KSh'} ${Number(v).toLocaleString()}` : '—' },
                { key: 'status',          label: 'Status',  render: (_v, r: any) => <StatusBadge status={projectDisplayStatus(r)} /> },
                { key: 'teamName',        label: 'Team',    render: v => v
                  ? <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{v}</span>
                  : <span className="text-xs text-gray-400 italic">Unassigned</span>
                },
              ]}
              rows={projects}
              emptyMessage="No projects found"
            />
          </div>

          {/* All contracts */}
          <p className="text-sm font-semibold text-gray-700 mb-3">All Contracts ({contracts.length})</p>
          <DataTable
            columns={[
              { key: 'referenceNumber',  label: 'Contract Ref', render: v => <span className="font-mono text-xs font-semibold">{v || '—'}</span> },
              { key: 'projectReference', label: 'Project',      render: v => v ? <span className="font-mono text-xs">{v}</span> : '—' },
              { key: 'teamName',         label: 'Team',         render: v => v
                ? <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{v}</span>
                : <span className="text-xs text-gray-400 italic">Unassigned</span>
              },
              { key: 'status', label: 'Status', render: (v, r: any) => {
                const linked = projects.find((p: any) => p.id === (r.projectId || r.project_id));
                return <StatusBadge status={linked ? projectDisplayStatus(linked) : (v || 'ACTIVE')} />;
              }},
              { key: 'id', label: 'Download', render: (_v, row: any) => (
                <PortalButton size="sm" color={theme.hex}
                  onClick={() => { const url = row.pdfUrl || row.downloadUrl; if (url) window.open(url, '_blank'); }}>
                  Download
                </PortalButton>
              )},
            ]}
            rows={contracts}
            emptyMessage="No contracts found"
          />
        </div>
      )}

      {section === 'tech-funding' && (
        <div>
          <SectionHeader title="Tech Funding" subtitle="Submit tech funding requests — approved by CFO, CoS or CEO" />
          {formMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${formOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{formMsg}</div>}
          <form onSubmit={submitFunding} className={`${cardCls} max-w-md mb-8`} style={cardStyle}>
            <p className="font-semibold text-gray-800 mb-4">New Funding Request</p>
            <div className="mb-3"><label className={labelCls}>Project *</label><input required value={fundingForm.project} onChange={e => setFundingForm(f => ({ ...f, project: e.target.value }))} className={inputCls} /></div>
            <div className="mb-3"><label className={labelCls}>Amount *</label><input type="number" required value={fundingForm.amount} onChange={e => setFundingForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0.00" /></div>
            <div className="mb-4"><label className={labelCls}>Justification *</label><textarea rows={3} required value={fundingForm.justification} onChange={e => setFundingForm(f => ({ ...f, justification: e.target.value }))} className={`${inputCls} resize-none`} /></div>
            <div className="flex gap-2">
              <PortalButton color={theme.hex} fullWidth>Submit Request</PortalButton>
              <PortalButton variant="secondary" onClick={() => setFundingForm({ project: '', amount: '', justification: '' })}>Clear</PortalButton>
            </div>
          </form>
          <SectionHeader title="Submitted Requests" />
          <DataTable
            columns={[
              { key: 'project', label: 'Project' },
              { key: 'amount', label: 'Amount', render: v => (v || 0).toLocaleString() },
              { key: 'justification', label: 'Justification', render: v => v ? String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '') : '—' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'id', label: 'Actions', render: (id, row: any) => (
                <div className="flex gap-1.5">
                  <PortalButton size="sm" variant="secondary" onClick={() => alert(`Tech Funding Request\n\nProject: ${row.project}\nAmount: KSh ${(row.amount || 0).toLocaleString()}\nStatus: ${row.status || 'PENDING'}\n\nJustification:\n${row.justification || '—'}`)}>View</PortalButton>
                  {(row.status === 'PENDING' || !row.status) && (
                    <PortalButton size="sm" variant="danger" onClick={async () => {
                      if (!window.confirm('Cancel this funding request?')) return;
                      try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/tech-funding-requests/${id}/reject`, {}); refetch(['techRequests']); } catch { /* silent */ }
                    }}>Cancel</PortalButton>
                  )}
                </div>
              )},
            ]}
            rows={techRequests}
            emptyMessage="No funding requests submitted"
          />
        </div>
      )}

      {section === 'team-velocity' && (
        <div>
          <SectionHeader title="Team Velocity" subtitle="Features and tasks completed per sprint per team" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {teams.map((t: any, i: number) => {
              const velocity = t.velocity || t.completedThisSprint || 0;
              return (
                <div key={t.id || i} className={cardCls} style={cardStyle}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: theme.hex }}>
                      {(t.name || 'T')[0].toUpperCase()}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm">{t.name || `Team ${i + 1}`}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-green-50 rounded-xl p-2">
                      <p className="text-lg font-bold text-green-700">{velocity}</p>
                      <p className="text-xs text-green-600">Done</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-2">
                      <p className="text-lg font-bold text-blue-700">{t.inProgress || 0}</p>
                      <p className="text-xs text-blue-600">In Progress</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2">
                      <p className="text-lg font-bold text-gray-700">{t.commitCount || 0}</p>
                      <p className="text-xs text-gray-500">Commits</p>
                    </div>
                  </div>
                  {t.currentSprint && <p className="text-xs text-gray-400 mt-2">Sprint: {t.currentSprint}</p>}
                </div>
              );
            })}
            {!teams.length && <p className="text-sm text-gray-400 col-span-3 text-center py-8">No teams found</p>}
          </div>
          <DataTable
            columns={[
              { key: 'name', label: 'Team' },
              { key: 'currentSprint', label: 'Current Sprint', render: v => v || '—' },
              { key: 'velocity', label: 'Velocity (Done)', render: (v, r: any) => v ?? r.completedThisSprint ?? '—' },
              { key: 'commitCount', label: 'Commits', render: v => v ?? '—' },
              { key: 'sprintStatus', label: 'Status', render: v => <StatusBadge status={v || 'IN_PROGRESS'} /> },
            ]}
            rows={teams}
            emptyMessage="No sprint data"
          />
        </div>
      )}

      {section === 'member-performance' && (
        <div>
          <SectionHeader title="Member Performance" subtitle="Aggregated daily report scores per developer" />
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            Score is derived from report submission frequency and average hours worked over the last 30 days.
          </div>
          <DataTable
            columns={[
              { key: 'name', label: 'Developer', render: (v, r: any) => (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: theme.hex }}>
                    {(v || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{v || '—'}</p>
                    <p className="text-xs text-gray-400">{r.teamName || '—'}</p>
                  </div>
                </div>
              )},
              { key: 'reportCount', label: 'Reports (30d)', render: v => v ?? '—' },
              { key: 'avgHours', label: 'Avg Hours/Day', render: v => v != null ? `${Number(v).toFixed(1)}h` : '—' },
              { key: 'score', label: 'Score', render: v => {
                const s = Number(v || 0);
                const color = s >= 80 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';
                return <span className="text-sm font-bold" style={{ color }}>{s > 0 ? `${s}%` : '—'}</span>;
              }},
              { key: 'lastReport', label: 'Last Report', render: v => v ? new Date(v).toLocaleDateString() : '—' },
            ]}
            rows={(data.teamReports || []).reduce((acc: any[], r: any) => {
              const key = r.userId || r.user_id || r.userName;
              const existing = acc.find((a: any) => (a.userId || a.userName) === key);
              if (existing) {
                existing.reportCount = (existing.reportCount || 0) + 1;
                existing.totalHours = (existing.totalHours || 0) + (parseFloat(r.hoursWorked || r.hours_worked) || 0);
                existing.avgHours = existing.totalHours / existing.reportCount;
                existing.score = Math.min(100, Math.round((existing.reportCount / 30) * 100 * Math.min(1, existing.avgHours / 8)));
                if (!existing.lastReport || new Date(r.reportDate || r.report_date) > new Date(existing.lastReport)) {
                  existing.lastReport = r.reportDate || r.report_date;
                }
              } else {
                const hours = parseFloat(r.hoursWorked || r.hours_worked) || 0;
                acc.push({
                  userId: r.userId || r.user_id,
                  name: r.userName || r.full_name || r.user,
                  teamName: r.teamName || r.team,
                  reportCount: 1,
                  totalHours: hours,
                  avgHours: hours,
                  score: Math.min(100, Math.round((1 / 30) * 100 * Math.min(1, hours / 8))),
                  lastReport: r.reportDate || r.report_date,
                });
              }
              return acc;
            }, []).sort((a: any, b: any) => (b.score || 0) - (a.score || 0))}
            emptyMessage="No daily reports submitted yet"
          />
        </div>
      )}

      {section === 'chat' && <div><SectionHeader title="Chat" /><ChatSection token={user?.token || ''} currentUserId={user?.id || ''} portal="C-Level Portal" /></div>}
      {section === 'daily-report' && <div><SectionHeader title="Daily Report" subtitle="Submit your daily report" /><DailyReportForm /></div>}
      {section === 'payment-request' && (
        <div>
          <SectionHeader title="Payment Request" subtitle="Submit a payment request — approved & executed by CFO, CoS or CEO" />
          <PaymentRequestForm projects={projects} themeHex={theme.hex} onSubmitted={() => refetch()} />
        </div>
      )}
    </PortalLayout>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function CLevelPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, loading, refetch } = useMultiPortalData([
    { key: 'metrics',       endpoint: '/api/v1/dashboard/metrics',        fallback: {} },
    { key: 'departments',   endpoint: '/api/v1/organization/departments',  fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.departments ?? []) },
    { key: 'projects',      endpoint: '/api/v1/projects',                  fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.projects ?? []) },
    { key: 'repos',         endpoint: '/api/v1/github/repos',              fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.repos ?? []) },
    { key: 'commits',       endpoint: '/api/v1/github/commits',            fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.commits ?? []) },
    { key: 'teams',         endpoint: '/api/v1/organization/teams',        fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.teams ?? []) },
    { key: 'achievements',  endpoint: '/api/v1/achievements',              fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.achievements ?? []) },
    { key: 'clients',       endpoint: '/api/v1/clients/all',               fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.clients ?? []) },
    { key: 'teamReports',   endpoint: '/api/v1/daily-reports/team',        fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.reports ?? []) },
    { key: 'budgetRequests',endpoint: '/api/v1/budget-requests',           fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.budgetRequests ?? []) },
    { key: 'expenseReports',endpoint: '/api/v1/expense-reports',           fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.expenseReports ?? []) },
    { key: 'contracts',     endpoint: '/api/v1/contracts',                 fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.contracts ?? []) },
    { key: 'techRequests',  endpoint: '/api/v1/tech-funding-requests',     fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.requests ?? []) },
    { key: 'notifications', endpoint: '/api/v1/notifications',             fallback: [], transform: r => Array.isArray(r) ? r : (r?.notifications ?? r?.data ?? []) },
  ], [
    'data:project:created', 'data:project:updated', 'data:client:status_changed',
    'data:metrics:updated', 'data:notification:new', 'data:contract:generated',
  ]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #f5f0ff 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${theme.hex} transparent transparent transparent` }} />
          <p className="text-sm text-gray-500">Loading portal…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  if (user.role === 'COO') {
    return <COODashboard data={data} refetch={refetch} user={user} onLogout={() => { logout(); navigate('/login'); }} />;
  }

  if (user.role === 'CTO') {
    return <CTODashboard data={data} refetch={refetch} user={user} onLogout={() => { logout(); navigate('/login'); }} />;
  }

  // Fallback for unexpected roles
  return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #f5f0ff 100%)' }}>
      <div className={`${cardCls} text-center max-w-sm`} style={cardStyle}>
        <p className="text-gray-700 font-medium mb-2">Access Restricted</p>
        <p className="text-sm text-gray-500 mb-4">This portal is for COO and CTO roles only.</p>
        <PortalButton color={theme.hex} onClick={() => { logout(); navigate('/login'); }}>Sign Out</PortalButton>
      </div>
    </div>
  );
}
