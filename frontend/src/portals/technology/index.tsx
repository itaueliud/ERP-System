/**
 * Portal 5 — Technology Portal (gatewayvertex)
 * Same URL for all 3 CTO departments. RBA loads the correct department view.
 * GitHub integration applies to all.
 *
 * Department 1 — Technology Infrastructure & Security
 *   → TECH_STAFF with dept type TECHNOLOGY_INFRASTRUCTURE_SECURITY
 * Department 2 — Software Engineering & Product Development
 *   → TECH_STAFF with dept type SOFTWARE_ENGINEERING_PRODUCT_DEVELOPMENT
 * Department 3 — Engineering Operations & Delivery (developer teams)
 *   → DEVELOPER role (team leaders + members)
 */
import React, { useState } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';
import { projectDisplayStatus } from '../../shared/utils/projectStatus';
import ChatPanel from '../../shared/components/chat/ChatPanel';
import { TECHNOLOGY_FAQS } from '../../shared/data/portalFAQs';

const theme = PORTAL_THEMES.technology;

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.6)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

// ─── Shared: Daily Report Form ────────────────────────────────────────────────
function DailyReportForm({ themeHex, onSubmitted }: { themeHex: string; onSubmitted?: () => void }) {
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
      setOk(true); setMsg('Report submitted!'); clear(); onSubmitted?.();
    } catch (err: any) { setOk(false); setMsg(err?.response?.data?.error || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };
  const inp = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';
  return (
    <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
      <form onSubmit={submit}>
        <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1.5">Accomplishments *</label><textarea rows={3} required value={form.accomplishments} onChange={set('accomplishments')} className={`${inp} resize-none`} /></div>
        <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1.5">Challenges</label><textarea rows={3} value={form.challenges} onChange={set('challenges')} className={`${inp} resize-none`} /></div>
        <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1.5">Plan for tomorrow</label><textarea rows={3} value={form.tomorrowPlan} onChange={set('tomorrowPlan')} className={`${inp} resize-none`} /></div>
        <div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-1.5">Hours worked</label><input type="number" min={0} max={24} value={form.hoursWorked} onChange={set('hoursWorked')} className={inp} /></div>
        <div className="flex gap-2">
          <PortalButton color={themeHex} fullWidth disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Report'}</PortalButton>
          <PortalButton variant="secondary" onClick={clear} disabled={submitting}>Clear</PortalButton>
        </div>
      </form>
    </div>
  );
}

