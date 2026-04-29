import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';
import { AFRICAN_COUNTRIES } from '../../shared/utils/africanCountries';
import ChatPanel from '../../shared/components/chat/ChatPanel';
import { TRAINERS_FAQS } from '../../shared/data/portalFAQs';
import PlotConnectProperties from '../../shared/components/plotconnect/PlotConnectProperties';

const theme = PORTAL_THEMES.trainers;
const cardCls = 'rounded-2xl p-5';
const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)' };
const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

// ─── Icons ────────────────────────────────────────────────────────────────────
const I = {
  overview: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  agents: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  leads: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  achieve: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  chat: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  notif: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  report: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  trainers: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  addAgent: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
  country: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

// ─── Country combobox ─────────────────────────────────────────────────────────
function CountryCombobox({ value, onChange, inputCls }: { value: string; onChange: (v: string) => void; inputCls: string }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Keep input in sync when parent resets
  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? AFRICAN_COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : AFRICAN_COUNTRIES.slice(0, 8);

  const select = (name: string) => { onChange(name); setQuery(name); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Type to search country…"
        className={inputCls}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto text-sm">
          {filtered.map(c => (
            <li key={c.code}
              onMouseDown={() => select(c.name)}
              className="px-3 py-2 cursor-pointer hover:bg-purple-50 flex items-center justify-between">
              <span>{c.name}</span>
              <span className="text-xs text-gray-400">{c.region}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Shared: Daily Report Form ────────────────────────────────────────────────
function DailyReportForm() {
  const [form, setForm] = useState({ accomplishments: '', challenges: '', plan: '', hours: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const clear = () => setForm({ accomplishments: '', challenges: '', plan: '', hours: '' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', {
        ...form,
        hoursWorked: parseFloat(form.hours) || undefined,
        reportDate: new Date().toISOString().split('T')[0],
      });
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
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-gray-300' : 'bg-emerald-500'}`} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{n.title || n.message || 'Notification'}</p>
            {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
            <p className="text-xs text-gray-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
          </div>
          {!n.read && (
            <button onClick={() => markRead(n.id)} className="text-xs text-emerald-600 hover:underline flex-shrink-0 mt-0.5">Mark read</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TRAINER Dashboard ────────────────────────────────────────────────────────
const TRAINER_NAV = [
  { id: 'overview',    label: 'Overview',    icon: I.overview },
  { id: 'my-agents',   label: 'My Agents',   icon: I.agents },
  { id: 'client-leads',label: 'Client Leads',icon: I.leads },
  { id: 'achievements',label: 'Achievements',icon: I.achieve },
  { id: 'chat-cfo',    label: 'Chat with CFO',icon: I.chat },
  { id: 'daily-report',label: 'Daily Report',icon: I.report },
];

function TrainerDashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: any[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [priorityAgentId, setPriorityAgentId] = useState<string | null>(null);
  const [priorityTier, setPriorityTier] = useState('Top');
  const [priorityMsg, setPriorityMsg] = useState('');
  const [priorityOk, setPriorityOk] = useState(false);

  const agents = data.myAgents || [];
  const clients = data.clients || [];
  const achievements = data.achievements || [];
  const notifs = data.notifications || [];
  const metrics = data.metrics || {};

  const nav = TRAINER_NAV;

  const activeLeads = clients.filter((c: any) =>
    ['CONVERTED', 'LEAD_ACTIVATED', 'LEAD_QUALIFIED', 'NEGOTIATION'].includes(c.status)
  ).length;
  const convertedThisMonth = clients.filter((c: any) => {
    const converted = c.status === 'CONVERTED' || c.leadStatus === 'CONVERTED';
    if (!converted) return false;
    const d = new Date(c.convertedAt || c.updatedAt || '');
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const submitPriority = async (agentId: string) => {
    setPriorityMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post(`/api/v1/agents/${agentId}/priority-listing`, { tier: priorityTier });
      setPriorityOk(true); setPriorityMsg('Priority updated!');
      setPriorityAgentId(null);
      refetch(['myAgents']);
    } catch (err: any) { setPriorityOk(false); setPriorityMsg(err?.response?.data?.error || 'Failed'); }
  };

  return (
    <PortalLayout
      theme={theme}
      user={{ name: user?.name || 'Trainer', email: user?.email || '', role: 'TRAINER' }}
      navItems={nav}
      activeSection={section}
      onSectionChange={setSection}
      onLogout={onLogout}
      notifications={notifs}
      onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }}
      faqs={TRAINERS_FAQS}
      portalName="Trainers Portal"
    >
      {section === 'overview' && (
        <div>
          <SectionHeader title="Trainer Overview" subtitle="Your performance at a glance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="My Agents" value={agents.length || metrics.agentCount || 0} icon={I.agents} color={theme.hex} />
            <StatCard label="Active Leads" value={activeLeads || metrics.activeLeads || 0} icon={I.leads} color={theme.hex} />
            <StatCard label="Converted This Month" value={convertedThisMonth || metrics.convertedThisMonth || 0} icon={I.achieve} color={theme.hex} />
            <StatCard label="Country Performance" value={metrics.countryScore ?? '—'} icon={I.country} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'my-agents' && (
        <div>
          <SectionHeader title="My Agents" subtitle="Agents assigned to you" />
          {priorityMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${priorityOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{priorityMsg}</div>}
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'phone', label: 'Phone' },
              { key: 'region', label: 'Region' },
              { key: 'performanceScore', label: 'Score', render: v => v ?? '—' },
              { key: 'assignedDate', label: 'Assigned', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              {
                key: 'id', label: 'Actions', render: (_v, row: any) =>
                  priorityAgentId === (row.id || row._id) ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      <select value={priorityTier} onChange={e => setPriorityTier(e.target.value)} className="px-2 py-1 rounded-lg border border-gray-200 text-xs">
                        <option>Top</option>
                        <option>Medium</option>
                        <option>Basic</option>
                      </select>
                      <PortalButton size="sm" color={theme.hex} onClick={() => submitPriority(row.id || row._id)}>Save</PortalButton>
                      <PortalButton size="sm" variant="secondary" onClick={() => setPriorityAgentId(null)}>Cancel</PortalButton>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <PortalButton size="sm" variant="secondary" onClick={() => alert(`Agent: ${row.name}\nPhone: ${row.phone || '—'}\nRegion: ${row.region || '—'}\nScore: ${row.performanceScore ?? '—'}\nAssigned: ${row.assignedDate ? new Date(row.assignedDate).toLocaleDateString() : '—'}`)}>View</PortalButton>
                      <PortalButton size="sm" color={theme.hex} onClick={() => { setPriorityAgentId(row.id || row._id); setPriorityTier('Top'); }}>
                        Priority
                      </PortalButton>
                    </div>
                  ),
              },
            ]}
            rows={agents}
            emptyMessage="No agents assigned yet"
          />
        </div>
      )}

      {section === 'client-leads' && (
        <div>
          <SectionHeader title="Client Leads" subtitle="Clients from your agents" />
          <DataTable
            columns={[
              { key: 'name', label: 'Client Name', render: (v, r: any) => v || r.clientName || '—' },
              { key: 'agentName', label: 'Agent', render: (v, r: any) => v || r.agent || '—' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'createdAt', label: 'Date Added', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'paymentStatus', label: 'Payment', render: v => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'id', label: 'Actions', render: (_v, row: any) => (
                <PortalButton size="sm" variant="secondary" onClick={() => alert(`Client: ${row.name || row.clientName || '—'}\nAgent: ${row.agentName || row.agent || '—'}\nStatus: ${row.status || '—'}\nPayment: ${row.paymentStatus || '—'}\nAdded: ${row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}`)}>View</PortalButton>
              )},
            ]}
            rows={clients}
            emptyMessage="No client leads"
          />
        </div>
      )}

      {section === 'achievements' && (
        <div>
          <SectionHeader title="Achievements" subtitle="Trainer achievements within your country (no revenue data)" />
          <DataTable
            columns={[
              { key: 'trainerName', label: 'Trainer', render: (v, r: any) => v || r.name || '—' },
              { key: 'country', label: 'Country' },
              { key: 'agentsCount', label: 'Agents', render: v => v ?? '—' },
              { key: 'deals', label: 'Deals', render: v => v ?? '—' },
              { key: 'leads', label: 'Leads', render: v => v ?? '—' },
            ]}
            rows={achievements}
            emptyMessage="No achievements recorded"
          />
        </div>
      )}

      {section === 'chat-cfo' && <div><SectionHeader title="Chat with CFO" /><ChatSection token={user?.token || ''} currentUserId={user?.id || ''} portal="Operations Portal" /></div>}
      {section === 'daily-report' && <div><SectionHeader title="Daily Report" subtitle="Submit your daily report" /><DailyReportForm /></div>}
    </PortalLayout>
  );
}

// ─── HEAD_OF_TRAINERS Dashboard ───────────────────────────────────────────────
const HOT_NAV = [
  { id: 'overview',       label: 'Overview',              icon: I.overview },
  { id: 'trainers',       label: 'Trainers',              icon: I.trainers },
  { id: 'agents',         label: 'Agents',                icon: I.agents },
  { id: 'achievements',   label: 'Achievements',          icon: I.achieve },
  { id: 'add-agent',      label: 'Add Agent',             icon: I.addAgent },
  { id: 'assign-client',  label: 'Assign Converted Client', icon: I.leads },
  { id: 'chat',           label: 'Chat',                  icon: I.chat },
  { id: 'report',         label: 'Report',                icon: I.report },
];

function HoTDashboard({ data, refetch, user, onLogout }: { data: any; refetch: (keys?: any[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [reassignAgentId, setReassignAgentId] = useState<string | null>(null);
  const [reassignTrainerId, setReassignTrainerId] = useState('');
  const [reassignMsg, setReassignMsg] = useState('');
  const [reassignOk, setReassignOk] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', phone: '', idNumber: '', country: '', paymentType: 'MPESA', paymentAccount: '', coverPhoto: null as File | null });
  const [addMsg, setAddMsg] = useState('');
  const [addOk, setAddOk] = useState(false);
  const [adding, setAdding] = useState(false);
  const [assignClientForm, setAssignClientForm] = useState({ clientId: '', accountExecutiveId: '' });
  const [assignClientMsg, setAssignClientMsg] = useState('');
  const [assignClientOk, setAssignClientOk] = useState(false);
  const [assignClientBusy, setAssignClientBusy] = useState(false);

  const agents = data.myAgents || [];
  const trainers = data.trainers || [];
  const achievements = data.achievements || [];
  const notifs = data.notifications || [];
  const metrics = data.metrics || {};

  const nav = HOT_NAV;

  const bestTrainer = trainers.reduce((best: any, t: any) =>
    (t.performanceScore || 0) > (best?.performanceScore || 0) ? t : best, null);

  const activeLeads = (data.clients || []).filter((c: any) =>
    ['NEW_LEAD', 'CONVERTED', 'LEAD_ACTIVATED', 'LEAD_QUALIFIED', 'NEGOTIATION'].includes(c.status)).length;

  const submitReassign = async (agentId: string) => {
    setReassignMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post(`/api/v1/agents/${agentId}/reassign`, { trainerId: reassignTrainerId });
      setReassignOk(true); setReassignMsg('Agent reassigned!');
      setReassignAgentId(null);
      refetch(['myAgents']);
    } catch (err: any) { setReassignOk(false); setReassignMsg(err?.response?.data?.error || 'Failed'); }
  };

  const submitAddAgent = async (e: React.FormEvent) => {
    e.preventDefault(); setAdding(true); setAddMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const fd = new FormData();
      fd.append('fullName', addForm.fullName.toUpperCase().trim());
      fd.append('phone', addForm.phone);
      fd.append('idNumber', addForm.idNumber);
      fd.append('country', addForm.country);
      fd.append('paymentType', addForm.paymentType);
      fd.append('paymentAccount', addForm.paymentAccount);
      if (addForm.coverPhoto) fd.append('coverPhoto', addForm.coverPhoto);
      await apiClient.post('/api/v1/agents/create', fd);
      setAddOk(true); setAddMsg('Agent account created!');
      setAddForm({ fullName: '', phone: '', idNumber: '', country: '', paymentType: 'MPESA', paymentAccount: '', coverPhoto: null });
      refetch(['myAgents']);
    } catch (err: any) { setAddOk(false); setAddMsg(err?.response?.data?.error || 'Failed'); }
    finally { setAdding(false); }
  };

  return (
    <PortalLayout
      theme={theme}
      user={{ name: user?.name || 'Head of Trainers', email: user?.email || '', role: 'HEAD_OF_TRAINERS' }}
      navItems={nav}
      activeSection={section}
      onSectionChange={setSection}
      onLogout={onLogout}
      notifications={notifs}
      onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }}
      faqs={TRAINERS_FAQS}
      portalName="Trainers Portal"
    >
      {section === 'overview' && (
        <div>
          <SectionHeader title="Head of Trainers Overview" subtitle="Country-wide performance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Trainers" value={trainers.length || metrics.totalTrainers || 0} icon={I.trainers} color={theme.hex} />
            <StatCard label="Total Agents" value={agents.length || metrics.totalAgents || 0} icon={I.agents} color={theme.hex} />
            <StatCard label="Best Trainer This Month" value={bestTrainer?.name || metrics.bestTrainer || '—'} icon={I.achieve} color={theme.hex} />
            <StatCard label="Active Leads (Country)" value={activeLeads || metrics.activeLeads || 0} icon={I.leads} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'trainers' && (
        <div>
          <SectionHeader title="Trainers" subtitle="Country-wide trainer performance (no revenue)" />
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'country', label: 'Country' },
              { key: 'agentsCount', label: 'Agents', render: v => v ?? '—' },
              { key: 'performanceScore', label: 'Score', render: v => v ?? '—' },
              { key: 'id', label: 'Actions', render: (_v, row: any) => (
                <PortalButton size="sm" variant="secondary" onClick={() => alert(`Trainer: ${row.name}\nCountry: ${row.country || '—'}\nAgents: ${row.agentsCount ?? '—'}\nScore: ${row.performanceScore ?? '—'}`)}>View</PortalButton>
              )},
            ]}
            rows={trainers}
            emptyMessage="No trainers found"
          />
        </div>
      )}

      {section === 'agents' && (
        <div>
          <SectionHeader title="Agents" subtitle="Agent performance within your country" />
          {reassignMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${reassignOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{reassignMsg}</div>}
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'trainerName', label: 'Trainer', render: (v, r: any) => v || r.trainer || '—' },
              { key: 'region', label: 'Region' },
              { key: 'deals', label: 'Deals', render: v => v ?? '—' },
              { key: 'leads', label: 'Leads', render: v => v ?? '—' },
              { key: 'performanceScore', label: 'Score', render: v => v ?? '—' },
              {
                key: 'id', label: 'Actions', render: (_v, row: any) =>
                  reassignAgentId === (row.id || row._id) ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      <select value={reassignTrainerId} onChange={e => setReassignTrainerId(e.target.value)} className="px-2 py-1 rounded-lg border border-gray-200 text-xs">
                        <option value="">Select trainer…</option>
                        {trainers.map((t: any) => (
                          <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                        ))}
                      </select>
                      <PortalButton size="sm" color={theme.hex} onClick={() => submitReassign(row.id || row._id)}>Save</PortalButton>
                      <PortalButton size="sm" variant="secondary" onClick={() => setReassignAgentId(null)}>Cancel</PortalButton>
                    </div>
                  ) : (
                    <PortalButton size="sm" color={theme.hex} onClick={() => { setReassignAgentId(row.id || row._id); setReassignTrainerId(''); }}>
                      Reassign Agent
                    </PortalButton>
                  ),
              },
            ]}
            rows={agents}
            emptyMessage="No agents found"
          />
        </div>
      )}

      {section === 'achievements' && (
        <div>
          <SectionHeader title="Achievements" subtitle="Trainer achievements within your country" />
          <DataTable
            columns={[
              { key: 'trainerName', label: 'Trainer', render: (v, r: any) => v || r.trainer || '—' },
              { key: 'achievement', label: 'Achievement' },
              { key: 'period', label: 'Period' },
            ]}
            rows={achievements}
            emptyMessage="No achievements recorded"
          />
        </div>
      )}

      {section === 'add-agent' && (
        <div>
          <SectionHeader title="Add Agent" subtitle="Create a new agent account" />
          <div className="max-w-md">
            {addMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${addOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{addMsg}</div>}
            <form onSubmit={submitAddAgent} className={cardCls} style={cardStyle}>
              <div className="mb-4">
                <label className={labelCls}>Full Name *</label>
                <input
                  type="text" required
                  value={addForm.fullName}
                  onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value.toUpperCase() }))}
                  className={inputCls}
                  placeholder="WANJIKU KAMAU"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="mb-4">
                <label className={labelCls}>Phone Number *</label>
                <input type="tel" required value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="+254…" />
              </div>
              <div className="mb-4">
                <label className={labelCls}>ID Number *</label>
                <input required value={addForm.idNumber} onChange={e => setAddForm(f => ({ ...f, idNumber: e.target.value }))} className={inputCls} />
              </div>
              <div className="mb-4">
                <label className={labelCls}>Country *</label>
                <CountryCombobox
                  value={addForm.country}
                  onChange={v => setAddForm(f => ({ ...f, country: v }))}
                  inputCls={inputCls}
                />
              </div>
              <div className="mb-4">
                <label className={labelCls}>Payment Method *</label>
                <select
                  required
                  value={addForm.paymentType}
                  onChange={e => setAddForm(f => ({ ...f, paymentType: e.target.value, paymentAccount: '' }))}
                  className={inputCls}
                >
                  <option value="MPESA">M-Pesa</option>
                  <option value="BANK">Bank Account</option>
                </select>
              </div>
              <div className="mb-6">
                <label className={labelCls}>
                  {addForm.paymentType === 'BANK' ? 'Bank Account Number *' : 'M-Pesa Number *'}
                </label>
                <input
                  required
                  type="text"
                  value={addForm.paymentAccount}
                  onChange={e => setAddForm(f => ({ ...f, paymentAccount: e.target.value }))}
                  className={inputCls}
                  placeholder={addForm.paymentType === 'BANK' ? 'e.g. 1234567890' : 'e.g. 0712345678'}
                />
              </div>
              <div className="mb-6">
                <label className={labelCls}>Cover Photo</label>
                <input type="file" accept="image/*" onChange={e => setAddForm(f => ({ ...f, coverPhoto: e.target.files?.[0] || null }))} className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
              </div>
              <PortalButton color={theme.hex} fullWidth disabled={adding}>{adding ? 'Creating…' : 'Create Agent'}</PortalButton>
            </form>
          </div>
        </div>
      )}

      {section === 'chat' && <div><SectionHeader title="Chat" /><ChatSection token={user?.token || ''} currentUserId={user?.id || ''} portal="Operations Portal" /></div>}
      {section === 'report' && <div><SectionHeader title="Daily Report" subtitle="Submit your daily report" /><DailyReportForm /></div>}

      {/* Assign Converted Client — doc §4: HoT assigns converted client to trainer for active engagement */}
      {section === 'assign-client' && (
        <div>
          <SectionHeader title="Assign Converted Client" subtitle="Assign a converted client to a trainer — client moves to NEGOTIATION" />
          {assignClientMsg && (
            <div className={`p-3 rounded-xl text-sm mb-4 ${assignClientOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {assignClientMsg}
            </div>
          )}
          <form onSubmit={async (e) => {
            e.preventDefault();
            setAssignClientMsg('');
            setAssignClientBusy(true);
            try {
              const { apiClient } = await import('../../shared/api/apiClient');
              const res = await apiClient.post(
                `/api/v1/agents/clients/${assignClientForm.clientId}/assign-account-exec`,
                { trainerId: assignClientForm.accountExecutiveId }
              );
              setAssignClientOk(true);
              setAssignClientMsg((res.data as any)?.message || 'Client assigned successfully!');
              setAssignClientForm({ clientId: '', accountExecutiveId: '' });
              refetch(['clients', 'trainers']);
            } catch (err: any) {
              setAssignClientOk(false);
              setAssignClientMsg(err?.response?.data?.error || 'Failed to assign client');
            } finally {
              setAssignClientBusy(false);
            }
          }} className={`${cardCls} max-w-lg`} style={cardStyle}>

            {/* Client selector */}
            <div className="mb-4">
              <label className={labelCls}>Converted Client *</label>
              <select
                required
                value={assignClientForm.clientId}
                onChange={e => setAssignClientForm(f => ({ ...f, clientId: e.target.value }))}
                className={inputCls}
              >
                <option value="">Select client…</option>
                {(data.clients || [])
                  .filter((c: any) => ['CONVERTED', 'LEAD_ACTIVATED', 'LEAD_QUALIFIED'].includes(c.status))
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.status.replace(/_/g, ' ')}
                      {c.serviceDescription ? ` — ${c.serviceDescription.slice(0, 35)}` : ''}
                    </option>
                  ))}
              </select>
              {(data.clients || []).filter((c: any) => ['CONVERTED', 'LEAD_ACTIVATED', 'LEAD_QUALIFIED'].includes(c.status)).length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  No converted clients yet — clients appear here once they reach CONVERTED, LEAD ACTIVATED, or LEAD QUALIFIED status
                </p>
              )}
            </div>

            {/* Trainer selector — uses data.trainers already loaded */}
            <div className="mb-6">
              <label className={labelCls}>Assign to Trainer *</label>
              <select
                required
                value={assignClientForm.accountExecutiveId}
                onChange={e => setAssignClientForm(f => ({ ...f, accountExecutiveId: e.target.value }))}
                className={inputCls}
              >
                <option value="">Select trainer…</option>
                {(data.trainers || []).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName || t.full_name || t.name || t.email}
                    {t.assignedClients != null ? ` (${t.assignedClients} clients)` : ''}
                  </option>
                ))}
              </select>
              {(data.trainers || []).length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No trainers found</p>
              )}
            </div>

            <PortalButton
              type="submit"
              color={theme.hex}
              fullWidth
              disabled={assignClientBusy || !assignClientForm.clientId || !assignClientForm.accountExecutiveId}
            >
              {assignClientBusy ? 'Assigning…' : 'Assign Client'}
            </PortalButton>
          </form>
        </div>
      )}
    </PortalLayout>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function TrainersPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, refetch } = useMultiPortalData<{
    myAgents: any[]; clients: any[]; achievements: any[];
    trainers: any[]; notifications: any[]; metrics: any;
  }>([
    // /api/v1/clients/all handles both roles: HoT gets all clients, TRAINER gets only their assigned clients
    { key: 'clients', endpoint: '/api/v1/clients/all', fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r?.data ?? r?.clients ?? []) },
    // /api/v1/trainer/agents returns agents for TRAINER; HoT uses training/agent-records
    { key: 'myAgents', endpoint: '/api/v1/training/agent-records', fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r?.data ?? r?.agents ?? []) },
    { key: 'achievements', endpoint: '/api/v1/trainer/country-achievements', fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r?.data?.trainers ?? r?.achievements ?? []) },
    { key: 'trainers', endpoint: '/api/v1/trainers/performance', fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r?.data ?? r?.trainers ?? []) },
    { key: 'notifications', endpoint: '/api/v1/notifications', fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r?.notifications ?? r?.data ?? []) },
    { key: 'metrics', endpoint: '/api/v1/trainer/dashboard', fallback: {}, transform: (r: any) => r?.data ?? r ?? {} },
  ], [
    'data:client:created', 'data:client:updated', 'data:client:status_changed',
    'data:lead:converted', 'data:notification:new', 'data:metrics:updated', 'data:report:submitted',
  ]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const props = { data: data || {}, refetch, user };

  const logoutFn = () => { logout(); navigate('/login'); };
  if (user.role === 'HEAD_OF_TRAINERS') return <HoTDashboard {...props} onLogout={logoutFn} />;
  return <TrainerDashboard {...props} onLogout={logoutFn} />;
}
