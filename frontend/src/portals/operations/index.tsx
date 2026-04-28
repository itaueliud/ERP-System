import React, { useState } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';
import { AFRICAN_COUNTRIES, COUNTRIES_BY_REGION, AFRICAN_REGIONS, COUNTRY_BY_NAME } from '../../shared/utils/africanCountries';
// Doc §3 Portal 4 (gatewaynexus): Same URL — RBA loads correct department dashboard
// Roles: OPERATIONS_USER (Sales & CA), CLIENT_SUCCESS_USER, MARKETING_USER, HEAD_OF_TRAINERS, TRAINER
import ClientSuccessDashboard from './ClientSuccessDashboard';
import MarketingDashboard from './MarketingDashboard';
import TrainersPortal from '../trainers/index';
import ChatPanel from '../../shared/components/chat/ChatPanel';
import { OPERATIONS_FAQS } from '../../shared/data/portalFAQs';
import PlotConnectProperties from '../../shared/components/plotconnect/PlotConnectProperties';

const theme = PORTAL_THEMES.operations;

function DailyReportForm({ themeHex, onSubmitted }: { themeHex: string; onSubmitted?: () => void }) {
  const [accomplishments, setAccomplishments] = useState('');
  const [challenges, setChallenges] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', {
        accomplishments,
        challenges,
        tomorrowPlan,
        hoursWorked: parseFloat(hoursWorked) || undefined,
        reportDate: new Date().toISOString().split('T')[0],
      });
      setIsSuccess(true);
      setMsg('Report submitted successfully!');
      setAccomplishments('');
      setChallenges('');
      setTomorrowPlan('');
      setHoursWorked('');
      onSubmitted?.();
    } catch (err: any) {
      setIsSuccess(false);
      setMsg(err?.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      {msg && (
        <div className={`p-3 rounded-xl text-sm mb-4 ${isSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">What did you accomplish today? *</label>
          <textarea rows={3} required value={accomplishments} onChange={e => setAccomplishments(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Any challenges faced?</label>
          <textarea rows={3} value={challenges} onChange={e => setChallenges(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan for tomorrow</label>
          <textarea rows={3} value={tomorrowPlan} onChange={e => setTomorrowPlan(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours worked</label>
          <input type="number" min={0} max={24} value={hoursWorked} onChange={e => setHoursWorked(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
        </div>
        <PortalButton color={themeHex} fullWidth disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Report'}
        </PortalButton>
        <div className="mt-2">
          <PortalButton variant="secondary" fullWidth onClick={() => { setAccomplishments(''); setChallenges(''); setTomorrowPlan(''); setHoursWorked(''); }} disabled={submitting}>Clear</PortalButton>
        </div>
      </form>
    </div>
  );
}

const NAV = [
  { id: 'overview',    label: 'Overview',       icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
  { id: 'clients',     label: 'Clients',        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  { id: 'leads',       label: 'Leads',          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
  { id: 'pipeline',    label: 'Pipeline',       icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
  { id: 'properties',  label: 'Properties',     icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
  { id: 'tasks',       label: 'Tasks',          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
  { id: 'communications', label: 'Communications', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
  { id: 'reports',     label: 'Reports',        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { id: 'daily-report',label: 'Daily Report',   icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
  { id: 'chat', label: 'Chat', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
];

// ─── CSV Export helper ────────────────────────────────────────────────────────
function exportToCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const body = rows.map(r => keys.map(k => {
    const v = r[k] ?? '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Sales & Client Acquisition Department Dashboard (Portal 4 — OPERATIONS_USER / Sales Manager)
export function SalesClientAcquisitionDashboard() {
  const [section, setSection] = useState('overview');





  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', country: 'Kenya', industryCategory: '', estimatedValue: '', serviceDescription: '' });
  const [clientSubmitting, setClientSubmitting] = useState(false);
  const [clientMsg, setClientMsg] = useState('');
  const [activeAction, setActiveAction] = useState<{ type: 'qualify' | 'convert'; clientId: string } | null>(null);
  const [qualifyForm, setQualifyForm] = useState({ estimatedValue: '', priority: 'MEDIUM' });
  const [convertForm, setConvertForm] = useState({ serviceAmount: '', country: 'Kenya', currency: 'KES', startDate: '', endDate: '' });
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [actionSuccess, setActionSuccess] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: '' });
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskMsg, setTaskMsg] = useState('');
  const [taskSuccess, setTaskSuccess] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  // Client filter state
  const [clientFilter, setClientFilter] = useState({ status: '', country: '', agent: '', search: '' });
  // Bulk lead state
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');
  const [bulkOk, setBulkOk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, refetch } = useMultiPortalData([
    { key: 'metrics',        endpoint: '/api/v1/dashboard/metrics',    fallback: {} },
    { key: 'clients',        endpoint: '/api/v1/clients/all',          fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.clients || []) },
    { key: 'leads',          endpoint: '/api/v1/clients/all',          fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.clients || []) },
    { key: 'properties',     endpoint: '/api/v1/properties',           fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.listings || r.properties || []) },
    { key: 'tasks',          endpoint: '/api/v1/tasks',                fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.tasks || []) },
    { key: 'users',          endpoint: '/api/v1/users',                fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.users || []) },
    { key: 'communications', endpoint: '/api/v1/communications',       fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'teamReports',    endpoint: '/api/v1/daily-reports/team',   fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.reports || []) },
    { key: 'notifications',  endpoint: '/api/v1/notifications',        fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r?.notifications || r?.data || []) },
  ] as any, [
    'data:client:created', 'data:client:updated', 'data:client:status_changed',
    'data:lead:converted', 'data:task:assigned', 'data:task:updated',
    'data:notification:new', 'data:metrics:updated', 'data:report:submitted',
  ]);

  const m          = (data as any).metrics    || {};
  const clients    = (data as any).clients?.data    || (data as any).clients?.clients || (data as any).clients    || [];
  const leads      = (data as any).leads?.data      || (data as any).leads?.clients   || (data as any).leads      || [];
  const properties = (data as any).properties?.data || (data as any).properties || [];
  const tasks      = (data as any).tasks?.data      || (data as any).tasks      || [];
  const users      = (data as any).users?.data      || (data as any).users?.users || (data as any).users || [];
  const comms      = (data as any).communications?.data || (data as any).communications || [];
  const teamReports = (data as any).teamReports?.data || (data as any).teamReports || [];
  const notifs     = (data as any).notifications?.data || (data as any).notifications || [];

  const nav = NAV;

  const handleLogout = () => { logout(); navigate('/login'); };
  const portalUser = { name: user?.name || 'Operations', email: user?.email || 'ops@tst.com', role: 'Operations Manager' };

  return (
    <PortalLayout theme={theme} user={portalUser} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={handleLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={OPERATIONS_FAQS} portalName="Operations Portal">

      {section === 'overview' && (
        <div>
          <SectionHeader title="Operations Overview" subtitle="Client pipeline and sales performance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Clients"     value={(m as any).clients?.total ?? (Array.isArray(clients) ? clients.length : 0)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} color={theme.hex} />
            <StatCard label="Active Leads"      value={(m as any).clients?.leads ?? (Array.isArray(leads) ? leads.filter((c: any) => ['NEW_LEAD','CONVERTED','LEAD_ACTIVATED','LEAD_QUALIFIED','NEGOTIATION'].includes(c.status)).length : 0)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>} color={theme.hex} />
            <StatCard label="Pipeline Value"    value={(m as any).revenue?.total ? `KSh ${(((m as any).revenue.total) / 1000000).toFixed(1)}M` : '—'} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} color={theme.hex} />
            <StatCard label="Properties Listed" value={Array.isArray(properties) ? properties.length : 0} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} color={theme.hex} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Sales Pipeline</h3>
            <div className="space-y-3">
              {(() => {
                const stages = [
                  { label: 'New Lead',          status: 'NEW_LEAD' },
                  { label: 'Converted',          status: 'CONVERTED' },
                  { label: 'Lead Activated',     status: 'LEAD_ACTIVATED' },
                  { label: 'Lead Qualified',     status: 'LEAD_QUALIFIED' },
                  { label: 'Negotiation',        status: 'NEGOTIATION' },
                  { label: 'Closed Won',         status: 'CLOSED_WON' },
                ];
                const counts = stages.map(s => (Array.isArray(clients) ? clients : []).filter((c: any) => (c.status || '').toUpperCase() === s.status).length);
                const max = Math.max(...counts, 1);
                return stages.map((stage, i) => (
                  <div key={stage.label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-40 flex-shrink-0">{stage.label}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                      <div className="h-full rounded-lg flex items-center px-2 text-white text-xs font-medium"
                        style={{ width: `${Math.round((counts[i] / max) * 100)}%`, backgroundColor: theme.hex }}>
                        {counts[i]}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {section === 'clients' && (
        <div>
          <SectionHeader title="Client Management" subtitle="All clients across all agents"
            action={
              <div className="flex gap-2">
                <PortalButton variant="secondary" onClick={() => exportToCSV(Array.isArray(clients) ? clients : [], 'clients.csv')}>Export CSV</PortalButton>
                <PortalButton color={theme.hex} onClick={() => setShowClientForm(f => !f)}>{showClientForm ? 'Cancel' : 'Add Client'}</PortalButton>
              </div>
            } />
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text" placeholder="Search name / email…"
              value={clientFilter.search}
              onChange={e => setClientFilter(f => ({ ...f, search: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 w-48"
            />
            <select value={clientFilter.status} onChange={e => setClientFilter(f => ({ ...f, status: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
              <option value="">All Statuses</option>
              {['NEW_LEAD','CONVERTED','LEAD_ACTIVATED','LEAD_QUALIFIED','NEGOTIATION','CLOSED_WON'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <select value={clientFilter.country} onChange={e => setClientFilter(f => ({ ...f, country: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
              <option value="">All Countries</option>
              {[...new Set((Array.isArray(clients) ? clients : []).map((c: any) => c.country).filter(Boolean))].sort().map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={clientFilter.agent} onChange={e => setClientFilter(f => ({ ...f, agent: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
              <option value="">All Agents</option>
              {[...new Set((Array.isArray(clients) ? clients : []).map((c: any) => c.agentName || c.agent).filter(Boolean))].sort().map((a: any) => <option key={a} value={a}>{a}</option>)}
            </select>
            {(clientFilter.search || clientFilter.status || clientFilter.country || clientFilter.agent) && (
              <button onClick={() => setClientFilter({ status: '', country: '', agent: '', search: '' })}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">Clear</button>
            )}
          </div>
          {showClientForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
              {clientMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${clientMsg.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{clientMsg}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input type="text" value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                    style={{ textTransform: 'uppercase' }} placeholder="CLIENT FULL NAME"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input type="tel" value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
                  <select value={clientForm.country} onChange={e => setClientForm(f => ({ ...f, country: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all">
                    {AFRICAN_COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
                  <input type="text" value={clientForm.industryCategory} onChange={e => setClientForm(f => ({ ...f, industryCategory: e.target.value }))}
                    placeholder="e.g. Real Estate"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated Value (KSh)</label>
                  <input type="number" min={0} value={clientForm.estimatedValue} onChange={e => setClientForm(f => ({ ...f, estimatedValue: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Description *</label>
                <textarea value={clientForm.serviceDescription} onChange={e => setClientForm(f => ({ ...f, serviceDescription: e.target.value }))}
                  rows={2} placeholder="Describe the service required…"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
              </div>
              <PortalButton color={theme.hex} fullWidth disabled={clientSubmitting || !clientForm.name} onClick={async () => {
                setClientSubmitting(true);
                try {
                  const { apiClient } = await import('../../shared/api/apiClient');
                  await apiClient.post('/api/v1/clients', {
                    name: clientForm.name,
                    email: clientForm.email || undefined,
                    phone: clientForm.phone || undefined,
                    country: clientForm.country,
                    industryCategory: clientForm.industryCategory || undefined,
                    serviceDescription: clientForm.serviceDescription || undefined,
                    estimatedValue: clientForm.estimatedValue ? parseFloat(clientForm.estimatedValue) : undefined,
                  });
                  setClientMsg('Client added successfully!');
                  setClientForm({ name: '', email: '', phone: '', country: 'Kenya', industryCategory: '', estimatedValue: '', serviceDescription: '' });
                  setShowClientForm(false);
                  refetch(['clients']);
                } catch (err: any) {
                  setClientMsg(err?.response?.data?.error || 'Failed to add client');
                } finally { setClientSubmitting(false); }
              }}>{clientSubmitting ? 'Adding…' : 'Add Client'}</PortalButton>
            </div>
          )}
          <DataTable
            columns={[
              { key: 'name',           label: 'Client' },
              { key: 'email',          label: 'Email' },
              { key: 'country',        label: 'Country' },
              { key: 'agentName',      label: 'Agent', render: (v, r: any) => v || r.agent || '—' },
              { key: 'status',         label: 'Status',       render: (v) => <StatusBadge status={v || 'LEAD'} /> },
              { key: 'estimatedValue', label: 'Value (KSh)',  render: (v) => v ? Number(v).toLocaleString() : '—' },
            ]}
            rows={(Array.isArray(clients) ? clients : []).filter((c: any) => {
              if (clientFilter.status && c.status !== clientFilter.status) return false;
              if (clientFilter.country && c.country !== clientFilter.country) return false;
              if (clientFilter.agent && (c.agentName || c.agent) !== clientFilter.agent) return false;
              if (clientFilter.search) {
                const q = clientFilter.search.toLowerCase();
                if (!((c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))) return false;
              }
              return true;
            })}
          />
        </div>
      )}

      {section === 'leads' && (
        <div>
          <SectionHeader title="Lead Management" subtitle="Qualify and convert leads to projects"
            action={
              <PortalButton variant="secondary" onClick={() => exportToCSV(Array.isArray(leads) ? leads : [], 'leads.csv')}>Export CSV</PortalButton>
            } />
          {actionMsg && (
            <div className={`p-3 rounded-xl text-sm mb-4 ${actionSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {actionMsg}
            </div>
          )}

          {/* Bulk update bar */}
          {selectedLeads.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex-wrap">
              <span className="text-sm font-semibold text-indigo-800">{selectedLeads.size} selected</span>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 text-sm bg-white focus:outline-none">
                <option value="">Move to stage…</option>
                {['NEW_LEAD','CONVERTED','LEAD_ACTIVATED','LEAD_QUALIFIED','NEGOTIATION','CLOSED_WON'].map(s => (
                  <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                ))}
              </select>
              <PortalButton size="sm" color={theme.hex} disabled={!bulkStatus || bulkBusy} onClick={async () => {
                if (!bulkStatus) return;
                setBulkBusy(true); setBulkMsg('');
                try {
                  const { apiClient } = await import('../../shared/api/apiClient');
                  await Promise.all([...selectedLeads].map(id =>
                    apiClient.patch(`/api/v1/clients/${id}/status`, { status: bulkStatus })
                  ));
                  setBulkOk(true); setBulkMsg(`${selectedLeads.size} leads moved to ${bulkStatus.replace(/_/g,' ')}`);
                  setSelectedLeads(new Set()); setBulkStatus('');
                  refetch(['leads', 'clients']);
                } catch (err: any) {
                  setBulkOk(false); setBulkMsg(err?.response?.data?.error || 'Bulk update failed');
                } finally { setBulkBusy(false); }
              }}>{bulkBusy ? 'Updating…' : 'Apply'}</PortalButton>
              <button onClick={() => setSelectedLeads(new Set())} className="text-xs text-indigo-500 hover:underline">Clear</button>
            </div>
          )}
          {bulkMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${bulkOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{bulkMsg}</div>}

          <div className="space-y-2">
            {((Array.isArray(leads) ? leads : []).filter((l: any) => l.status === 'LEAD' || l.status === 'QUALIFIED_LEAD' || ['NEW_LEAD','CONVERTED','LEAD_ACTIVATED','LEAD_QUALIFIED','NEGOTIATION'].includes(l.status))).map((lead: any, i: number) => (
              <div key={lead.id || i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input type="checkbox" checked={selectedLeads.has(lead.id)}
                      onChange={e => setSelectedLeads(prev => {
                        const next = new Set(prev);
                        e.target.checked ? next.add(lead.id) : next.delete(lead.id);
                        return next;
                      })}
                      className="rounded border-gray-300 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{lead.name}</p>
                      <p className="text-xs text-gray-400">{lead.email}</p>
                    </div>
                    <StatusBadge status={lead.status || 'NEW_LEAD'} />
                    <StatusBadge status={lead.priority || 'MEDIUM'} />
                    <span className="text-xs text-gray-500">{lead.estimatedValue ? `KSh ${Number(lead.estimatedValue).toLocaleString()}` : '—'}</span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Hide Qualify once estimatedValue is set, or status is past qualification */}
                    {!lead.estimatedValue && !['NEGOTIATION', 'CLOSED_WON'].includes(lead.status) && (
                      <PortalButton size="sm" color={theme.hex}
                        onClick={() => { setActiveAction((a: any) => a?.clientId === lead.id && a.type === 'qualify' ? null : { type: 'qualify', clientId: lead.id }); setActionMsg(''); }}>
                        Qualify
                      </PortalButton>
                    )}
                    {(lead.status === 'QUALIFIED_LEAD' || lead.status === 'LEAD_QUALIFIED') && (
                      <PortalButton size="sm" variant="secondary"
                        onClick={() => { setActiveAction((a: any) => a?.clientId === lead.id && a.type === 'convert' ? null : { type: 'convert', clientId: lead.id }); setActionMsg(''); }}>
                        Convert
                      </PortalButton>
                    )}
                    {(lead.status === 'CLOSED_WON' || lead.projectId) && (
                      <PortalButton size="sm" variant="secondary"
                        onClick={() => setSection('communications')}>
                        Contract ↗
                      </PortalButton>
                    )}
                  </div>
                </div>
                {activeAction?.clientId === lead.id && (activeAction as any).type === 'qualify' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setActionSubmitting(true);
                      setActionMsg('');
                      try {
                        const { apiClient } = await import('../../shared/api/apiClient');
                        await apiClient.post(`/api/v1/clients/${lead.id}/qualify`, {
                          estimatedValue: parseFloat(qualifyForm.estimatedValue),
                          priority: qualifyForm.priority,
                        });
                        setActionSuccess(true);
                        setActionMsg('Lead qualified successfully!');
                        setActiveAction(null);
                        setQualifyForm({ estimatedValue: '', priority: 'MEDIUM' });
                        refetch(['leads', 'clients']);
                      } catch (err: any) {
                        setActionSuccess(false);
                        setActionMsg(err?.response?.data?.error || 'Failed to qualify lead');
                      } finally {
                        setActionSubmitting(false);
                      }
                    }}>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated Value (KSh) *</label>
                          <input type="number" required min={0} value={qualifyForm.estimatedValue}
                            onChange={e => setQualifyForm(f => ({ ...f, estimatedValue: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority *</label>
                          <select required value={qualifyForm.priority} onChange={e => setQualifyForm(f => ({ ...f, priority: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all">
                            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <PortalButton type="submit" color={theme.hex} disabled={actionSubmitting}>
                          {actionSubmitting ? 'Saving…' : 'Confirm Qualify'}
                        </PortalButton>
                        <PortalButton variant="secondary" onClick={() => setActiveAction(null)}>Cancel</PortalButton>
                      </div>
                    </form>
                  </div>
                )}
                {activeAction?.clientId === lead.id && (activeAction as any).type === 'convert' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setActionSubmitting(true);
                      setActionMsg('');
                      try {
                        const { apiClient } = await import('../../shared/api/apiClient');
                        await apiClient.post(`/api/v1/clients/${lead.id}/convert-to-project`, {
                          serviceAmount: parseFloat(convertForm.serviceAmount),
                          currency: convertForm.currency,
                          startDate: convertForm.startDate || undefined,
                          endDate: convertForm.endDate || undefined,
                        });
                        setActionSuccess(true);
                        setActionMsg('Lead converted to project! You can now generate a contract from the Executive Portal → Contract Generator.');
                        setActiveAction(null);
                        setConvertForm({ serviceAmount: '', country: 'Kenya', currency: 'KES', startDate: '', endDate: '' });
                      } catch (err: any) {
                        setActionSuccess(false);
                        setActionMsg(err?.response?.data?.error || 'Failed to convert lead');
                      } finally {
                        setActionSubmitting(false);
                      }
                    }}>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Amount (KSh) *</label>
                          <input type="number" required min={0} value={convertForm.serviceAmount}
                            onChange={e => setConvertForm(f => ({ ...f, serviceAmount: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Country</label>
                          <select value={convertForm.country}
                            onChange={e => {
                              const info = COUNTRY_BY_NAME[e.target.value];
                              setConvertForm(f => ({ ...f, country: e.target.value, currency: info?.currency ?? f.currency }));
                            }}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all">
                            {AFRICAN_REGIONS.map(region => (
                              <optgroup key={region} label={region}>
                                {COUNTRIES_BY_REGION[region].map(c => (
                                  <option key={c.code} value={c.name}>{c.name}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency (auto from country)</label>
                          <input type="text" readOnly value={convertForm.currency}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                          <input type="date" value={convertForm.startDate} onChange={e => setConvertForm(f => ({ ...f, startDate: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                          <input type="date" value={convertForm.endDate} onChange={e => setConvertForm(f => ({ ...f, endDate: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <PortalButton type="submit" color={theme.hex} disabled={actionSubmitting}>
                          {actionSubmitting ? 'Converting…' : 'Confirm Convert'}
                        </PortalButton>
                        <PortalButton variant="secondary" onClick={() => setActiveAction(null)}>Cancel</PortalButton>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {section === 'pipeline' && (
        <div>
          <SectionHeader title="Sales Pipeline" subtitle="Visual pipeline across all stages" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {['NEW_LEAD', 'CONVERTED', 'LEAD_ACTIVATED', 'LEAD_QUALIFIED', 'NEGOTIATION', 'CLOSED_WON'].map((status) => {
              const items = (Array.isArray(clients) ? clients : []).filter((c: any) => c.status === status);
              return (
                <div key={status} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <StatusBadge status={status} />
                    <span className="text-lg font-bold text-gray-900">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.slice(0, 4).map((c: any, i: number) => (
                      <div key={c.id || i} className="p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-800 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.country}</p>
                      </div>
                    ))}
                    {items.length > 4 && <p className="text-xs text-gray-400 text-center">+{items.length - 4} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {section === 'properties' && (
        <PlotConnectProperties
          themeHex={theme.hex}
          canApprove={true}
          showAgent={true}
          showRevenue={false}
        />
      )}
      {section === 'tasks' && (
        <div>
          <SectionHeader title="Tasks" subtitle="Manage and track team tasks"
            action={<PortalButton color={theme.hex} onClick={() => setShowTaskForm(f => !f)}>{showTaskForm ? 'Hide Form' : 'Create Task'}</PortalButton>} />
          {showTaskForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
              {taskMsg && (
                <div className={`p-3 rounded-xl text-sm mb-4 ${taskSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {taskMsg}
                </div>
              )}
              <form onSubmit={async (e) => {
                e.preventDefault();
                setTaskSubmitting(true);
                setTaskMsg('');
                try {
                  const { apiClient } = await import('../../shared/api/apiClient');
                  await apiClient.post('/api/v1/tasks', {
                    title: taskForm.title,
                    description: taskForm.description || undefined,
                    dueDate: taskForm.dueDate || undefined,
                    priority: taskForm.priority,
                    assignedTo: taskForm.assignedTo || undefined,
                  });
                  // Send in-portal notification to the assigned user
                  if (taskForm.assignedTo) {
                    try {
                      await apiClient.post('/api/v1/notifications', {
                        userId: taskForm.assignedTo,
                        title: 'New Task Assigned',
                        body: `You have been assigned: "${taskForm.title}"${taskForm.dueDate ? ` — due ${new Date(taskForm.dueDate).toLocaleDateString()}` : ''}`,
                        type: 'TASK_ASSIGNED',
                      });
                    } catch { /* non-blocking */ }
                  }
                  setTaskSuccess(true);
                  setTaskMsg('Task created successfully!');
                  setTaskForm({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: '' });
                  setShowTaskForm(false);
                  refetch(['tasks']);
                } catch (err: any) {
                  setTaskSuccess(false);
                  setTaskMsg(err?.response?.data?.error || 'Failed to create task');
                } finally {
                  setTaskSubmitting(false);
                }
              }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                    <input type="text" required value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                    <textarea rows={2} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                    <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                    <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all">
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to</label>
                    <select value={taskForm.assignedTo} onChange={e => setTaskForm(f => ({ ...f, assignedTo: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all">
                      <option value="">— Unassigned —</option>
                      {(() => {
                        const EXCLUDED = ['CEO', 'EA', 'CFO', 'COO', 'COS'];
                        const ROLE_LABELS: Record<string, string> = {
                          CTO: 'Technology', TECH_STAFF: 'Tech Staff', DEVELOPER: 'Developers',
                          TRAINER: 'Trainers', HEAD_OF_TRAINERS: 'Head of Trainers',
                          OPERATIONS_USER: 'Operations', AGENT: 'Sales Agents',
                          SECURITY_MANAGER: 'Security',
                        };
                        const assignable = (Array.isArray(users) ? users : []).filter((u: any) => {
                          const r = (u.roleName || u.role || '').toUpperCase();
                          return !EXCLUDED.includes(r);
                        });
                        const grouped: Record<string, any[]> = {};
                        assignable.forEach((u: any) => {
                          const r = u.roleName || u.role || 'Other';
                          const label = ROLE_LABELS[r] || r.replace(/_/g, ' ');
                          if (!grouped[label]) grouped[label] = [];
                          grouped[label].push(u);
                        });
                        return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, members]) => (
                          <optgroup key={group} label={group}>
                            {members.map((u: any) => (
                              <option key={u.id} value={u.id}>{u.fullName || u.full_name || u.email}</option>
                            ))}
                          </optgroup>
                        ));
                      })()}
                    </select>
                  </div>
                </div>
                <PortalButton color={theme.hex} fullWidth disabled={taskSubmitting}>
                  {taskSubmitting ? 'Creating…' : 'Create Task'}
                </PortalButton>
              </form>
            </div>
          )}
          <DataTable
            columns={[
              { key: 'title',      label: 'Title' },
              { key: 'priority',   label: 'Priority',    render: (v) => <StatusBadge status={v || 'MEDIUM'} /> },
              { key: 'status',     label: 'Status',      render: (v) => <StatusBadge status={v || 'PENDING'} /> },
              { key: 'dueDate',    label: 'Due Date',    render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'assignedTo', label: 'Assigned To', render: (v) => {
                const u = (Array.isArray(users) ? users : []).find((u: any) => u.id === v);
                return u ? (u.fullName || u.full_name || u.email) : (v ? v : '—');
              }},
              { key: 'id', label: 'Actions', render: (id, row: any) => (
                <div className="flex gap-1.5">
                  <PortalButton size="sm" color={theme.hex} onClick={async () => {
                    try {
                      const { apiClient } = await import('../../shared/api/apiClient');
                      await apiClient.patch(`/api/v1/tasks/${id}/status`, { status: 'COMPLETED' });
                      refetch(['tasks']);
                    } catch { /* ignore */ }
                  }} disabled={row.status === 'COMPLETED'}>
                    {row.status === 'COMPLETED' ? 'Done' : 'Complete'}
                  </PortalButton>
                  <PortalButton size="sm" variant="danger" onClick={async () => {
                    if (!window.confirm('Delete this task?')) return;
                    try {
                      const { apiClient } = await import('../../shared/api/apiClient');
                      await apiClient.delete(`/api/v1/tasks/${id}`);
                      refetch(['tasks']);
                    } catch { /* ignore */ }
                  }}>Delete</PortalButton>
                </div>
              )},
            ]}
            rows={Array.isArray(tasks) ? tasks : []}
          />
        </div>
      )}

      {section === 'daily-report' && (
        <div>
          <SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" />
          <DailyReportForm themeHex={theme.hex} onSubmitted={() => refetch(['teamReports'])} />
        </div>
      )}

      {section === 'communications' && (
        <div>
          <SectionHeader title="Communications" subtitle="Client communication history across all agents" />
          <DataTable
            columns={[
              { key: 'clientName',   label: 'Client' },
              { key: 'agentName',    label: 'Agent' },
              { key: 'type',         label: 'Type',    render: (v) => <StatusBadge status={v || 'CALL'} /> },
              { key: 'summary',      label: 'Summary', render: (v) => <span className="text-xs text-gray-600 line-clamp-1">{v || '—'}</span> },
              { key: 'createdAt',    label: 'Date',    render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'id', label: 'Actions', render: (_v, row: any) => (
                <PortalButton size="sm" variant="secondary" onClick={() => {
                  alert(`Communication Details\n\nClient: ${row.clientName || '—'}\nAgent: ${row.agentName || '—'}\nType: ${row.type || '—'}\nDate: ${row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}\n\nSummary:\n${row.summary || '—'}\n\nOutcome:\n${row.outcome || '—'}`);
                }}>View</PortalButton>
              )},
            ]}
            rows={Array.isArray(comms) ? comms : []}
            emptyMessage="No communications logged yet"
          />
        </div>
      )}

      {section === 'reports' && (
        <div>
          <SectionHeader title="Team Reports" subtitle="Daily reports — who submitted, when, and what they did" />
          <DataTable
            columns={[
              { key: 'full_name',       label: 'Submitted By', render: (v, r: any) => (
                <div>
                  <p className="font-medium text-gray-900 text-sm">{v || r.authorName || r.userName || '—'}</p>
                  <p className="text-xs text-gray-400">{r.role || r.userRole || '—'}</p>
                </div>
              )},
              { key: 'report_date',    label: 'Report Date',  render: (v, r: any) => { const d = v || r.reportDate; return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }},
              { key: 'submitted_at',   label: 'Submitted At', render: (v, r: any) => { const t = v || r.submittedAt; return t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; }},

              { key: 'accomplishments', label: 'Accomplishments', render: (v) => <span className="text-xs text-gray-600 line-clamp-2">{v || '—'}</span> },
              { key: 'id', label: '', render: (_v, row: any) => (
                <PortalButton size="sm" variant="secondary" onClick={() => setSelectedReport(row)}>View</PortalButton>
              )},
            ]}
            rows={Array.isArray(teamReports) ? teamReports : []}
            emptyMessage="No reports submitted yet"
          />

          {/* Report detail modal */}
          {selectedReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
              onClick={() => setSelectedReport(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between" style={{ background: theme.hex + '10' }}>
                  <div>
                    <p className="font-bold text-gray-900 text-base">{selectedReport.full_name || selectedReport.authorName || '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedReport.role || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">
                      {selectedReport.report_date ? new Date(selectedReport.report_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Submitted {selectedReport.submitted_at ? new Date(selectedReport.submitted_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                  </div>
                </div>
                {/* Body */}
                <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: theme.hex }}>Accomplishments</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedReport.accomplishments || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: theme.hex }}>Challenges</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedReport.challenges || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: theme.hex }}>Plan for Tomorrow</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedReport.tomorrow_plan || selectedReport.tomorrowPlan || '—'}</p>
                  </div>
                </div>
                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                  <button onClick={() => setSelectedReport(null)}
                    className="px-5 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat — COO dept: higher-ups and own team (doc §9 Portal 3 COO) */}
      {section === 'chat' && (
        <div>
          <SectionHeader title="Chat" subtitle="Chat with CoS, CEO, CFO, EA, CTO and your team" />
          <div style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
            <ChatPanel token={user?.token || ''} currentUserId={user?.id || ''} portal="Operations Portal" inlineMode />
          </div>
        </div>
      )}

    </PortalLayout>
  );
}

/**
 * Portal 4 — gatewaynexus
 * Doc §3: Same URL — RBA loads correct department dashboard
 * Roles: OPERATIONS_USER (Sales & CA), CLIENT_SUCCESS_USER, MARKETING_USER, HEAD_OF_TRAINERS, TRAINER
 */
export default function OperationsPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };
  const role = user?.role;

  // RBA routing — same URL, different dashboard per role (doc §3 Portal 4)
  if (role === 'HEAD_OF_TRAINERS' || role === 'TRAINER') {
    return <TrainersPortal />;
  }
  if (role === 'CLIENT_SUCCESS_USER' || role === 'ACCOUNT_EXECUTIVE' || role === 'SENIOR_ACCOUNT_MANAGER') {
    return <ClientSuccessDashboard user={user} onLogout={handleLogout} />;
  }
  if (role === 'MARKETING_USER' || role === 'MARKETING_OFFICER') {
    return <MarketingDashboard user={user} onLogout={handleLogout} />;
  }
  // Default: Sales & Client Acquisition (OPERATIONS_USER, SALES_MANAGER)
  return <SalesClientAcquisitionDashboard />;
}
