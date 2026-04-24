import React, { useState } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';

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
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', { ...form, hoursWorked: parseFloat(form.hours) || undefined, reportDate: new Date().toISOString().split('T')[0] });
      setOk(true); setMsg('Report submitted!'); setForm({ accomplishments: '', challenges: '', plan: '', hours: '' });
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
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-gray-300' : 'bg-cyan-500'}`} />
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

// ─── COO Dashboard ────────────────────────────────────────────────────────────
const COO_NAV = [
  { id: 'overview', label: 'Overview', icon: I.overview },
  { id: 'departments', label: 'Departments', icon: I.dept },
  { id: 'achievements', label: 'Achievements', icon: I.achieve },
  { id: 'budget', label: 'Budget & Expenses', icon: I.budget },
  { id: 'reports', label: 'Reports', icon: I.reports },
  { id: 'chat', label: 'Chat', icon: I.chat },
  { id: 'notifications', label: 'Notifications', icon: I.notif },
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

  const unread = notifs.filter((n: any) => !n.read).length;
  const nav = COO_NAV.map(n => n.id === 'notifications' ? { ...n, badge: unread } : n);

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

  const submitted = teamReports.filter((r: any) => r.status === 'SUBMITTED' || r.submitted).length;

  return (
    <PortalLayout theme={theme} user={{ name: user?.name || 'COO', email: user?.email || '', role: 'COO' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout}>

      {section === 'overview' && (
        <div>
          <SectionHeader title="COO Overview" subtitle="Operations at a glance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Clients Added by Team" value={clients.length || metrics.totalClients || 0} icon={I.team} color={theme.hex} />
            <StatCard label="Active Leads in Group" value={metrics.activeLeads ?? 0} icon={I.overview} color={theme.hex} />
            <StatCard label="Closed Deals" value={metrics.closedDeals ?? 0} icon={I.achieve} color={theme.hex} />
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
              <div className="mb-4"><label className={labelCls}>Department</label><input value={budgetForm.department} onChange={e => setBudgetForm(f => ({ ...f, department: e.target.value }))} className={inputCls} /></div>
              <PortalButton color={theme.hex} fullWidth>Submit Budget Request</PortalButton>
            </form>
            <form onSubmit={submitExpense} className={cardCls} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-4">Submit Expense Report</p>
              <div className="mb-3"><label className={labelCls}>Amount *</label><input type="number" required value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0.00" /></div>
              <div className="mb-3"><label className={labelCls}>Category *</label><input required value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} className={inputCls} /></div>
              <div className="mb-4"><label className={labelCls}>Description</label><textarea rows={2} value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} /></div>
              <PortalButton color={theme.hex} fullWidth>Submit Expense Report</PortalButton>
            </form>
          </div>
          <div className="mb-6">
            <SectionHeader title="Budget Requests" />
            <DataTable columns={[{ key: 'purpose', label: 'Purpose' }, { key: 'amount', label: 'Amount', render: v => (v || 0).toLocaleString() }, { key: 'department', label: 'Department' }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> }]} rows={budgetRequests} emptyMessage="No budget requests" />
          </div>
          <div>
            <SectionHeader title="Expense Reports" />
            <DataTable columns={[{ key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: v => (v || 0).toLocaleString() }, { key: 'description', label: 'Description' }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> }]} rows={expenseReports} emptyMessage="No expense reports" />
          </div>
        </div>
      )}

      {section === 'reports' && (
        <div>
          <SectionHeader title="Reports" subtitle="Team daily reports and monthly operations summary" />
          <DataTable
            columns={[
              { key: 'user', label: 'User', render: (v, r: any) => v || r.userName || r.userId || '—' },
              { key: 'reportDate', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'status', label: 'Status', render: (v, r: any) => <StatusBadge status={v || (r.submitted ? 'SUBMITTED' : 'PENDING')} /> },
              { key: 'accomplishments', label: 'Accomplishments', render: v => v ? String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '') : '—' },
            ]}
            rows={teamReports}
            emptyMessage="No team reports"
          />
        </div>
      )}

      {section === 'chat' && <div><SectionHeader title="Chat" /><ChatSection /></div>}
      {section === 'notifications' && <div><SectionHeader title="Notifications" /><NotificationsSection notifs={notifs} /></div>}
      {section === 'daily-report' && <div><SectionHeader title="Daily Report" subtitle="Submit your daily report" /><DailyReportForm /></div>}
    </PortalLayout>
  );
}