// ─── Shared: Chat Section ─────────────────────────────────────────────────────
function ChatSection({ user, isTeamLeader, userProfile }: { user: any; isTeamLeader: boolean; userProfile: any }) {
  const role = user?.role || userProfile?.role || '';
  const isNonLeaderDev = role === 'DEVELOPER' && !isTeamLeader;
  return (
    <div>
      <SectionHeader
        title="Chat"
        subtitle={role === 'DEVELOPER' && isTeamLeader ? 'Chat with CTO — Team Leaders only' : 'Chat with your team and higher-ups'}
      />
      {isNonLeaderDev ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
          <div className="flex items-center gap-2 mb-1 font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            View only
          </div>
          Chat is restricted to Team Leaders only. Non-leader team members can view conversations but cannot send messages.
        </div>
      ) : (
        <div style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
          <ChatPanel token={user?.token || ''} currentUserId={user?.id || ''} portal="Technology Portal" inlineMode />
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const I = {
  overview:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>,
  security:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  infra:     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
  risk:      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  compliance:<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  github:    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>,
  kanban:    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
  code:      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  roadmap:   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
  projects:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  teams:     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  contracts: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  chat:      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  report:    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  assign:    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
  achieve:   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENT 1 — Technology Infrastructure & Security
// Lead: Security Manager
// ═══════════════════════════════════════════════════════════════════════════════
const INFRA_NAV = [
  { id: 'overview',      label: 'Overview',                icon: I.overview },
  { id: 'security',      label: 'Security Status',         icon: I.security },
  { id: 'infrastructure',label: 'Infrastructure Health',   icon: I.infra },
  { id: 'incidents',     label: 'Incident Log',            icon: I.risk },
  { id: 'risk',          label: 'Risk Register',           icon: I.risk },
  { id: 'compliance',    label: 'Client Compliance',       icon: I.compliance },
  { id: 'github',        label: 'GitHub Activity',         icon: I.github },
  { id: 'deployments',   label: 'Deployment Log',          icon: I.assign },
  { id: 'achievements',  label: 'Achievements',            icon: I.achieve },
  { id: 'chat',          label: 'Chat',                    icon: I.chat },
  { id: 'daily-report',  label: 'Daily Report',            icon: I.report },
];

function InfraSecurityDashboard({ data, refetch, user, onLogout }: { data: any; refetch: (k?: string[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [health, setHealth] = React.useState<any>(null);
  const [healthLoading, setHealthLoading] = React.useState(false);
  const [incidentForm, setIncidentForm] = React.useState({ title: '', severity: 'MEDIUM', description: '', affectedSystem: '' });
  const [incidentMsg, setIncidentMsg] = React.useState('');
  const [incidentOk, setIncidentOk] = React.useState(false);
  const [incidents, setIncidents] = React.useState<any[]>([]);
  const [deployForm, setDeployForm] = React.useState({ environment: 'PRODUCTION', service: '', version: '', notes: '' });
  const [deployMsg, setDeployMsg] = React.useState('');
  const [deployOk, setDeployOk] = React.useState(false);
  const [deployments, setDeployments] = React.useState<any[]>([]);

  const repos    = data.repos    || [];
  const commits  = data.commits  || [];
  const notifs   = data.notifications || [];
  const achievements = data.achievements || [];

  React.useEffect(() => {
    if (section === 'infrastructure' && !health) {
      setHealthLoading(true);
      import('../../shared/api/apiClient').then(({ apiClient }) =>
        apiClient.get('/api/v1/admin/health').then(r => setHealth((r.data as any).data || r.data)).catch(() => {})
      ).finally(() => setHealthLoading(false));
    }
    if (section === 'incidents' && incidents.length === 0) {
      import('../../shared/api/apiClient').then(({ apiClient }) =>
        apiClient.get('/api/v1/incidents').then(r => setIncidents((r.data as any).data || r.data || [])).catch(() => {})
      );
    }
    if (section === 'deployments' && deployments.length === 0) {
      import('../../shared/api/apiClient').then(({ apiClient }) =>
        apiClient.get('/api/v1/deployments').then(r => setDeployments((r.data as any).data || r.data || [])).catch(() => {})
      );
    }
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const portalUser = { name: user?.name || 'Security Manager', email: user?.email || '', role: 'Security Manager' };

  return (
    <PortalLayout theme={theme} user={portalUser} navItems={INFRA_NAV} activeSection={section} onSectionChange={setSection} onLogout={onLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={TECHNOLOGY_FAQS} portalName="Technology Portal — Infrastructure & Security">

      {section === 'overview' && (
        <div>
          <SectionHeader title="Technology Infrastructure & Security" subtitle="Department 1 — System security, infrastructure management, risk and compliance" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Active Repos" value={repos.length || '—'} icon={I.github} color={theme.hex} />
            <StatCard label="Recent Commits" value={commits.length || '—'} icon={I.code} color={theme.hex} />
            <StatCard label="Open Issues" value={(data.summary as any)?.openIssues ?? '—'} icon={I.risk} color={theme.hex} />
            <StatCard label="Compliance Status" value="Active" icon={I.compliance} color={theme.hex} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">System Security Status</h3>
              {[
                { system: 'Database', status: 'green' },
                { system: 'API Gateway', status: 'green' },
                { system: 'Authentication', status: 'green' },
                { system: 'File Storage', status: 'amber' },
                { system: 'Payment Gateway', status: 'green' },
              ].map(s => (
                <div key={s.system} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{s.system}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.status === 'green' ? 'bg-green-100 text-green-700' : s.status === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {s.status === 'green' ? '● Operational' : s.status === 'amber' ? '● Degraded' : '● Down'}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">Recent GitHub Activity</h3>
              {commits.slice(0, 5).map((c: any, i: number) => (
                <div key={c.sha || i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="font-mono text-xs text-indigo-600 flex-shrink-0">{(c.sha || 'abc1234').slice(0, 7)}</span>
                  <p className="text-xs text-gray-700 truncate flex-1">{c.message || 'Commit'}</p>
                </div>
              ))}
              {!commits.length && <p className="text-sm text-gray-400">No recent commits</p>}
            </div>
          </div>
        </div>
      )}

      {section === 'security' && (
        <div>
          <SectionHeader title="Security Status Board" subtitle="Green / Amber / Red per system" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Database', 'API Gateway', 'Authentication Service', 'File Storage (S3/R2)', 'Payment Gateway (Daraja)', 'Redis Cache', 'WebSocket Server', 'Email Gateway (SendGrid)', 'SMS Gateway (Africa\'s Talking)'].map(sys => (
              <div key={sys} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{sys}</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">● Operational</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'infrastructure' && (
        <div>
          <SectionHeader title="Infrastructure Health Monitor" subtitle="Live server, network, and hosting metrics"
            action={<PortalButton size="sm" variant="secondary" onClick={() => { setHealth(null); setHealthLoading(true); import('../../shared/api/apiClient').then(({ apiClient }) => apiClient.get('/api/v1/admin/health').then(r => setHealth((r.data as any).data || r.data)).catch(() => {})).finally(() => setHealthLoading(false)); }}>Refresh</PortalButton>} />
          {healthLoading && <p className="text-sm text-gray-400 mb-4">Loading live metrics…</p>}
          {health && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Status', value: health.status === 'healthy' ? '✓ Healthy' : '⚠ Degraded', color: health.status === 'healthy' ? '#22c55e' : '#f59e0b' },
                { label: 'Uptime', value: health.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : '—', color: theme.hex },
                { label: 'Memory', value: health.memoryMb ? `${health.memoryMb} MB` : '—', color: theme.hex },
                { label: 'Database', value: health.database?.ok ? `✓ ${health.database.responseMs}ms` : '✗ Down', color: health.database?.ok ? '#22c55e' : '#ef4444' },
                { label: 'Cache (Redis)', value: health.cache?.ok ? `✓ ${health.cache.responseMs}ms` : '✗ Down', color: health.cache?.ok ? '#22c55e' : '#ef4444' },
                { label: 'Checked At', value: health.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : '—', color: '#94a3b8' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{m.label}</p>
                  <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          )}
          {!health && !healthLoading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[{ label: 'CPU Usage', value: '—' }, { label: 'Memory', value: '—' }, { label: 'Disk', value: '—' }, { label: 'Network', value: '—' }].map(m => (
                <div key={m.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{m.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{m.value}</p>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Disaster Recovery Checklist</h3>
            {['Database backup verified', 'Failover tested', 'Recovery scripts up to date', 'Backup email configured', 'Monitoring alerts active'].map(item => (
              <div key={item} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'incidents' && (
        <div>
          <SectionHeader title="Incident Log" subtitle="Create and track system incidents" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 max-w-2xl">
            <p className="font-semibold text-gray-800 mb-4">Log New Incident</p>
            {incidentMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${incidentOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{incidentMsg}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                <input type="text" required value={incidentForm.title} onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="e.g. Database connection timeout" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Severity</label>
                <select value={incidentForm.severity} onChange={e => setIncidentForm(f => ({ ...f, severity: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                  {['LOW','MEDIUM','HIGH','CRITICAL'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Affected System</label>
                <input type="text" value={incidentForm.affectedSystem} onChange={e => setIncidentForm(f => ({ ...f, affectedSystem: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="e.g. Database, API Gateway" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description / Resolution Notes</label>
                <textarea rows={3} value={incidentForm.description} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 resize-none" />
              </div>
            </div>
            <PortalButton color={theme.hex} onClick={async () => {
              if (!incidentForm.title.trim()) { setIncidentOk(false); setIncidentMsg('Title is required.'); return; }
              try {
                const { apiClient } = await import('../../shared/api/apiClient');
                const res = await apiClient.post('/api/v1/incidents', incidentForm);
                setIncidentOk(true); setIncidentMsg('Incident logged!');
                setIncidents(prev => [res.data?.data || res.data, ...prev]);
                setIncidentForm({ title: '', severity: 'MEDIUM', description: '', affectedSystem: '' });
              } catch (err: any) { setIncidentOk(false); setIncidentMsg(err?.response?.data?.error || 'Failed'); }
            }}>Log Incident</PortalButton>
          </div>
          <DataTable
            columns={[
              { key: 'title', label: 'Incident' },
              { key: 'affectedSystem', label: 'System', render: v => v || '—' },
              { key: 'severity', label: 'Severity', render: v => <StatusBadge status={v || 'MEDIUM'} /> },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'OPEN'} /> },
              { key: 'createdAt', label: 'Logged', render: v => v ? new Date(v).toLocaleString() : '—' },
              { key: 'id', label: 'Actions', render: (id, row: any) => (
                row.status !== 'RESOLVED' ? (
                  <PortalButton size="sm" color={theme.hex} onClick={async () => {
                    try {
                      const { apiClient } = await import('../../shared/api/apiClient');
                      await apiClient.patch(`/api/v1/incidents/${id}`, { status: 'RESOLVED' });
                      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'RESOLVED' } : i));
                    } catch { /* silent */ }
                  }}>Resolve</PortalButton>
                ) : <span className="text-xs text-green-600 font-semibold">✓ Resolved</span>
              )},
            ]}
            rows={incidents}
            emptyMessage="No incidents logged"
          />
        </div>
      )}

      {section === 'risk' && (
        <div>
          <SectionHeader title="Risk Register" subtitle="Identified risks and mitigation status" />
          <DataTable
            columns={[
              { key: 'risk', label: 'Risk', render: (_v, r: any) => r.risk || r.title || r.description || '—' },
              { key: 'severity', label: 'Severity', render: v => <StatusBadge status={v || 'MEDIUM'} /> },
              { key: 'mitigation', label: 'Mitigation', render: (_v, r: any) => r.mitigation || r.notes || '—' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'ACTIVE'} /> },
            ]}
            rows={data.risks || []}
            emptyMessage="No risks logged yet"
          />
        </div>
      )}

      {section === 'compliance' && (
        <div>
          <SectionHeader title="Client System Compliance" subtitle="Compliance status per client" />
          <DataTable
            columns={[
              { key: 'clientName', label: 'Client' },
              { key: 'system', label: 'System' },
              { key: 'complianceStatus', label: 'Status', render: v => <StatusBadge status={v || 'COMPLIANT'} /> },
              { key: 'lastChecked', label: 'Last Checked', render: v => v ? new Date(v).toLocaleDateString() : '—' },
            ]}
            rows={data.compliance || []}
            emptyMessage="No compliance records"
          />
        </div>
      )}

      {section === 'github' && (
        <div>
          <SectionHeader title="GitHub Activity Feed" subtitle="Linked repositories and commit activity" />
          <DataTable
            columns={[
              { key: 'name', label: 'Repository' },
              { key: 'language', label: 'Language' },
              { key: 'stars', label: '⭐ Stars' },
              { key: 'openPRs', label: 'Open PRs' },
              { key: 'lastCommit', label: 'Last Commit', render: v => v ? new Date(v).toLocaleDateString() : '—' },
            ]}
            rows={repos}
            emptyMessage="No repositories linked"
          />
        </div>
      )}

      {section === 'achievements' && (
        <div>
          <SectionHeader title="Team Achievements" subtitle="Cross-country achievements" />
          <DataTable
            columns={[{ key: 'country', label: 'Country' }, { key: 'title', label: 'Achievement' }, { key: 'achievementDate', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' }]}
            rows={achievements}
            emptyMessage="No achievements recorded"
          />
        </div>
      )}

      {section === 'deployments' && (
        <div>
          <SectionHeader title="Deployment Log" subtitle="Record and track deployments across environments" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 max-w-2xl">
            <p className="font-semibold text-gray-800 mb-4">Log Deployment</p>
            {deployMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${deployOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{deployMsg}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Service / App *</label>
                <input type="text" value={deployForm.service} onChange={e => setDeployForm(f => ({ ...f, service: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="e.g. backend-api" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Version / Tag</label>
                <input type="text" value={deployForm.version} onChange={e => setDeployForm(f => ({ ...f, version: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="e.g. v2.4.1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Environment</label>
                <select value={deployForm.environment} onChange={e => setDeployForm(f => ({ ...f, environment: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                  {['PRODUCTION','STAGING','DEVELOPMENT'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input type="text" value={deployForm.notes} onChange={e => setDeployForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="Optional notes" />
              </div>
            </div>
            <PortalButton color={theme.hex} onClick={async () => {
              if (!deployForm.service.trim()) { setDeployOk(false); setDeployMsg('Service name is required.'); return; }
              try {
                const { apiClient } = await import('../../shared/api/apiClient');
                const res = await apiClient.post('/api/v1/deployments', { ...deployForm, deployedBy: user?.name || user?.email });
                setDeployOk(true); setDeployMsg('Deployment logged!');
                setDeployments(prev => [res.data?.data || res.data, ...prev]);
                setDeployForm({ environment: 'PRODUCTION', service: '', version: '', notes: '' });
              } catch (err: any) { setDeployOk(false); setDeployMsg(err?.response?.data?.error || 'Failed'); }
            }}>Log Deployment</PortalButton>
          </div>
          <DataTable
            columns={[
              { key: 'service', label: 'Service' },
              { key: 'version', label: 'Version', render: v => v ? <span className="font-mono text-xs text-indigo-600">{v}</span> : '—' },
              { key: 'environment', label: 'Environment', render: v => <StatusBadge status={v || 'PRODUCTION'} /> },
              { key: 'deployedBy', label: 'Deployed By', render: (v, r: any) => v || r.deployed_by || '—' },
              { key: 'createdAt', label: 'When', render: v => v ? new Date(v).toLocaleString() : '—' },
              { key: 'notes', label: 'Notes', render: v => v ? <span className="text-xs text-gray-500">{v}</span> : '—' },
            ]}
            rows={deployments}
            emptyMessage="No deployments logged yet"
          />
        </div>
      )}

      {section === 'chat' && <ChatSection user={user} isTeamLeader={false} userProfile={{}} />}
      {section === 'daily-report' && <div><SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" /><DailyReportForm themeHex={theme.hex} onSubmitted={() => refetch()} /></div>}

    </PortalLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENT 2 — Software Engineering & Product Development
// Lead: Lead Software Architect
// ═══════════════════════════════════════════════════════════════════════════════
const SOFTENG_NAV = [
  { id: 'overview',     label: 'Overview',              icon: I.overview },
  { id: 'kanban',       label: 'Feature Board',         icon: I.kanban },
  { id: 'sprints',      label: 'Sprint Planning',       icon: I.roadmap },
  { id: 'github',       label: 'GitHub PRs & Commits',  icon: I.github },
  { id: 'qa',           label: 'QA & Code Quality',     icon: I.compliance },
  { id: 'roadmap',      label: 'Product Roadmap',       icon: I.roadmap },
  { id: 'deployments',  label: 'Deployment Log',        icon: I.assign },
  { id: 'achievements', label: 'Achievements',          icon: I.achieve },
  { id: 'chat',         label: 'Chat',                  icon: I.chat },
  { id: 'daily-report', label: 'Daily Report',          icon: I.report },
];

function SoftwareEngineeringDashboard({ data, refetch, user, onLogout }: { data: any; refetch: (k?: string[]) => void; user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [sprintForm, setSprintForm] = React.useState({ name: '', startDate: '', endDate: '', goal: '' });
  const [sprintMsg, setSprintMsg] = React.useState('');
  const [sprintOk, setSprintOk] = React.useState(false);
  const [sprints, setSprints] = React.useState<any[]>([]);
  const [prReviewId, setPrReviewId] = React.useState('');
  const [prReviewer, setPrReviewer] = React.useState('');
  const [prMsg, setPrMsg] = React.useState('');
  const [deployForm, setDeployForm] = React.useState({ environment: 'PRODUCTION', service: '', version: '', notes: '' });
  const [deployMsg, setDeployMsg] = React.useState('');
  const [deployOk, setDeployOk] = React.useState(false);
  const [deployments, setDeployments] = React.useState<any[]>([]);

  const repos    = data.repos    || [];
  const commits  = data.commits  || [];
  const notifs   = data.notifications || [];
  const achievements = data.achievements || [];

  React.useEffect(() => {
    if (section === 'sprints' && sprints.length === 0) {
      import('../../shared/api/apiClient').then(({ apiClient }) =>
        apiClient.get('/api/v1/sprints').then(r => setSprints((r.data as any).data || r.data || [])).catch(() => {})
      );
    }
    if (section === 'deployments' && deployments.length === 0) {
      import('../../shared/api/apiClient').then(({ apiClient }) =>
        apiClient.get('/api/v1/deployments').then(r => setDeployments((r.data as any).data || r.data || [])).catch(() => {})
      );
    }
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const portalUser = { name: user?.name || 'Lead Software Architect', email: user?.email || '', role: 'Lead Software Architect' };

  return (
    <PortalLayout theme={theme} user={portalUser} navItems={SOFTENG_NAV} activeSection={section} onSectionChange={setSection} onLogout={onLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={TECHNOLOGY_FAQS} portalName="Technology Portal — Software Engineering">

      {section === 'overview' && (
        <div>
          <SectionHeader title="Software Engineering & Product Development" subtitle="Department 2 — Applications, features, UI/UX, QA, and product roadmap" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Repositories" value={repos.length || '—'} icon={I.github} color={theme.hex} />
            <StatCard label="Recent Commits" value={commits.length || '—'} icon={I.code} color={theme.hex} />
            <StatCard label="Open PRs" value={repos.reduce((s: number, r: any) => s + (r.openPRs || 0), 0) || '—'} icon={I.kanban} color={theme.hex} />
            <StatCard label="Open Issues" value={(data.summary as any)?.openIssues ?? '—'} icon={I.risk} color={theme.hex} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">Recent Commits</h3>
              {commits.slice(0, 6).map((c: any, i: number) => (
                <div key={c.sha || i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <span className="font-mono text-xs text-indigo-600 flex-shrink-0">{(c.sha || 'abc1234').slice(0, 7)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">{c.message || 'Commit'}</p>
                    <p className="text-[10px] text-gray-400">{c.author}</p>
                  </div>
                  <div className="text-xs flex-shrink-0">
                    <span className="text-green-600">+{c.additions || 0}</span>
                    <span className="text-gray-300 mx-1">/</span>
                    <span className="text-red-500">-{c.deletions || 0}</span>
                  </div>
                </div>
              ))}
              {!commits.length && <p className="text-sm text-gray-400">No recent commits</p>}
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">Repositories</h3>
              {repos.slice(0, 6).map((r: any, i: number) => (
                <div key={r.id || i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.name || `repo-${i}`}</p>
                    <p className="text-xs text-gray-400">{r.language || 'TypeScript'}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>⭐ {r.stars || 0}</span>
                    <span>🔀 {r.openPRs || 0} PRs</span>
                  </div>
                </div>
              ))}
              {!repos.length && <p className="text-sm text-gray-400">No repositories linked</p>}
            </div>
          </div>
        </div>
      )}

      {section === 'kanban' && (
        <div>
          <SectionHeader title="Feature Development Board" subtitle="Kanban: To Do → In Progress → Review → Done" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(['TO_DO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const).map(col => {
              const labels: Record<string, string> = { TO_DO: 'To Do', IN_PROGRESS: 'In Progress', REVIEW: 'Review', DONE: 'Done' };
              const colors: Record<string, string> = { TO_DO: '#94a3b8', IN_PROGRESS: '#3b82f6', REVIEW: '#f59e0b', DONE: '#22c55e' };
              const items = (data.features || []).filter((f: any) => f.status === col);
              return (
                <div key={col} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[col] }} />
                    <span className="text-sm font-bold text-gray-800">{labels[col]}</span>
                    <span className="ml-auto text-xs text-gray-400">{items.length}</span>
                  </div>
                  <div className="p-3 space-y-2 min-h-32">
                    {items.map((f: any, i: number) => (
                      <div key={f.id || i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-800">{f.title || f.name || 'Feature'}</p>
                        {f.assignee && <p className="text-[10px] text-gray-400 mt-1">{f.assignee}</p>}
                      </div>
                    ))}
                    {!items.length && <p className="text-xs text-gray-400 text-center py-4">No items</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {section === 'qa' && (
        <div>
          <SectionHeader title="QA & Code Quality" subtitle="Test results and code quality metrics" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[{ label: 'Test Coverage', value: '78%' }, { label: 'Passing Tests', value: '1,204' }, { label: 'Failing Tests', value: '3' }, { label: 'Code Score', value: 'A' }].map(m => (
              <div key={m.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{m.label}</p>
                <p className="text-2xl font-bold text-gray-900">{m.value}</p>
              </div>
            ))}
          </div>
          <DataTable
            columns={[{ key: 'suite', label: 'Test Suite' }, { key: 'passed', label: 'Passed' }, { key: 'failed', label: 'Failed' }, { key: 'coverage', label: 'Coverage', render: v => v ? `${v}%` : '—' }]}
            rows={data.testResults || []}
            emptyMessage="No test results"
          />
        </div>
      )}

      {section === 'roadmap' && (
        <div>
          <SectionHeader title="Product Roadmap" subtitle="Planned features and delivery milestones" />
          <DataTable
            columns={[{ key: 'feature', label: 'Feature' }, { key: 'quarter', label: 'Quarter' }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PLANNED'} /> }, { key: 'owner', label: 'Owner' }]}
            rows={data.roadmap || []}
            emptyMessage="No roadmap items"
          />
        </div>
      )}

      {section === 'achievements' && (
        <div>
          <SectionHeader title="Team Achievements" subtitle="Cross-country achievements" />
          <DataTable
            columns={[{ key: 'country', label: 'Country' }, { key: 'title', label: 'Achievement' }, { key: 'achievementDate', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' }]}
            rows={achievements}
            emptyMessage="No achievements recorded"
          />
        </div>
      )}

      {section === 'sprints' && (
        <div>
          <SectionHeader title="Sprint Planning" subtitle="Group kanban items into sprints with start/end dates" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 max-w-2xl">
            <p className="font-semibold text-gray-800 mb-4">Create Sprint</p>
            {sprintMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${sprintOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{sprintMsg}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sprint Name *</label>
                <input type="text" value={sprintForm.name} onChange={e => setSprintForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="e.g. Sprint 12 — Auth Overhaul" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date *</label>
                <input type="date" value={sprintForm.startDate} onChange={e => setSprintForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date *</label>
                <input type="date" value={sprintForm.endDate} onChange={e => setSprintForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sprint Goal</label>
                <input type="text" value={sprintForm.goal} onChange={e => setSprintForm(f => ({ ...f, goal: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="What should be achieved by end of sprint?" />
              </div>
            </div>
            <PortalButton color={theme.hex} onClick={async () => {
              if (!sprintForm.name.trim() || !sprintForm.startDate || !sprintForm.endDate) { setSprintOk(false); setSprintMsg('Name, start date, and end date are required.'); return; }
              try {
                const { apiClient } = await import('../../shared/api/apiClient');
                const res = await apiClient.post('/api/v1/sprints', sprintForm);
                setSprintOk(true); setSprintMsg('Sprint created!');
                setSprints(prev => [res.data?.data || res.data, ...prev]);
                setSprintForm({ name: '', startDate: '', endDate: '', goal: '' });
              } catch (err: any) { setSprintOk(false); setSprintMsg(err?.response?.data?.error || 'Failed'); }
            }}>Create Sprint</PortalButton>
          </div>
          <DataTable
            columns={[
              { key: 'name', label: 'Sprint' },
              { key: 'goal', label: 'Goal', render: v => v ? <span className="text-xs text-gray-600">{v}</span> : '—' },
              { key: 'startDate', label: 'Start', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'endDate', label: 'End', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PLANNED'} /> },
              { key: 'itemCount', label: 'Items', render: v => v ?? '—' },
            ]}
            rows={sprints}
            emptyMessage="No sprints created yet"
          />
        </div>
      )}

      {section === 'github' && (
        <div>
          <SectionHeader title="GitHub PRs & Commit Activity" subtitle="Pull requests and commit feed" />
          {prMsg && <div className="p-3 rounded-xl text-sm mb-4 bg-green-50 text-green-700">{prMsg}</div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Pull Requests</h3>
              <DataTable
                columns={[
                  { key: 'title', label: 'PR Title' },
                  { key: 'author', label: 'Author' },
                  { key: 'repo', label: 'Repo' },
                  { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'OPEN'} /> },
                  { key: 'id', label: 'Assign Reviewer', render: (id, row: any) => (
                    prReviewId === id ? (
                      <div className="flex gap-1.5 items-center">
                        <input type="text" value={prReviewer} onChange={e => setPrReviewer(e.target.value)}
                          placeholder="GitHub username" className="px-2 py-1 rounded-lg border border-gray-200 text-xs w-28 focus:outline-none" />
                        <PortalButton size="sm" color={theme.hex} onClick={async () => {
                          if (!prReviewer.trim()) return;
                          try {
                            const { apiClient } = await import('../../shared/api/apiClient');
                            await apiClient.post(`/api/v1/github/pull-requests/${id}/reviewer`, { reviewer: prReviewer.trim() });
                            setPrMsg(`Reviewer @${prReviewer} assigned to PR: ${row.title}`);
                            setPrReviewId(''); setPrReviewer('');
                          } catch (err: any) { setPrMsg(err?.response?.data?.error || 'Failed to assign reviewer'); }
                        }}>Assign</PortalButton>
                        <button onClick={() => { setPrReviewId(''); setPrReviewer(''); }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    ) : (
                      <PortalButton size="sm" variant="secondary" onClick={() => { setPrReviewId(id); setPrReviewer(''); }}>Assign</PortalButton>
                    )
                  )},
                ]}
                rows={data.pullRequests || []}
                emptyMessage="No open pull requests"
              />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Recent Commits</h3>
              <DataTable
                columns={[{ key: 'sha', label: 'SHA', render: v => <span className="font-mono text-xs text-indigo-600">{(v || '').slice(0, 7)}</span> }, { key: 'message', label: 'Message', render: v => <span className="text-xs">{String(v || '').slice(0, 50)}</span> }, { key: 'author', label: 'Author' }]}
                rows={commits}
                emptyMessage="No commits"
              />
            </div>
          </div>
        </div>
      )}

      {section === 'deployments' && (
        <div>
          <SectionHeader title="Deployment Log" subtitle="Record and track deployments" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 max-w-2xl">
            <p className="font-semibold text-gray-800 mb-4">Log Deployment</p>
            {deployMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${deployOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{deployMsg}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Service *</label>
                <input type="text" value={deployForm.service} onChange={e => setDeployForm(f => ({ ...f, service: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="e.g. frontend" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Version</label>
                <input type="text" value={deployForm.version} onChange={e => setDeployForm(f => ({ ...f, version: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="e.g. v1.8.0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Environment</label>
                <select value={deployForm.environment} onChange={e => setDeployForm(f => ({ ...f, environment: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                  {['PRODUCTION','STAGING','DEVELOPMENT'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input type="text" value={deployForm.notes} onChange={e => setDeployForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
              </div>
            </div>
            <PortalButton color={theme.hex} onClick={async () => {
              if (!deployForm.service.trim()) { setDeployOk(false); setDeployMsg('Service is required.'); return; }
              try {
                const { apiClient } = await import('../../shared/api/apiClient');
                const res = await apiClient.post('/api/v1/deployments', { ...deployForm, deployedBy: user?.name || user?.email });
                setDeployOk(true); setDeployMsg('Deployment logged!');
                setDeployments(prev => [res.data?.data || res.data, ...prev]);
                setDeployForm({ environment: 'PRODUCTION', service: '', version: '', notes: '' });
              } catch (err: any) { setDeployOk(false); setDeployMsg(err?.response?.data?.error || 'Failed'); }
            }}>Log Deployment</PortalButton>
          </div>
          <DataTable
            columns={[
              { key: 'service', label: 'Service' },
              { key: 'version', label: 'Version', render: v => v ? <span className="font-mono text-xs text-indigo-600">{v}</span> : '—' },
              { key: 'environment', label: 'Environment', render: v => <StatusBadge status={v || 'PRODUCTION'} /> },
              { key: 'deployedBy', label: 'Deployed By', render: (v, r: any) => v || r.deployed_by || '—' },
              { key: 'createdAt', label: 'When', render: v => v ? new Date(v).toLocaleString() : '—' },
            ]}
            rows={deployments}
            emptyMessage="No deployments logged yet"
          />
        </div>
      )}

      {section === 'chat' && <ChatSection user={user} isTeamLeader={false} userProfile={{}} />}
      {section === 'daily-report' && <div><SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" /><DailyReportForm themeHex={theme.hex} onSubmitted={() => refetch()} /></div>}

    </PortalLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENT 3 — Engineering Operations & Delivery
// Team Leaders + Members (DEVELOPER role)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Team Members Table ───────────────────────────────────────────────────────
function TeamMembersTable({ team, themeHex }: { team: any; themeHex: string }) {
  const [members, setMembers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { apiClient } = await import('../../shared/api/apiClient');
        const res = await apiClient.get(`/api/v1/organization/teams/${team.id}/members`);
        if (!cancelled) setMembers((res.data as any)?.data || []);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [team.id]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between" style={{ background: themeHex + '08' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: themeHex }}>
            {(team.name || 'T')[0].toUpperCase()}
          </div>
          <span className="font-bold text-gray-900 text-sm">{team.name}</span>
        </div>
        <span className="text-xs text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</span>
      </div>
      {loading ? (
        <div className="px-5 py-4 text-sm text-gray-400">Loading members…</div>
      ) : members.length === 0 ? (
        <div className="px-5 py-4 text-sm text-gray-400 italic">No members assigned yet</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{['Developer', 'Email', 'GitHub', 'Role', 'Status'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {members.map((m: any, i: number) => (
              <tr key={m.id || i} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: m.isTeamLeader ? themeHex : '#94a3b8' }}>
                      {(m.fullName || m.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{m.fullName || m.name || '—'}</p>
                      {m.country && <p className="text-xs text-gray-400">{m.country}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{m.email || '—'}</td>
                <td className="px-4 py-3">{m.githubUsername ? <a href={`https://github.com/${m.githubUsername}`} target="_blank" rel="noreferrer" className="text-xs font-mono text-indigo-600 hover:underline">@{m.githubUsername}</a> : <span className="text-xs text-gray-400 italic">Not linked</span>}</td>
                <td className="px-4 py-3">{m.isTeamLeader ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: themeHex }}>★ Team Leader</span> : <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Member</span>}</td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{m.isActive !== false ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EngineeringOperationsDashboard({ data, refetch, user, isTeamLeader, userProfile, onLogout }: {
  data: any; refetch: (k?: string[]) => void; user: any; isTeamLeader: boolean; userProfile: any; onLogout: () => void;
}) {
  const [section, setSection] = useState('overview');
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignTeamId, setAssignTeamId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState({ teamName: '', githubOrg: '', leaderName: '', leaderEmail: '', leaderPaymentType: 'MPESA', leaderPayment: '', member2Name: '', member2Email: '', member2PaymentType: 'MPESA', member2Payment: '', member3Name: '', member3Email: '', member3PaymentType: 'MPESA', member3Payment: '' });
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [teamMsg, setTeamMsg] = useState('');
  const [teamSuccess, setTeamSuccess] = useState(false);
  // Time tracking state
  const [timeForm, setTimeForm] = React.useState({ projectId: '', hours: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [timeMsg, setTimeMsg] = React.useState('');
  const [timeOk, setTimeOk] = React.useState(false);
  const [timeLogs, setTimeLogs] = React.useState<any[]>([]);
  // Deployment log state
  const [deployForm, setDeployForm] = React.useState({ environment: 'PRODUCTION', service: '', version: '', notes: '' });
  const [deployMsg, setDeployMsg] = React.useState('');
  const [deployOk, setDeployOk] = React.useState(false);
  const [deployments, setDeployments] = React.useState<any[]>([]);

  const projects  = data.projects  || [];
  const teams     = data.teams     || [];
  const repos     = data.repos     || [];
  const commits   = data.commits   || [];
  const contracts = data.contracts || [];
  const notifs    = data.notifications || [];
  const s         = data.summary   || {};

  const teamContracts = contracts;
  const SEEN_KEY = `tst_seen_contracts_${user?.id || 'anon'}`;
  const [seenIds, setSeenIds] = React.useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } });
  const newContractCount = teamContracts.filter((c: any) => c.id && !seenIds.has(c.id)).length;
  React.useEffect(() => {
    if (section === 'contracts' && teamContracts.length > 0) {
      const allIds = teamContracts.map((c: any) => c.id).filter(Boolean);
      const updated = new Set([...seenIds, ...allIds]);
      setSeenIds(updated);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...updated])); } catch { /* ignore */ }
    }
    if (section === 'time-tracking' && timeLogs.length === 0) {
      import('../../shared/api/apiClient').then(({ apiClient }) =>
        apiClient.get('/api/v1/time-logs').then(r => setTimeLogs((r.data as any).data || r.data || [])).catch(() => {})
      );
    }
    if (section === 'deployments' && deployments.length === 0) {
      import('../../shared/api/apiClient').then(({ apiClient }) =>
        apiClient.get('/api/v1/deployments').then(r => setDeployments((r.data as any).data || r.data || [])).catch(() => {})
      );
    }
  }, [section, teamContracts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const role = user?.role || userProfile?.role || '';
  const isCTO = role === 'CTO';

  const ENG_NAV = [
    { id: 'overview',     label: 'Overview',        icon: I.overview },
    { id: 'projects',     label: 'Projects',        icon: I.projects, badge: (s as any).activeProjects },
    { id: 'teams',        label: 'Teams',           icon: I.teams },
    { id: 'developers',   label: 'Developers',      icon: I.code },
    { id: 'github',       label: 'GitHub',          icon: I.github },
    { id: 'time-tracking',label: 'Time Tracking',   icon: I.report },
    { id: 'deployments',  label: 'Deployment Log',  icon: I.assign },
    { id: 'contracts',    label: 'Contracts',       icon: I.contracts, badge: newContractCount || undefined },
    ...(isCTO || isTeamLeader ? [{ id: 'chat', label: 'Chat', icon: I.chat }] : []),
    { id: 'daily-report', label: 'Daily Report',    icon: I.report },
    ...(isCTO ? [{ id: 'assign-project', label: 'Assign Project', icon: I.assign }] : []),
  ];

  const portalUser = {
    name: user?.name || 'Developer',
    email: user?.email || '',
    role: isCTO ? 'CTO' : isTeamLeader ? 'Developer · Team Leader' : 'Developer',
  };

  return (
    <PortalLayout theme={theme} user={portalUser} navItems={ENG_NAV} activeSection={section} onSectionChange={setSection} onLogout={onLogout} notifications={notifs} onNotificationRead={async (id) => { try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.patch(`/api/v1/notifications/${id}/read`); refetch(['notifications']); } catch { /* silent */ } }} faqs={TECHNOLOGY_FAQS} portalName="Technology Portal — Engineering Operations">

      {section === 'overview' && (
        <div>
          <SectionHeader title="Engineering Operations & Delivery" subtitle="Department 3 — Developer teams, sprint tracking, project delivery" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Active Projects" value={(s as any).projects?.active ?? projects.filter((p: any) => projectDisplayStatus(p) === 'ACTIVE').length} icon={I.projects} color={theme.hex} />
            <StatCard label="Developer Teams" value={teams.length || '—'} icon={I.teams} color={theme.hex} />
            <StatCard label="Recent Commits" value={commits.length || '—'} icon={I.github} color={theme.hex} />
            <StatCard label="Open Contracts" value={teamContracts.length || '—'} icon={I.contracts} color={theme.hex} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">Recent Commits</h3>
              {commits.slice(0, 5).map((c: any, i: number) => (
                <div key={c.sha || i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <span className="font-mono text-xs text-indigo-600 flex-shrink-0">{(c.sha || 'abc1234').slice(0, 7)}</span>
                  <p className="text-xs text-gray-700 truncate flex-1">{c.message || 'Commit'}</p>
                </div>
              ))}
              {!commits.length && <p className="text-sm text-gray-400">No recent commits</p>}
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">Repositories</h3>
              {repos.slice(0, 5).map((r: any, i: number) => (
                <div key={r.id || i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div><p className="text-sm font-medium text-gray-800">{r.name || `repo-${i}`}</p><p className="text-xs text-gray-400">{r.language || 'TypeScript'}</p></div>
                  <div className="flex items-center gap-3 text-xs text-gray-500"><span>⭐ {r.stars || 0}</span><span>🔀 {r.openPRs || 0} PRs</span></div>
                </div>
              ))}
              {!repos.length && <p className="text-sm text-gray-400">No repositories linked</p>}
            </div>
          </div>
        </div>
      )}

      {section === 'projects' && (
        <div>
          <SectionHeader title="Project Tracking" subtitle="All active and completed development projects" />
          <DataTable
            columns={[
              { key: 'referenceNumber', label: 'Project', render: (v, r: any) => <div><p className="font-mono text-xs font-semibold text-gray-800">{v || '—'}</p>{r.clientName && <p className="text-xs text-gray-400 mt-0.5">{r.clientName}</p>}</div> },
              { key: 'status', label: 'Status', render: (_v, r) => <StatusBadge status={projectDisplayStatus(r)} /> },
              { key: 'progress', label: 'Progress', render: v => <div className="flex items-center gap-2"><div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v || 0}%`, backgroundColor: theme.hex }} /></div><span className="text-xs">{v || 0}%</span></div> },
              { key: 'teamName', label: 'Team', render: v => v ? <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{v}</span> : <span className="text-xs text-gray-400 italic">Unassigned</span> },
              { key: 'endDate', label: 'Due', render: v => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
            ]}
            rows={projects}
          />
        </div>
      )}

      {section === 'teams' && (
        <div>
          <SectionHeader title="Developer Teams" subtitle="Teams of 3 developers with a designated leader"
            action={isCTO ? <PortalButton color={theme.hex} onClick={() => setShowTeamForm(f => !f)}>{showTeamForm ? 'Cancel' : '+ Create Team'}</PortalButton> : undefined} />
          {isCTO && showTeamForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
              {teamMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${teamSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{teamMsg}</div>}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!teamForm.teamName.trim()) { setTeamMsg('Team name is required.'); setTeamSuccess(false); return; }
                setTeamSubmitting(true); setTeamMsg('');
                try {
                  const { apiClient } = await import('../../shared/api/apiClient');
                  const members = [
                    { name: teamForm.leaderName.trim(), email: teamForm.leaderEmail.trim(), isLeader: true, paymentType: teamForm.leaderPaymentType, paymentAccount: teamForm.leaderPayment.trim() },
                    { name: teamForm.member2Name.trim(), email: teamForm.member2Email.trim(), isLeader: false, paymentType: teamForm.member2PaymentType, paymentAccount: teamForm.member2Payment.trim() },
                    { name: teamForm.member3Name.trim(), email: teamForm.member3Email.trim(), isLeader: false, paymentType: teamForm.member3PaymentType, paymentAccount: teamForm.member3Payment.trim() },
                  ].filter(m => m.name || m.email);
                  await apiClient.post('/api/v1/organization/teams', { name: teamForm.teamName.trim(), githubOrg: teamForm.githubOrg.trim() || undefined, members: members.length > 0 ? members : undefined });
                  setTeamSuccess(true); setTeamMsg('✓ Team created!');
                  setTeamForm({ teamName: '', githubOrg: '', leaderName: '', leaderEmail: '', leaderPaymentType: 'MPESA', leaderPayment: '', member2Name: '', member2Email: '', member2PaymentType: 'MPESA', member2Payment: '', member3Name: '', member3Email: '', member3PaymentType: 'MPESA', member3Payment: '' });
                  setShowTeamForm(false); refetch(['teams']);
                } catch (err: any) { setTeamSuccess(false); setTeamMsg(err?.response?.data?.error || 'Failed to create team'); }
                finally { setTeamSubmitting(false); }
              }}>
                <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1.5">Team Name *</label><input type="text" required value={teamForm.teamName} onChange={e => setTeamForm(f => ({ ...f, teamName: e.target.value }))} placeholder="e.g. Jupiter Stack Team 1" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" /></div>
                {[{ nameKey: 'leaderName', emailKey: 'leaderEmail', payTypeKey: 'leaderPaymentType', payKey: 'leaderPayment', label: 'Team Leader' }, { nameKey: 'member2Name', emailKey: 'member2Email', payTypeKey: 'member2PaymentType', payKey: 'member2Payment', label: 'Member 2' }, { nameKey: 'member3Name', emailKey: 'member3Email', payTypeKey: 'member3PaymentType', payKey: 'member3Payment', label: 'Member 3' }].map(f => (
                  <div key={f.label} className="mb-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{f.label}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" value={(teamForm as any)[f.nameKey]} onChange={e => setTeamForm(p => ({ ...p, [f.nameKey]: e.target.value }))} placeholder="Full Name" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 bg-white" />
                      <input type="email" value={(teamForm as any)[f.emailKey]} onChange={e => setTeamForm(p => ({ ...p, [f.emailKey]: e.target.value }))} placeholder="Email" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 bg-white" />
                      <select value={(teamForm as any)[f.payTypeKey]} onChange={e => setTeamForm(p => ({ ...p, [f.payTypeKey]: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 bg-white"><option value="MPESA">M-Pesa</option><option value="BANK">Bank</option></select>
                      <input type="text" value={(teamForm as any)[f.payKey]} onChange={e => setTeamForm(p => ({ ...p, [f.payKey]: e.target.value }))} placeholder={(teamForm as any)[f.payTypeKey] === 'BANK' ? 'Bank Account' : 'M-Pesa Number'} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 bg-white" />
                    </div>
                  </div>
                ))}
                <PortalButton color={theme.hex} fullWidth disabled={teamSubmitting}>{teamSubmitting ? 'Creating…' : 'Create Team'}</PortalButton>
              </form>
            </div>
          )}
          <div className="space-y-6">
            {teams.map((t: any) => <TeamMembersTable key={t.id} team={t} themeHex={theme.hex} />)}
            {!teams.length && <p className="text-sm text-gray-400 text-center py-8">No teams created yet</p>}
          </div>
        </div>
      )}

      {section === 'developers' && (
        <div>
          <SectionHeader title="Developers" subtitle="All developers across all teams" />
          <div className="space-y-6">
            {teams.map((t: any) => <TeamMembersTable key={t.id} team={t} themeHex={theme.hex} />)}
            {!teams.length && <p className="text-sm text-gray-400 text-center py-8">No teams yet</p>}
          </div>
        </div>
      )}

      {section === 'github' && (
        <div>
          <SectionHeader title="GitHub Integration" subtitle="Repository activity and pull requests" />
          <DataTable
            columns={[{ key: 'name', label: 'Repository' }, { key: 'language', label: 'Language' }, { key: 'stars', label: '⭐ Stars' }, { key: 'openPRs', label: 'Open PRs' }, { key: 'lastCommit', label: 'Last Commit', render: v => v ? new Date(v).toLocaleDateString() : '—' }]}
            rows={repos}
          />
        </div>
      )}

      {section === 'contracts' && (
        <div>
          <SectionHeader title="Contracts" subtitle="Contracts assigned to developer teams by the CTO" />
          <div className="p-4 mb-6 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            ℹ️ Team leaders can download and sign contracts. Other team members have view-only access.
          </div>
          <DataTable
            columns={[
              { key: 'referenceNumber', label: 'Contract Ref', render: v => <span className="font-mono text-xs font-semibold text-gray-700">{v || '—'}</span> },
              { key: 'teamName', label: 'Team', render: v => v ? <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{v}</span> : <span className="text-xs text-gray-400 italic">Unassigned</span> },
              { key: 'content', label: 'Client', render: v => <span className="text-sm text-gray-700">{v?.clientName || v?.partyName || '—'}</span> },
              { key: 'status', label: 'Status', render: (_v, r) => <StatusBadge status={projectDisplayStatus(r)} /> },
              { key: 'createdAt', label: 'Created', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'id', label: 'Actions', render: (_v, row: any) => (
                <div className="flex gap-2">
                  <PortalButton size="sm" color={theme.hex} onClick={async () => {
                    try { const { apiClient } = await import('../../shared/api/apiClient'); const res = await apiClient.get(`/api/v1/contracts/${row.id}/download`); if (res.data?.downloadUrl) { window.open(res.data.downloadUrl, '_blank'); return; } } catch { /* fall through */ }
                    if (row.pdfUrl) window.open(row.pdfUrl, '_blank'); else alert('PDF not available yet. Contact your CTO.');
                  }}>Download</PortalButton>
                  {isTeamLeader && (
                    <PortalButton size="sm" variant="secondary" onClick={async () => {
                      const email = prompt('Enter signer email:'); const name = prompt('Enter signer name:');
                      if (!email || !name) return;
                      try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/contracts/${row.id}/signature-requests`, { signerEmail: email, signerName: name }); alert('Signature request sent!'); } catch (err: any) { alert(err?.response?.data?.error || 'Failed'); }
                    }}>Sign</PortalButton>
                  )}
                </div>
              )},
            ]}
            rows={teamContracts}
            emptyMessage="No contracts assigned yet."
          />
        </div>
      )}

      {section === 'time-tracking' && (
        <div>
          <SectionHeader title="Time Tracking" subtitle="Log hours against projects" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 max-w-2xl">
            <p className="font-semibold text-gray-800 mb-4">Log Time</p>
            {timeMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${timeOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{timeMsg}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project *</label>
                <select value={timeForm.projectId} onChange={e => setTimeForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                  <option value="">— Select project —</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.referenceNumber || p.id}{p.clientName ? ` · ${p.clientName}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours *</label>
                <input type="number" min={0.25} max={24} step={0.25} value={timeForm.hours} onChange={e => setTimeForm(f => ({ ...f, hours: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="e.g. 3.5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input type="date" value={timeForm.date} onChange={e => setTimeForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <input type="text" value={timeForm.description} onChange={e => setTimeForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" placeholder="What did you work on?" />
              </div>
            </div>
            <PortalButton color={theme.hex} onClick={async () => {
              if (!timeForm.projectId || !timeForm.hours) { setTimeOk(false); setTimeMsg('Project and hours are required.'); return; }
              try {
                const { apiClient } = await import('../../shared/api/apiClient');
                const res = await apiClient.post('/api/v1/time-logs', { ...timeForm, hours: parseFloat(timeForm.hours) });
                setTimeOk(true); setTimeMsg('Time logged!');
                setTimeLogs(prev => [res.data?.data || res.data, ...prev]);
                setTimeForm(f => ({ ...f, hours: '', description: '' }));
              } catch (err: any) { setTimeOk(false); setTimeMsg(err?.response?.data?.error || 'Failed'); }
            }}>Log Time</PortalButton>
          </div>
          <DataTable
            columns={[
              { key: 'projectName', label: 'Project', render: (v, r: any) => {
                const p = projects.find((pr: any) => pr.id === (r.projectId || r.project_id));
                return v || p?.referenceNumber || r.projectId || '—';
              }},
              { key: 'hours', label: 'Hours', render: v => v ? `${v}h` : '—' },
              { key: 'description', label: 'Description', render: v => v ? <span className="text-xs text-gray-600">{v}</span> : '—' },
              { key: 'date', label: 'Date', render: (v, r: any) => { const d = v || r.logDate; return d ? new Date(d).toLocaleDateString() : '—'; } },
              { key: 'userName', label: 'By', render: (v, r: any) => v || r.user_name || '—' },
            ]}
            rows={timeLogs}
            emptyMessage="No time logged yet"
          />
        </div>
      )}

      {section === 'deployments' && (
        <div>
          <SectionHeader title="Deployment Log" subtitle="Record deployments for this team" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 max-w-2xl">
            {deployMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${deployOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{deployMsg}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Service *</label>
                <input type="text" value={deployForm.service} onChange={e => setDeployForm(f => ({ ...f, service: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Version</label>
                <input type="text" value={deployForm.version} onChange={e => setDeployForm(f => ({ ...f, version: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Environment</label>
                <select value={deployForm.environment} onChange={e => setDeployForm(f => ({ ...f, environment: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                  {['PRODUCTION','STAGING','DEVELOPMENT'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input type="text" value={deployForm.notes} onChange={e => setDeployForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
              </div>
            </div>
            <PortalButton color={theme.hex} onClick={async () => {
              if (!deployForm.service.trim()) { setDeployOk(false); setDeployMsg('Service is required.'); return; }
              try {
                const { apiClient } = await import('../../shared/api/apiClient');
                const res = await apiClient.post('/api/v1/deployments', { ...deployForm, deployedBy: user?.name || user?.email });
                setDeployOk(true); setDeployMsg('Deployment logged!');
                setDeployments(prev => [res.data?.data || res.data, ...prev]);
                setDeployForm({ environment: 'PRODUCTION', service: '', version: '', notes: '' });
              } catch (err: any) { setDeployOk(false); setDeployMsg(err?.response?.data?.error || 'Failed'); }
            }}>Log Deployment</PortalButton>
          </div>
          <DataTable
            columns={[
              { key: 'service', label: 'Service' },
              { key: 'version', label: 'Version', render: v => v ? <span className="font-mono text-xs text-indigo-600">{v}</span> : '—' },
              { key: 'environment', label: 'Environment', render: v => <StatusBadge status={v || 'PRODUCTION'} /> },
              { key: 'deployedBy', label: 'Deployed By', render: (v, r: any) => v || r.deployed_by || '—' },
              { key: 'createdAt', label: 'When', render: v => v ? new Date(v).toLocaleString() : '—' },
            ]}
            rows={deployments}
            emptyMessage="No deployments logged yet"
          />
        </div>
      )}

      {section === 'chat' && <ChatSection user={user} isTeamLeader={isTeamLeader} userProfile={userProfile} />}
      {section === 'daily-report' && <div><SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" /><DailyReportForm themeHex={theme.hex} onSubmitted={() => refetch()} /></div>}

      {section === 'assign-project' && isCTO && (
        <div>
          <SectionHeader title="Assign Project to Dev Team" subtitle="CTO assigns projects to development teams" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg">
            {assignMsg && <div className={`p-3 rounded-xl text-sm mb-4 ${assignSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{assignMsg}</div>}
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Project ID *</label><input type="text" value={assignProjectId} onChange={e => setAssignProjectId(e.target.value)} placeholder="Project UUID" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Team ID *</label><input type="text" value={assignTeamId} onChange={e => setAssignTeamId(e.target.value)} placeholder="Team UUID" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" /></div>
              <PortalButton color={theme.hex} fullWidth disabled={assignSubmitting || !assignProjectId || !assignTeamId} onClick={async () => {
                setAssignSubmitting(true); setAssignMsg(''); setAssignSuccess(false);
                try { const { apiClient } = await import('../../shared/api/apiClient'); await apiClient.post(`/api/v1/projects/${assignProjectId}/assign-team`, { teamId: assignTeamId }); setAssignMsg('Project assigned!'); setAssignSuccess(true); setAssignProjectId(''); setAssignTeamId(''); }
                catch (err: any) { setAssignMsg(err?.response?.data?.error || 'Failed'); setAssignSuccess(false); }
                finally { setAssignSubmitting(false); }
              }}>{assignSubmitting ? 'Assigning…' : 'Assign Project'}</PortalButton>
            </div>
          </div>
        </div>
      )}

    </PortalLayout>
  );
}// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — RBA Router
// Same URL (gatewayvertex) — loads correct department dashboard per role/dept
// ═══════════════════════════════════════════════════════════════════════════════
export default function TechnologyPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, loading, refetch } = useMultiPortalData([
    { key: 'summary',      endpoint: '/api/v1/dashboard/metrics',    fallback: {} },
    { key: 'projects',     endpoint: '/api/v1/projects',             fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || r.projects || []) },
    { key: 'repos',        endpoint: '/api/v1/github/repos',         fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'commits',      endpoint: '/api/v1/github/commits',       fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'contributors', endpoint: '/api/v1/github/contributions', fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'teams',        endpoint: '/api/v1/organization/teams',   fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'contracts',    endpoint: '/api/v1/contracts/my-team',    fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.contracts || r.data || []) },
    { key: 'userProfile',  endpoint: '/api/v1/users/me',             fallback: {}, transform: (r: any) => r?.data ?? r ?? {} },
    { key: 'notifications',endpoint: '/api/v1/notifications',        fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r?.notifications || r?.data || []) },
    { key: 'achievements', endpoint: '/api/v1/achievements',         fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r?.data ?? r?.achievements ?? []) },
  ] as any, ['data:project:created', 'data:project:updated', 'data:notification:new', 'data:metrics:updated', 'data:contract:generated']);

  const userProfile = (data as any).userProfile || {};
  const isTeamLeader: boolean = userProfile.isTeamLeader === true || (user as any)?.isTeamLeader === true;

  // Determine department type from userProfile
  const deptType: string = userProfile.departmentType || userProfile.department_type || '';

  const handleLogout = () => { logout(); navigate('/login'); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading Technology Portal…</p>
        </div>
      </div>
    );
  }

  if (!user) { navigate('/login'); return null; }

  const role = user.role || '';
  const d = { ...(data as any), handleLogout };

  // ── DEVELOPER role → Engineering Operations & Delivery (Dept 3) ──────────────
  if (role === 'DEVELOPER') {
    return <EngineeringOperationsDashboard data={d} refetch={refetch} user={user} isTeamLeader={isTeamLeader} userProfile={userProfile} onLogout={handleLogout} />;
  }

  // ── CTO role → Engineering Operations & Delivery (manages all 3 depts but
  //    primary view is the delivery dashboard where they assign jobs) ────────────
  if (role === 'CTO') {
    return <EngineeringOperationsDashboard data={d} refetch={refetch} user={user} isTeamLeader={false} userProfile={userProfile} onLogout={handleLogout} />;
  }

  // ── TECH_STAFF → route by department type ───────────────────────────────
  if (deptType === 'TECHNOLOGY_INFRASTRUCTURE_SECURITY') {
    return <InfraSecurityDashboard data={d} refetch={refetch} user={user} onLogout={handleLogout} />;
  }

  if (deptType === 'SOFTWARE_ENGINEERING_PRODUCT_DEVELOPMENT') {
    return <SoftwareEngineeringDashboard data={d} refetch={refetch} user={user} onLogout={handleLogout} />;
  }

  // ── Fallback for TECH_STAFF without a department assigned yet ────────────
  // Show a department selector / generic overview
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: theme.hex + '15' }}>
          <svg className="w-7 h-7" style={{ color: theme.hex }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Technology Portal</h2>
        <p className="text-sm text-gray-500 mb-6">Your account has not been assigned to a CTO department yet. Please contact your CTO to be assigned to one of the three departments.</p>
        <div className="space-y-3 text-left">
          {[
            { name: 'Technology Infrastructure & Security', desc: 'System security, infrastructure, risk management' },
            { name: 'Software Engineering & Product Development', desc: 'Applications, features, UI/UX, QA, roadmap' },
            { name: 'Engineering Operations & Delivery', desc: 'Developer teams, sprint tracking, project delivery' },
          ].map(dept => (
            <div key={dept.name} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
              <p className="text-sm font-semibold text-gray-800">{dept.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{dept.desc}</p>
            </div>
          ))}
        </div>
        <button onClick={handleLogout} className="mt-6 text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
      </div>
    </div>
  );
}
