import React, { useState } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';
import { AFRICAN_COUNTRIES, COUNTRIES_BY_REGION, AFRICAN_REGIONS, getCurrencyForCountry, COUNTRY_BY_NAME } from '../../shared/utils/africanCountries';
// Doc §3 Portal 4 (gatewaynexus): Same URL — RBA loads correct department dashboard
// Roles: OPERATIONS_USER (Sales & CA), CLIENT_SUCCESS_USER, MARKETING_USER, HEAD_OF_TRAINERS, TRAINER
import ClientSuccessDashboard from './ClientSuccessDashboard';
import MarketingDashboard from './MarketingDashboard';
import TrainersPortal from '../trainers/index';

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
  { id: 'notifications', label: 'Notifications', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
  { id: 'daily-report',label: 'Daily Report',   icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
  { id: 'chat', label: 'Chat', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
];

// Sales & Client Acquisition Department Dashboard (Portal 4 — OPERATIONS_USER / Sales Manager)
export function SalesClientAcquisitionDashboard() {
  const [section, setSection] = useState('overview');
  const [propTab, setPropTab] = useState<'list' | 'new'>('list');
  const [propForm, setPropForm] = useState({ title: '', description: '', location: '', country: 'Kenya', price: '', currency: 'KES', propertyType: 'RESIDENTIAL', size: '' });
  const [propSubmitting, setPropSubmitting] = useState(false);
  const [propMsg, setPropMsg] = useState('');
  const [propSuccess, setPropSuccess] = useState(false);
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, loading, isLive, refetch } = useMultiPortalData([
    { key: 'metrics',    endpoint: '/api/v1/dashboard/metrics',  fallback: {} },
    { key: 'clients',    endpoint: '/api/v1/clients',            fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.clients || []) },
    { key: 'leads',      endpoint: '/api/v1/clients?status=LEAD,QUALIFIED_LEAD', fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.clients || []) },
    { key: 'properties', endpoint: '/api/v1/properties',         fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.properties || []) },
    { key: 'tasks',      endpoint: '/api/v1/tasks',              fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.tasks || []) },
    { key: 'communications', endpoint: '/api/v1/communications',   fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'teamReports',    endpoint: '/api/v1/reports',          fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'notifications',  endpoint: '/api/v1/notifications',    fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
  ] as any);

  const m          = (data as any).metrics    || {};
  const clients    = (data as any).clients    || [];
  const leads      = (data as any).leads      || [];
  const properties = (data as any).properties || [];
  const tasks      = (data as any).tasks      || [];
  const comms      = (data as any).communications || [];
  const teamReports = (data as any).teamReports || [];
  const notifs     = (data as any).notifications || [];

  const unreadCount = Array.isArray(notifs) ? notifs.filter((n: any) => !n.read).length : 0;
  const nav = NAV.map(n => n.id === 'notifications' ? { ...n, badge: unreadCount || undefined } : n);

  const handleLogout = () => { logout(); navigate('/login'); };
  const portalUser = { name: user?.name || 'Operations', email: user?.email || 'ops@tst.com', role: 'Operations Manager' };

  return (
    <PortalLayout theme={theme} user={portalUser} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={handleLogout}>

      {section === 'overview' && (
        <div>
          <SectionHeader title="Operations Overview" subtitle="Client pipeline and sales performance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Clients"     value={(m as any).totalClients ?? (Array.isArray(clients) ? clients.length : '—')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} color={theme.hex} />
            <StatCard label="Active Leads"      value={(m as any).activeLeads  ?? (Array.isArray(leads) ? leads.length : '—')}   icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>} color={theme.hex} />
            <StatCard label="Pipeline Value"    value={(m as any).pipelineValue ? `KSh ${((m as any).pipelineValue / 1000000).toFixed(1)}M` : '—'} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} color={theme.hex} />
            <StatCard label="Properties Listed" value={(m as any).propertiesListed ?? (Array.isArray(properties) ? properties.length : '—')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} color={theme.hex} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Sales Pipeline</h3>
            <div className="space-y-3">
              {(() => {
                const stages = [
                  { label: 'Pending Commitment', status: 'PENDING_COMMITMENT' },
                  { label: 'Leads',              status: 'LEAD' },
                  { label: 'Qualified Leads',    status: 'QUALIFIED_LEAD' },
                  { label: 'Projects',           status: 'PROJECT' },
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
            action={<PortalButton color={theme.hex} onClick={() => setShowClientForm(f => !f)}>{showClientForm ? 'Cancel' : 'Add Client'}</PortalButton>} />
          {showClientForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
              {clientMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${clientMsg.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{clientMsg}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input type="text" value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))}
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
              <PortalButton color={theme.hex} fullWidth disabled={clientSubmitting || !clientForm.name} className="mt-4" onClick={async () => {
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
              { key: 'status',         label: 'Status',       render: (v) => <StatusBadge status={v || 'LEAD'} /> },
              { key: 'estimatedValue', label: 'Value (KSh)',  render: (v) => v ? Number(v).toLocaleString() : '—' },
            ]}
            rows={Array.isArray(clients) ? clients : []}
          />
        </div>
      )}

      {section === 'leads' && (
        <div>
          <SectionHeader title="Lead Management" subtitle="Qualify and convert leads to projects" />
          {actionMsg && (
            <div className={`p-3 rounded-xl text-sm mb-4 ${actionSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {actionMsg}
            </div>
          )}
          <div className="space-y-2">
            {((Array.isArray(leads) ? leads : []).filter((l: any) => l.status === 'LEAD' || l.status === 'QUALIFIED_LEAD')).map((lead: any, i: number) => (
              <div key={lead.id || i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{lead.name}</p>
                      <p className="text-xs text-gray-400">{lead.email}</p>
                    </div>
                    <StatusBadge status={lead.priority || 'MEDIUM'} />
                    <span className="text-xs text-gray-500">{lead.estimatedValue ? `KSh ${Number(lead.estimatedValue).toLocaleString()}` : '—'}</span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <PortalButton size="sm" color={theme.hex}
                      onClick={() => { setActiveAction(a => a?.clientId === lead.id && a.type === 'qualify' ? null : { type: 'qualify', clientId: lead.id }); setActionMsg(''); }}>
                      Qualify
                    </PortalButton>
                    {lead.status === 'QUALIFIED_LEAD' && (
                      <PortalButton size="sm" variant="secondary"
                        onClick={() => { setActiveAction(a => a?.clientId === lead.id && a.type === 'convert' ? null : { type: 'convert', clientId: lead.id }); setActionMsg(''); }}>
                        Convert
                      </PortalButton>
                    )}
                  </div>
                </div>
                {activeAction?.clientId === lead.id && activeAction.type === 'qualify' && (
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
                        <PortalButton color={theme.hex} disabled={actionSubmitting}>
                          {actionSubmitting ? 'Saving…' : 'Confirm Qualify'}
                        </PortalButton>
                        <PortalButton variant="secondary" onClick={() => setActiveAction(null)}>Cancel</PortalButton>
                      </div>
                    </form>
                  </div>
                )}
                {activeAction?.clientId === lead.id && activeAction.type === 'convert' && (
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
                        setActionMsg('Lead converted to project successfully!');
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
                        <PortalButton color={theme.hex} disabled={actionSubmitting}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {['PENDING_COMMITMENT', 'LEAD', 'QUALIFIED_LEAD', 'PROJECT'].map((status) => {
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
        <div>
          <SectionHeader title="Property Listings" subtitle="Available and sold properties"
            action={<PortalButton color={theme.hex} onClick={() => setPropTab('new')}>Add Property</PortalButton>} />
          <div className="flex gap-2 mb-4">
            {(['list', 'new'] as const).map(t => (
              <button key={t} onClick={() => setPropTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${propTab === t ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={propTab === t ? { backgroundColor: theme.hex } : {}}>
                {t === 'list' ? 'List' : 'New Property'}
              </button>
            ))}
          </div>
          {propTab === 'list' && (
            <DataTable
              columns={[
                { key: 'title',        label: 'Property' },
                { key: 'location',     label: 'Location' },
                { key: 'propertyType', label: 'Type' },
                { key: 'price',        label: 'Price (KSh)', render: (v) => v ? Number(v).toLocaleString() : '—' },
                { key: 'status',       label: 'Status', render: (v) => <StatusBadge status={v || 'AVAILABLE'} /> },
              ]}
              rows={Array.isArray(properties) ? properties : []}
            />
          )}
          {propTab === 'new' && (
            <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
              {propMsg && (
                <div className={`p-3 rounded-xl text-sm mb-4 ${propSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {propMsg}
                </div>
              )}
              <form onSubmit={async (e) => {
                e.preventDefault();
                setPropSubmitting(true);
                setPropMsg('');
                try {
                  const { apiClient } = await import('../../shared/api/apiClient');
                  await apiClient.post('/api/v1/properties', {
                    title: propForm.title,
                    description: propForm.description,
                    location: propForm.location,
                    country: propForm.country,
                    price: parseFloat(propForm.price),
                    currency: propForm.currency,
                    propertyType: propForm.propertyType,
                    size: propForm.size ? parseFloat(propForm.size) : undefined,
                  });
                  setPropSuccess(true);
                  setPropMsg('Property created successfully!');
                  setPropForm({ title: '', description: '', location: '', country: 'Kenya', price: '', currency: 'KES', propertyType: 'RESIDENTIAL', size: '' });
                  setPropTab('list');
                  refetch(['properties']);
                } catch (err: any) {
                  setPropSuccess(false);
                  setPropMsg(err?.response?.data?.error || 'Failed to create property');
                } finally {
                  setPropSubmitting(false);
                }
              }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                    <input type="text" required value={propForm.title} onChange={e => setPropForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
                    <textarea rows={3} required value={propForm.description} onChange={e => setPropForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Location *</label>
                    <input type="text" required value={propForm.location} onChange={e => setPropForm(f => ({ ...f, location: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Country *</label>
                    <select required value={propForm.country}
                      onChange={e => setPropForm(f => ({ ...f, country: e.target.value, currency: getCurrencyForCountry(e.target.value) }))}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Price *</label>
                    <input type="number" required min={0.01} step="0.01" value={propForm.price} onChange={e => setPropForm(f => ({ ...f, price: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency (auto from country)</label>
                    <input type="text" readOnly value={propForm.currency}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Type *</label>
                    <select required value={propForm.propertyType} onChange={e => setPropForm(f => ({ ...f, propertyType: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all">
                      {['LAND', 'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'AGRICULTURAL'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Size (sq m)</label>
                    <input type="number" min={0} value={propForm.size} onChange={e => setPropForm(f => ({ ...f, size: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                </div>
                <PortalButton color={theme.hex} fullWidth disabled={propSubmitting}>
                  {propSubmitting ? 'Creating…' : 'Create Property'}
                </PortalButton>
              </form>
            </div>
          )}
        </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to (User ID)</label>
                    <input type="text" value={taskForm.assignedTo} onChange={e => setTaskForm(f => ({ ...f, assignedTo: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
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
              { key: 'assignedTo', label: 'Assigned To', render: (v) => v || '—' },
              { key: 'id', label: 'Actions', render: (id) => (
                <PortalButton size="sm" color={theme.hex} onClick={async () => {
                  try {
                    const { apiClient } = await import('../../shared/api/apiClient');
                    await apiClient.patch(`/api/v1/tasks/${id}/status`, { status: 'COMPLETED' });
                  } catch { /* ignore */ }
                }}>Mark Complete</PortalButton>
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
            ]}
            rows={Array.isArray(comms) ? comms : []}
            emptyMessage="No communications logged yet"
          />
        </div>
      )}

      {section === 'reports' && (
        <div>
          <SectionHeader title="Team Reports" subtitle="Daily reports submitted by your team" />
          <DataTable
            columns={[
              { key: 'authorName',    label: 'Submitted By' },
              { key: 'reportDate',    label: 'Date',         render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'hoursWorked',   label: 'Hours' },
              { key: 'accomplishments', label: 'Accomplishments', render: (v) => <span className="text-xs text-gray-600 line-clamp-2">{v || '—'}</span> },
              { key: 'challenges',    label: 'Challenges',   render: (v) => <span className="text-xs text-gray-600 line-clamp-1">{v || '—'}</span> },
            ]}
            rows={Array.isArray(teamReports) ? teamReports : []}
            emptyMessage="No reports submitted yet"
          />
        </div>
      )}

      {section === 'notifications' && (
        <div>
          <SectionHeader title="Notifications" subtitle="System alerts and updates" />
          <div className="space-y-3">
            {(Array.isArray(notifs) ? notifs : []).map((n: any, i: number) => (
              <div key={n.id || i} className={`bg-white rounded-2xl border p-4 flex items-start gap-4 ${n.read ? 'border-gray-100' : 'border-blue-100 bg-blue-50/30'}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.hex + '22' }}>
                  <svg className="w-5 h-5" style={{ color: theme.hex }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{n.title || 'Notification'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message || n.description || ''}</p>
                  {n.createdAt && <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>}
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />}
              </div>
            ))}
            {!notifs.length && <div className="text-center py-12 text-gray-400 text-sm">No notifications yet</div>}
          </div>
        </div>
      )}

      {/* Chat — COO dept: higher-ups and own team (doc §9 Portal 3 COO) */}
      {section === 'chat' && (
        <div>
          <SectionHeader title="Chat" subtitle="Chat with CoS, CEO, CFO, EA, CTO and your team" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                const { apiClient } = await import('../../shared/api/apiClient');
                await apiClient.post('/api/v1/chat/messages', { message: fd.get('message'), type: 'INTERNAL' });
                (e.target as HTMLFormElement).reset();
              } catch { /* silent */ }
            }} className="space-y-4">
              <textarea name="message" rows={4} required placeholder="Type your message…"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
              <PortalButton color={theme.hex} fullWidth>Send Message</PortalButton>
            </form>
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