// ─── CTO Dashboard ────────────────────────────────────────────────────────────
const CTO_NAV = [
  { id: 'overview', label: 'Overview', icon: I.overview },
  { id: 'departments', label: 'Departments', icon: I.dept },
  { id: 'github', label: 'GitHub', icon: I.github },
  { id: 'achievements', label: 'Achievements', icon: I.achieve },
  { id: 'add-members', label: 'Add Members', icon: I.addmember },
  { id: 'contracts', label: 'Contracts', icon: I.contract },
  { id: 'tech-funding', label: 'Tech Funding', icon: I.funding },
  { id: 'chat', label: 'Chat', icon: I.chat },
  { id: 'notifications', label: 'Notifications', icon: I.notif },
  { id: 'daily-report', label: 'Daily Report', icon: I.report },
];

function CTODashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: any[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [addTab, setAddTab] = useState<'trainer' | 'hot' | 'member' | 'leader'>('trainer');
  const [trainerForm, setTrainerForm] = useState({ name: '', email: '', country: '', region: '' });
  const [hotForm, setHotForm] = useState({ name: '', email: '', country: '' });
  const [memberForm, setMemberForm] = useState({ name: '', email: '', github: '', role: 'DEVELOPER' });
  const [leaderForm, setLeaderForm] = useState({ teamId: '', memberId: '' });
  const [fundingForm, setFundingForm] = useState({ project: '', amount: '', justification: '' });
  const [formMsg, setFormMsg] = useState('');
  const [formOk, setFormOk] = useState(false);

  const metrics = data.metrics || {};
  const projects = data.projects || [];
  const repos = data.repos || [];
  const commits = data.commits || [];
  const teams = data.teams || [];
  const achievements = data.achievements || [];
  const contracts = data.contracts || [];
  const techRequests = data.techRequests || [];
  const notifs = data.notifications || [];

  const unread = notifs.filter((n: any) => !n.read).length;
  const nav = CTO_NAV.map(n => n.id === 'notifications' ? { ...n, badge: unread } : n);

  const ongoing = projects.filter((p: any) => p.status === 'IN_PROGRESS' || p.status === 'ONGOING').length;
  const completed = projects.filter((p: any) => p.status === 'COMPLETED').length;
  const pending = projects.filter((p: any) => p.status === 'PENDING' || p.status === 'NOT_STARTED').length;

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
      await apiClient.post('/api/v1/users/invite', { email: payload.email, roleId: roleObj.id });
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
    <PortalLayout theme={theme} user={{ name: user?.name || 'CTO', email: user?.email || '', role: 'CTO' }} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={onLogout}>

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
          <SectionHeader title="GitHub" subtitle="Linked accounts, repositories, and sprint activity" />
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
          <SectionHeader title="Add Members" subtitle="Invite trainers, heads, and developers" />
          {formMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${formOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{formMsg}</div>}
          <div className="flex gap-2 mb-6 flex-wrap">
            {(['trainer', 'hot', 'member', 'leader'] as const).map(t => (
              <button key={t} onClick={() => { setAddTab(t); setFormMsg(''); }} className="px-4 py-2 rounded-xl text-sm font-medium transition-all" style={addTab === t ? { background: theme.hex, color: 'white' } : { background: 'rgba(255,255,255,0.7)', color: '#374151', border: '1px solid rgba(0,0,0,0.08)' }}>
                {t === 'trainer' ? 'Add Trainer' : t === 'hot' ? 'Add Head of Trainers' : t === 'member' ? 'Add CTO Dept Member' : 'Assign Team Leader'}
              </button>
            ))}
          </div>

          {addTab === 'trainer' && (
            <form onSubmit={async e => { e.preventDefault(); await postInvite({ ...trainerForm, role: 'TRAINER' }); setTrainerForm({ name: '', email: '', country: '', region: '' }); }} className={`${cardCls} max-w-md`} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-4">Add Trainer</p>
              <div className="mb-3"><label className={labelCls}>Name *</label><input required value={trainerForm.name} onChange={e => setTrainerForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>Email *</label><input type="email" required value={trainerForm.email} onChange={e => setTrainerForm(f => ({ ...f, email: e.target.value }))} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>Country</label><input value={trainerForm.country} onChange={e => setTrainerForm(f => ({ ...f, country: e.target.value }))} className={inputCls} /></div>
              <div className="mb-4"><label className={labelCls}>Region</label><input value={trainerForm.region} onChange={e => setTrainerForm(f => ({ ...f, region: e.target.value }))} className={inputCls} /></div>
              <PortalButton color={theme.hex} fullWidth>Send Invitation</PortalButton>
            </form>
          )}

          {addTab === 'hot' && (
            <form onSubmit={async e => { e.preventDefault(); await postInvite({ ...hotForm, role: 'HEAD_OF_TRAINERS' }); setHotForm({ name: '', email: '', country: '' }); }} className={`${cardCls} max-w-md`} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-4">Add Head of Trainers</p>
              <div className="mb-3"><label className={labelCls}>Name *</label><input required value={hotForm.name} onChange={e => setHotForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>Email *</label><input type="email" required value={hotForm.email} onChange={e => setHotForm(f => ({ ...f, email: e.target.value }))} className={inputCls} /></div>
              <div className="mb-4"><label className={labelCls}>Country</label><input value={hotForm.country} onChange={e => setHotForm(f => ({ ...f, country: e.target.value }))} className={inputCls} /></div>
              <PortalButton color={theme.hex} fullWidth>Send Invitation</PortalButton>
            </form>
          )}

          {addTab === 'member' && (
            <form onSubmit={async e => { e.preventDefault(); await postInvite({ ...memberForm }); setMemberForm({ name: '', email: '', github: '', role: 'DEVELOPER' }); }} className={`${cardCls} max-w-md`} style={cardStyle}>
              <p className="font-semibold text-gray-800 mb-4">Add CTO Dept Member</p>
              <div className="mb-3"><label className={labelCls}>Name *</label><input required value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>Email *</label><input type="email" required value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} className={inputCls} /></div>
              <div className="mb-3"><label className={labelCls}>GitHub Username *</label><input required value={memberForm.github} onChange={e => setMemberForm(f => ({ ...f, github: e.target.value }))} className={inputCls} placeholder="@username" /></div>
              <div className="mb-4">
                <label className={labelCls}>Role</label>
                <select value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                  <option value="DEVELOPER">Developer</option>
                  <option value="TECHNOLOGY_USER">Technology User</option>
                </select>
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
                <input required value={leaderForm.memberId} onChange={e => setLeaderForm(f => ({ ...f, memberId: e.target.value }))} className={inputCls} placeholder="Member ID" />
              </div>
              <PortalButton color={theme.hex} fullWidth>Assign Leader</PortalButton>
            </form>
          )}
        </div>
      )}

      {section === 'contracts' && (
        <div>
          <SectionHeader title="Contracts" subtitle="Contracts assigned to developer teams" />
          <DataTable
            columns={[
              { key: 'reference', label: 'Reference', render: (v, r: any) => v || r.contractNumber || '—' },
              { key: 'team', label: 'Team', render: (v, r: any) => v || r.teamName || '—' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'signed', label: 'Signed', render: v => v ? <StatusBadge status="VERIFIED" /> : <StatusBadge status="PENDING" /> },
              { key: 'id', label: 'Download', render: (_v, row: any) => (
                <PortalButton size="sm" color={theme.hex} onClick={() => { if (row.downloadUrl) window.open(row.downloadUrl, '_blank'); }}>Download</PortalButton>
              )},
            ]}
            rows={contracts}
            emptyMessage="No contracts assigned"
          />
        </div>
      )}

      {section === 'tech-funding' && (
        <div>
          <SectionHeader title="Tech Funding" subtitle="Submit funding requests to CoS" />
          {formMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${formOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{formMsg}</div>}
          <form onSubmit={submitFunding} className={`${cardCls} max-w-md mb-8`} style={cardStyle}>
            <p className="font-semibold text-gray-800 mb-4">New Funding Request</p>
            <div className="mb-3"><label className={labelCls}>Project *</label><input required value={fundingForm.project} onChange={e => setFundingForm(f => ({ ...f, project: e.target.value }))} className={inputCls} /></div>
            <div className="mb-3"><label className={labelCls}>Amount *</label><input type="number" required value={fundingForm.amount} onChange={e => setFundingForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0.00" /></div>
            <div className="mb-4"><label className={labelCls}>Justification *</label><textarea rows={3} required value={fundingForm.justification} onChange={e => setFundingForm(f => ({ ...f, justification: e.target.value }))} className={`${inputCls} resize-none`} /></div>
            <PortalButton color={theme.hex} fullWidth>Submit Request</PortalButton>
          </form>
          <SectionHeader title="Submitted Requests" />
          <DataTable
            columns={[
              { key: 'project', label: 'Project' },
              { key: 'amount', label: 'Amount', render: v => (v || 0).toLocaleString() },
              { key: 'justification', label: 'Justification', render: v => v ? String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '') : '—' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
            ]}
            rows={techRequests}
            emptyMessage="No funding requests submitted"
          />
        </div>
      )}

      {section === 'chat' && <div><SectionHeader title="Chat" /><ChatSection /></div>}
      {section === 'notifications' && <div><SectionHeader title="Notifications" /><NotificationsSection notifs={notifs} /></div>}
      {section === 'daily-report' && <div><SectionHeader title="Daily Report" subtitle="Submit your daily report" /><DailyReportForm /></div>}
    </PortalLayout>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function CLevelPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, loading, refetch } = useMultiPortalData([
    { key: 'metrics',       endpoint: '/api/v1/dashboard/metrics',        fallback: {} },
    { key: 'departments',   endpoint: '/api/v1/organization/departments',  fallback: {} },
    { key: 'projects',      endpoint: '/api/v1/projects',                  fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.projects ?? []) },
    { key: 'repos',         endpoint: '/api/v1/github/repos',              fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.repos ?? []) },
    { key: 'commits',       endpoint: '/api/v1/github/commits',            fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.commits ?? []) },
    { key: 'teams',         endpoint: '/api/v1/organization/teams',        fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.teams ?? []) },
    { key: 'achievements',  endpoint: '/api/v1/achievements',              fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.achievements ?? []) },
    { key: 'clients',       endpoint: '/api/v1/clients',                   fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.clients ?? []) },
    { key: 'teamReports',   endpoint: '/api/v1/reports/team',              fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.reports ?? []) },
    { key: 'budgetRequests',endpoint: '/api/v1/budget-requests',           fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.budgetRequests ?? []) },
    { key: 'expenseReports',endpoint: '/api/v1/expense-reports',           fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.expenseReports ?? []) },
    { key: 'contracts',     endpoint: '/api/v1/contracts',                 fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.contracts ?? []) },
    { key: 'techRequests',  endpoint: '/api/v1/tech-funding-requests',     fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.requests ?? []) },
    { key: 'notifications', endpoint: '/api/v1/notifications',             fallback: [], transform: r => Array.isArray(r) ? r : (r?.data ?? r?.notifications ?? []) },
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
