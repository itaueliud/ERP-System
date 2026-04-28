import React, { useState } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';
import { apiClient } from '../../shared/api/apiClient';
import { TSTEmblem } from '../../shared/components/TSTLogo';
import { projectDisplayStatus } from '../../shared/utils/projectStatus';
import ChatPanel from '../../shared/components/chat/ChatPanel';
import { FAQPanel } from '../../shared/components/layout/FAQPanel';
import { CEO_FAQS } from '../../shared/data/portalFAQs';
import PlotConnectProperties from '../../shared/components/plotconnect/PlotConnectProperties';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  navy:    '#0f172a',
  navy2:   '#1e293b',
  blue:    '#1d4ed8',
  blue2:   '#2563eb',
  blueL:   '#eff6ff',
  green:   '#16a34a',
  greenL:  '#f0fdf4',
  amber:   '#d97706',
  amberL:  '#fffbeb',
  red:     '#dc2626',
  redL:    '#fef2f2',
  purple:  '#7c3aed',
  purpleL: '#f5f3ff',
  border:  '#e2e8f0',
  bg:      '#f8fafc',
  text:    '#0f172a',
  muted:   '#64748b',
  white:   '#ffffff',
};

// ─── Shared primitives ────────────────────────────────────────────────────────
const card = 'bg-white rounded-2xl border border-slate-100 shadow-sm';
const inp  = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all';
const lbl  = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

// ─── Date helpers ─────────────────────────────────────────────────────────────
/**
 * Format a DATE-only value (report_date) without timezone shifting.
 * Postgres DATE columns come back as midnight UTC — slicing the ISO string
 * avoids the browser converting midnight UTC to the previous day in UTC+ zones.
 */
function fmtDate(v: any, opts?: Intl.DateTimeFormatOptions): string {
  if (!v) return '—';
  // If it's already a plain date string like "2026-04-23" use it directly
  const iso = typeof v === 'string' ? v : (v instanceof Date ? v.toISOString() : String(v));
  const datePart = iso.slice(0, 10); // "YYYY-MM-DD"
  const [year, month, day] = datePart.split('-').map(Number);
  const local = new Date(year, month - 1, day); // local midnight — no UTC shift
  return local.toLocaleDateString('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format a TIMESTAMP WITH TIME ZONE value (submitted_at, created_at).
 * These are real instants — let the browser convert to local time normally.
 */
function fmtDateTime(v: any, opts?: Intl.DateTimeFormatOptions): string {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  overview:  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  finance:   <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  sales:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  ops:       <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  people:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  contracts: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  approvals: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  reports:   <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  notif:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  admin:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  logout:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  trend_up:  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>,
  trend_dn:  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>,
  check:     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>,
  x:         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>,
  plus:      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>,
  eye:       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  dollar:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  users2:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  globe:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  shield:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  chat:      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
};

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { id: 'overview',   label: 'Overview',       icon: Ic.overview },
      { id: 'finance',    label: 'Finance',         icon: Ic.finance },
      { id: 'sales',      label: 'Sales & Leads',   icon: Ic.sales },
      { id: 'operations', label: 'Operations',      icon: Ic.ops },
    ],
  },
  {
    label: 'Management',
    items: [
      { id: 'people',     label: 'People',          icon: Ic.people },
      { id: 'contracts',  label: 'Contracts',       icon: Ic.contracts },
      { id: 'approvals',  label: 'Approvals',       icon: Ic.approvals },
      { id: 'reports',    label: 'Reports',         icon: Ic.reports },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'chat',          label: 'Chat',           icon: Ic.chat },
      { id: 'notifications', label: 'Notifications',  icon: Ic.notif },
      { id: 'admin',         label: 'Control Panel',  icon: Ic.admin },
    ],
  },
];

const ALL_ROLES = ['CEO','CoS','CFO','COO','CTO','EA','HEAD_OF_TRAINERS','TRAINER','AGENT','OPERATIONS_USER','TECH_STAFF','DEVELOPER','CFO_ASSISTANT'];
const CEO_INVITABLE_ROLES = ['CoS','CFO','COO','CTO','EA'];

// ─── Small reusable components ────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const s = (status || '').toUpperCase();
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    ACTIVE:           { bg: C.greenL,  text: C.green,  dot: C.green },
    COMPLETED:        { bg: C.greenL,  text: C.green,  dot: C.green },
    APPROVED:         { bg: C.greenL,  text: C.green,  dot: C.green },
    EXECUTED:         { bg: C.greenL,  text: C.green,  dot: C.green },
    CLOSED_WON:       { bg: C.greenL,  text: C.green,  dot: C.green },
    PENDING:          { bg: C.amberL,  text: C.amber,  dot: C.amber },
    PENDING_APPROVAL: { bg: C.amberL,  text: C.amber,  dot: C.amber },
    IN_PROGRESS:      { bg: C.blueL,   text: C.blue2,  dot: C.blue2 },
    DRAFT:            { bg: '#f1f5f9', text: C.muted,  dot: C.muted },
    REJECTED:         { bg: C.redL,    text: C.red,    dot: C.red },
    SUSPENDED:        { bg: C.redL,    text: C.red,    dot: C.red },
    FAILED:           { bg: C.redL,    text: C.red,    dot: C.red },
    NEW_LEAD:         { bg: C.purpleL, text: C.purple, dot: C.purple },
    LEAD_QUALIFIED:   { bg: C.blueL,   text: C.blue2,  dot: C.blue2 },
    LEAD_ACTIVATED:   { bg: C.blueL,   text: C.blue2,  dot: C.blue2 },
  };
  const style = map[s] || { bg: '#f1f5f9', text: C.muted, dot: C.muted };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: style.bg, color: style.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
      {s.replace(/_/g, ' ')}
    </span>
  );
}

function KpiCard({ label, value, sub, color, icon, trend }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ReactNode; trend?: { up: boolean; val: string };
}) {
  return (
    <div className={`${card} p-5 flex flex-col gap-4`}>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
          style={{ background: color }}>
          {icon}
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
            style={{ background: trend.up ? C.greenL : C.redL, color: trend.up ? C.green : C.red }}>
            {trend.up ? Ic.trend_up : Ic.trend_dn} {trend.val}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-sm font-medium text-slate-500 mt-1">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, icon }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md'; disabled?: boolean; icon?: React.ReactNode;
}) {
  const base = 'inline-flex items-center gap-1.5 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const sz   = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm';
  const v: Record<string, string> = {
    primary:   `text-white hover:opacity-90 active:scale-[0.97]`,
    secondary: `bg-slate-100 text-slate-700 hover:bg-slate-200`,
    danger:    `bg-red-50 text-red-600 hover:bg-red-100`,
    ghost:     `text-slate-600 hover:bg-slate-100`,
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${sz} ${v[variant]}`}
      style={variant === 'primary' ? { background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blue2} 100%)` } : {}}>
      {icon}{children}
    </button>
  );
}

function Table({ cols, rows, empty = 'No data' }: {
  cols: { key: string; label: string; render?: (v: any, r: any) => React.ReactNode }[];
  rows: any[]; empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100" style={{ background: '#f8fafc' }}>
            {cols.map(c => (
              <th key={c.key} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-slate-400 text-sm">{empty}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={row.id || i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
              {cols.map(c => (
                <td key={c.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ section, setSection, pendingCount, user, onLogout, mobileOpen, onMobileClose }: {
  section: string; setSection: (s: string) => void;
  pendingCount: number; user: any; onLogout: () => void;
  mobileOpen?: boolean; onMobileClose?: () => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
      )}
      <aside className={`fixed lg:relative z-50 lg:z-auto w-60 flex-shrink-0 flex flex-col h-full lg:h-screen lg:sticky lg:top-0 overflow-y-auto transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      style={{ background: C.navy, borderRight: `1px solid rgba(255,255,255,0.06)` }}>

      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <TSTEmblem size={32} />
        <div>
          <p className="text-white font-bold text-sm leading-tight">TechSwiftTrix</p>
          <p className="text-slate-400 text-xs">CEO Portal</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = section === item.id;
                const badge = item.id === 'approvals' ? pendingCount : 0;
                return (
                  <button key={item.id} onClick={() => setSection(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={active
                      ? { background: C.blue2, color: '#fff' }
                      : { color: '#94a3b8' }
                    }
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; } }}>
                    <span className="flex-shrink-0 opacity-90">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {badge > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                        style={{ background: item.id === 'admin' ? C.blue2 : '#ef4444', color: '#fff' }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: C.blue2 }}>
            {(user?.name || 'C').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.name || 'CEO'}</p>
            <p className="text-slate-500 text-[10px] truncate">{user?.email || ''}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
          {Ic.logout} Sign out
        </button>
      </div>
      </aside>
    </>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ section, onFaqOpen, onMenuToggle }: { section: string; onFaqOpen: () => void; onMenuToggle?: () => void }) {
  const titles: Record<string, string> = {
    overview: 'Overview', finance: 'Finance', sales: 'Sales & Leads',
    operations: 'Operations', people: 'People', contracts: 'Contracts',
    approvals: 'Approvals Queue', reports: 'Reports',
    chat: 'Chat', notifications: 'Notifications', admin: 'Control Panel',
  };
  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 bg-white border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <button onClick={onMenuToggle} className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors mr-1" aria-label="Open menu">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-slate-900">{titles[section] || section}</h1>
        {section === 'admin' && (
          <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: C.blue2 }}>
            CEO EXCLUSIVE
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 lg:gap-3">
        <span className="hidden sm:block text-xs text-slate-400">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        {/* Help / FAQ button */}
        <button
          onClick={onFaqOpen}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Help & FAQ"
          title="Help & FAQ"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

// ─── Section: Overview ────────────────────────────────────────────────────────
function OverviewSection({ data }: { data: any }) {
  const m = data.metrics || {};
  const clients = data.clients || [];
  const projects = data.projects || [];
  const pending = (Array.isArray(data.paymentApprovals) ? data.paymentApprovals : []).filter((p: any) => p.status === 'PENDING_APPROVAL');
  const auditLog = (data.auditLog || []).slice(0, 6);

  // Map nested CompanyMetrics structure to flat values
  const today = new Date(); today.setHours(0,0,0,0);
  const totalRevenue   = m.revenue?.total       ?? m.totalRevenue    ?? 0;
  const activeClients  = m.clients?.total        ?? m.activeClients   ?? clients.length;
  // Closed deals = projects whose end_date has passed
  const closedDeals    = m.projects?.completed   ?? m.closedDeals
    ?? projects.filter((p: any) => p.endDate && new Date(p.endDate) < today).length;
  // Active projects = start_date <= today <= end_date (or no end_date)
  const activeProjects = m.projects?.active      ?? m.activeProjects
    ?? projects.filter((p: any) => projectDisplayStatus(p) === 'ACTIVE').length;
  const totalLeads = (m.clients?.leads ?? 0) + (m.clients?.qualifiedLeads ?? 0)
    || m.totalLeads
    || clients.filter((c: any) => !['CLOSED_WON'].includes(c.status)).length
    || 0;

  // Pending approvals = payment approvals + tech funding requests + service amount changes
  const pendingPayments  = pending.length;
  const pendingTech      = (Array.isArray(data.techRequests) ? data.techRequests : []).filter((t: any) => t.status === 'PENDING').length;
  const pendingService   = (Array.isArray(data.serviceApprovals) ? data.serviceApprovals : []).filter((a: any) => a.status === 'PENDING' || a.status === 'PENDING_APPROVAL').length;
  const pendingApprovals = pendingPayments + pendingTech + pendingService;

  const kpis = [
    { label: 'Total Revenue',    value: totalRevenue    ? `KSh ${(totalRevenue/1e6).toFixed(2)}M`  : '—', color: C.blue2,   icon: Ic.dollar,   trend: undefined },
    { label: 'Active Clients',   value: activeClients,                                                     color: C.green,   icon: Ic.people,   trend: undefined },
    { label: 'Closed Deals',     value: closedDeals,                                                       color: C.purple,  icon: Ic.sales,    trend: undefined },
    { label: 'Active Projects',  value: activeProjects,                                                    color: C.amber,   icon: Ic.ops,      trend: undefined },
    { label: 'Pending Approvals',value: pendingApprovals,                                                  color: '#e11d48', icon: Ic.approvals, trend: undefined },
    { label: 'Total Leads',      value: totalLeads,                                                        color: '#0891b2', icon: Ic.globe,    trend: undefined },
  ];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} sub={undefined} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Revenue by platform */}
        <div className={`${card} p-5 xl:col-span-2`}>
          <SectionTitle title="Revenue by Platform" sub="All-time totals" />
          <div className="space-y-3">
            {[
              { name: 'TST PlotConnect',    key: 'plotconnectRevenue',  color: C.blue2  },
              { name: 'CashFlow Connect',   key: 'cashflowRevenue',     color: C.green  },
              { name: 'TST Billing System', key: 'billingRevenue',      color: C.purple },
            ].map(p => {
              const val = m[p.key] || 0;
              const total = (m.plotconnectRevenue || 0) + (m.cashflowRevenue || 0) + (m.billingRevenue || 0) || 1;
              const pct = Math.round((val / total) * 100);
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700">{p.name}</span>
                    <span className="text-sm font-bold text-slate-900">KSh {(val / 1e6).toFixed(2)}M</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: p.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent audit */}
        <div className={`${card} p-5`}>
          <SectionTitle title="Recent Activity" sub="Last 6 actions" />
          <div className="space-y-2.5">
            {auditLog.length === 0 && <p className="text-sm text-slate-400">No activity yet</p>}
            {auditLog.map((a: any, i: number) => (
              <div key={a.id || i} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: a.result === 'SUCCESS' ? C.greenL : C.redL }}>
                  <span style={{ color: a.result === 'SUCCESS' ? C.green : C.red, fontSize: 10 }}>
                    {a.result === 'SUCCESS' ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{a.action || 'Action'}</p>
                  <p className="text-[10px] text-slate-400">{a.createdAt ? new Date(a.createdAt).toLocaleTimeString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent clients */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="Recent Clients" sub="Latest leads and conversions" />
        </div>
        <Table
          cols={[
            { key: 'name',             label: 'Client' },
            { key: 'industryCategory', label: 'Industry', render: v => v || '—' },
            { key: 'country',          label: 'Country' },
            { key: 'status',           label: 'Status',  render: v => <Badge status={v || 'NEW_LEAD'} /> },
            { key: 'createdAt',        label: 'Added',   render: v => v ? new Date(v).toLocaleDateString() : '—' },
          ]}
          rows={clients.slice(0, 8)}
          empty="No clients yet"
        />
      </div>
    </div>
  );
}

// ─── Section: Finance ─────────────────────────────────────────────────────────
function FinanceSection({ data }: { data: any }) {
  const m = data.metrics || {};
  const payments = Array.isArray(data.paymentApprovals) ? data.paymentApprovals : [];
  const amounts  = data.serviceAmounts   || [];
  const [tab, setTab] = useState<'payments' | 'amounts'>('payments');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue',    value: m.totalRevenue    ? `KSh ${(m.totalRevenue/1e6).toFixed(1)}M`    : '—', color: C.blue2  },
          { label: 'Daily Cash Flow',  value: m.dailyCashFlow   ? `KSh ${(m.dailyCashFlow/1e3).toFixed(0)}K`   : '—', color: C.green  },
          { label: 'Pending Payments', value: payments.filter((p: any) => p.status === 'PENDING_APPROVAL').length, color: C.amber },
          { label: 'Tax Status',       value: m.taxFilingStatus || 'Up to date',                                      color: C.purple },
        ].map(k => <KpiCard key={k.label} {...k} icon={Ic.dollar} />)}
      </div>

      {/* Tab switcher */}
      <div className={card}>
        <div className="flex border-b border-slate-100">
          {(['payments', 'amounts'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px"
              style={tab === t
                ? { borderColor: C.blue2, color: C.blue2 }
                : { borderColor: 'transparent', color: C.muted }}>
              {t === 'payments' ? 'Payment Approvals' : 'Service Amounts'}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'payments' && (
            <Table
              cols={[
                { key: 'purpose',   label: 'Purpose' },
                { key: 'amount',    label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
                { key: 'status',    label: 'Status',       render: v => <Badge status={v || 'PENDING'} /> },
                { key: 'createdAt', label: 'Requested',    render: v => v ? new Date(v).toLocaleDateString() : '—' },
              ]}
              rows={payments}
              empty="No payment requests"
            />
          )}
          {tab === 'amounts' && (
            <Table
              cols={[
                { key: 'serviceName',    label: 'Service',      render: (v, r) => v || r.name || '—' },
                { key: 'category',       label: 'Category' },
                { key: 'currentAmount',  label: 'Amount (KSh)', render: (v, r) => ((v || r.amount || 0)).toLocaleString() },
                { key: 'status',         label: 'Status',       render: v => <Badge status={v || 'ACTIVE'} /> },
              ]}
              rows={amounts}
              empty="No service amounts configured"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Sales ───────────────────────────────────────────────────────────
function SalesSection({ data }: { data: any }) {
  const clients     = data.clients  || [];

  const byStatus = (s: string) => clients.filter((c: any) => c.status === s).length;

  return (
    <div className="space-y-5">
      {/* Pipeline funnel */}
      <div className={`${card} p-5`}>
        <SectionTitle title="Lead Pipeline" sub="Current status distribution" />
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'New Lead',       status: 'NEW_LEAD',       color: C.purple },
            { label: 'Converted',      status: 'CONVERTED',      color: C.blue2  },
            { label: 'Activated',      status: 'LEAD_ACTIVATED', color: '#0891b2' },
            { label: 'Qualified',      status: 'LEAD_QUALIFIED', color: C.amber  },
            { label: 'Negotiation',    status: 'NEGOTIATION',    color: '#ea580c' },
            { label: 'Closed Won',     status: 'CLOSED_WON',     color: C.green  },
          ].map(s => (
            <div key={s.status} className="rounded-xl p-3 text-center border border-slate-100"
              style={{ background: s.color + '10' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{byStatus(s.status)}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Clients table */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="All Clients" sub={`${clients.length} total`} />
        </div>
        <Table
          cols={[
            { key: 'name',             label: 'Client' },
            { key: 'phone',            label: 'Phone' },
            { key: 'country',          label: 'Country' },
            { key: 'industryCategory', label: 'Industry', render: v => v || '—' },
            { key: 'status',           label: 'Status',   render: v => <Badge status={v || 'NEW_LEAD'} /> },
            { key: 'createdAt',        label: 'Added',    render: v => v ? new Date(v).toLocaleDateString() : '—' },
          ]}
          rows={clients}
          empty="No clients yet"
        />
      </div>
    </div>
  );
}

// ─── PlotConnect Property Review ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PlotConnectReview({ properties, onRefetch }: { properties: any[]; onRefetch: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg,  setMsg]  = useState('');

  const updateStatus = async (id: string, status: string) => {
    setBusy(id + status); setMsg('');
    try {
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

  if (!properties.length) {
    return <p className="text-sm text-slate-400 py-6 text-center">No PlotConnect properties submitted yet.</p>;
  }

  return (
    <div className="space-y-3">
      {msg && <p className="text-sm px-3 py-2 rounded-lg bg-blue-50 text-blue-700">{msg}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
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
                <td className="px-4 py-3"><Badge status={p.status || 'PENDING'} /></td>
                <td className="px-4 py-3">
                  {p.status === 'PENDING' || p.status === 'REJECTED' ? (
                    <div className="flex gap-2">
                      <button
                        disabled={!!busy}
                        onClick={() => updateStatus(p.id, 'APPROVED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors">
                        {busy === p.id + 'APPROVED' ? '…' : 'Approve'}
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => updateStatus(p.id, 'REJECTED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 transition-colors">
                        {busy === p.id + 'REJECTED' ? '…' : 'Reject'}
                      </button>
                    </div>
                  ) : p.status === 'APPROVED' ? (
                    <div className="flex gap-2">
                      <button
                        disabled={!!busy}
                        onClick={() => updateStatus(p.id, 'PUBLISHED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
                        {busy === p.id + 'PUBLISHED' ? '…' : 'Publish'}
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => updateStatus(p.id, 'REJECTED')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 transition-colors">
                        {busy === p.id + 'REJECTED' ? '…' : 'Reject'}
                      </button>
                    </div>
                  ) : p.status === 'PUBLISHED' ? (
                    <button
                      disabled={!!busy}
                      onClick={() => updateStatus(p.id, 'UNPUBLISHED')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                      {busy === p.id + 'UNPUBLISHED' ? '…' : 'Unpublish'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Operations ──────────────────────────────────────────────────────
function OperationsSection({ data, refetch: _refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const projects   = data.projects   || [];
  const properties = data.properties || [];
  const repos      = data.repos      || [];
  const contracts  = data.contracts  || [];
  const m          = data.metrics    || {};
  const [tab, setTab] = useState<'projects' | 'plotconnect' | 'github'>('projects');
  const [viewProject, setViewProject] = useState<any | null>(null);

  const totalProjects  = m.projects?.total  ?? projects.length;
  const activeProjects = m.projects?.active ?? projects.filter((p: any) => projectDisplayStatus(p) === 'ACTIVE').length;
  const propertiesListed = properties.filter((p: any) => p.status === 'PUBLISHED' || p.status === 'AVAILABLE' || p.status === 'ACTIVE').length
    || (m.properties?.total ?? 0);

  // Find the latest contract for a project
  const contractFor = (projectId: string) =>
    contracts.find((c: any) => c.projectId === projectId || c.project_id === projectId);

  return (
    <div className="space-y-5">

      {/* Project / Contract detail modal */}
      {viewProject && (() => {
        const contract = contractFor(viewProject.id);
        const cc = contract?.content || {};
        const displayStatus = projectDisplayStatus(viewProject);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setViewProject(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between" style={{ background: C.blueL }}>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{viewProject.referenceNumber || 'Project'}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Project &amp; Contract Details</p>
                </div>
                <button onClick={() => setViewProject(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Project info */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  {[
                    { label: 'Client',          value: viewProject.clientName || cc.clientName || cc.partyName || '—' },
                    { label: 'Status',          value: <Badge status={displayStatus} /> },
                    { label: 'Service Amount',  value: viewProject.serviceAmount ? `${viewProject.currency || 'KSh'} ${Number(viewProject.serviceAmount).toLocaleString()}` : (cc.serviceAmount ? `${cc.currency || 'KSh'} ${Number(cc.serviceAmount).toLocaleString()}` : '—') },
                    { label: 'Currency',        value: viewProject.currency || cc.currency || '—' },
                    { label: 'Start Date',      value: viewProject.startDate ? new Date(viewProject.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                    { label: 'End Date',        value: viewProject.endDate   ? new Date(viewProject.endDate).toLocaleDateString('en-GB',   { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{f.label}</p>
                      <div className="text-sm font-medium text-slate-700 mt-0.5">{f.value}</div>
                    </div>
                  ))}
                </div>

                {/* Service description */}
                {(cc.serviceDescription || viewProject.serviceDescription) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Service Description</p>
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 leading-relaxed">{cc.serviceDescription || viewProject.serviceDescription}</p>
                  </div>
                )}

                {/* Contract info */}
                {contract && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Contract</p>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-3">
                      {[
                        { label: 'Contract Ref',   value: contract.referenceNumber || '—' },
                        { label: 'Version',        value: contract.version ? `v${contract.version}` : '—' },
                        { label: 'Status',         value: <Badge status={contract.status || 'DRAFT'} /> },
                        { label: 'Payment Plan',   value: cc.paymentPlan || '—' },
                        { label: 'Client Email',   value: cc.clientEmail || '—' },
                        { label: 'Client Phone',   value: cc.clientPhone || '—' },
                      ].map(f => (
                        <div key={f.label}>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{f.label}</p>
                          <div className="text-sm font-medium text-slate-700 mt-0.5">{f.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-2">
                {contract?.pdfUrl && (
                  <a href={contract.pdfUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-all hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blue2} 100%)` }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Download PDF
                  </a>
                )}
                <Btn variant="secondary" onClick={() => setViewProject(null)}>Close</Btn>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Projects',    value: totalProjects,    color: C.blue2  },
          { label: 'Active Projects',   value: activeProjects,   color: C.green  },
          { label: 'Properties Listed', value: propertiesListed, color: C.purple },
          { label: 'GitHub Repos',      value: repos.length,     color: C.navy2  },
        ].map(k => <KpiCard key={k.label} {...k} icon={Ic.ops} />)}
      </div>

      <div className={card}>
        <div className="flex border-b border-slate-100">
          {(['projects', 'plotconnect', 'github'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px capitalize"
              style={tab === t ? { borderColor: C.blue2, color: C.blue2 } : { borderColor: 'transparent', color: C.muted }}>
              {t === 'github' ? 'GitHub' : t === 'plotconnect' ? 'PlotConnect' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'projects' && (
            <Table
              cols={[
                { key: 'referenceNumber', label: 'Ref #' },
                { key: 'clientId',        label: 'Client',   render: (v, r) => r.clientName || v || '—' },
                { key: 'serviceAmount',   label: 'Amount',   render: v => v ? `KSh ${Number(v).toLocaleString()}` : '—' },
                { key: 'status',          label: 'Status',   render: (_v, r) => <Badge status={projectDisplayStatus(r)} /> },
                { key: 'startDate',       label: 'Start',    render: v => v ? new Date(v).toLocaleDateString() : '—' },
                { key: 'id',              label: '',         render: (_v, r) => (
                  <Btn size="sm" variant="secondary" icon={Ic.eye} onClick={() => setViewProject(r)}>View</Btn>
                )},
              ]}
              rows={projects}
              empty="No projects yet"
            />
          )}
          {tab === 'github' && (
            <Table
              cols={[
                { key: 'name',      label: 'Repository' },
                { key: 'fullName',  label: 'Full Name' },
                { key: 'url',       label: 'URL', render: v => v ? <a href={v} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">{v.replace('https://github.com/', '')}</a> : '—' },
                { key: 'lastSynced', label: 'Last Sync', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              ]}
              rows={repos}
              empty="No repositories linked"
            />
          )}
          {tab === 'plotconnect' && (
            <PlotConnectProperties
              themeHex={C.blue2}
              canApprove
              canPublish
              showAgent
              showRevenue
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section: People ──────────────────────────────────────────────────────────
function PeopleSection({ data, refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const users = data.users || [];
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('CoS');
  const [msg,  setMsg]  = useState('');
  const [ok,   setOk]   = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setBusy(true); setMsg('');
    try {
      const rolesRes = await apiClient.get('/api/v1/users/roles');
      const roles: any[] = rolesRes.data?.data || [];
      const roleObj = roles.find((r: any) => r.name === inviteRole);
      if (!roleObj) { setMsg(`Role "${inviteRole}" not found.`); setOk(false); setBusy(false); return; }
      await apiClient.post('/api/v1/users/invite', { email: inviteEmail, roleId: roleObj.id });
      setMsg(`Invitation sent to ${inviteEmail}`); setOk(true); setInviteEmail(''); refetch(['users']);
    } catch (e: any) { setMsg(e?.response?.data?.error || 'Failed to send invitation.'); setOk(false); }
    finally { setBusy(false); }
  };

  const filtered = users.filter((u: any) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (u.fullName || u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Invite card */}
      <div className={`${card} p-5`}>
        <SectionTitle title="Invite New User" sub="CEO can invite C-level accounts only" />
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className={lbl}>Email address</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="user@tst.com" className={inp} />
          </div>
          <div className="w-40">
            <label className={lbl}>Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={inp}>
              {CEO_INVITABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Btn onClick={handleInvite} disabled={busy || !inviteEmail} icon={Ic.plus}>
            {busy ? 'Sending…' : 'Send Invite'}
          </Btn>
        </div>
        {msg && (
          <div className={`mt-3 flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {ok ? Ic.check : Ic.x} {msg}
          </div>
        )}
      </div>

      {/* Users table */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">All Users</h2>
            <p className="text-sm text-slate-500">{users.length} accounts in system</p>
          </div>
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search name, email, role…"
            className="w-56 px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
        </div>
        <Table
          cols={[
            { key: 'fullName',  label: 'Name',   render: (v, r) => v || r.name || '—' },
            { key: 'email',     label: 'Email' },
            { key: 'role',      label: 'Role',   render: (v, r) => v || r.roleName || '—' },
            { key: 'country',   label: 'Country' },
            { key: 'isActive',  label: 'Status', render: v => <Badge status={v === false ? 'SUSPENDED' : 'ACTIVE'} /> },
            { key: 'createdAt', label: 'Joined', render: v => v ? new Date(v).toLocaleDateString() : '—' },
          ]}
          rows={filtered}
          empty="No users found"
        />
      </div>
    </div>
  );
}

// ─── Section: Contracts ───────────────────────────────────────────────────────
function ContractsSection({ data, refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const [contracts, setContracts] = React.useState<any[]>(Array.isArray(data.contracts) ? data.contracts : []);
  const lastRefetchedRef = React.useRef<any[]>([]);

  // Sync from parent only when the refetch brings back new data from the server
  React.useEffect(() => {
    const incoming = Array.isArray(data.contracts) ? data.contracts : [];
    // Only overwrite local state if the server returned data that differs from
    // what we last saw — this prevents the optimistic update from being wiped
    if (incoming !== lastRefetchedRef.current) {
      lastRefetchedRef.current = incoming;
      // Merge: keep any locally-added items that aren't in the server response yet
      setContracts(prev => {
        const serverIds = new Set(incoming.map((c: any) => c.id));
        const localOnly = prev.filter(c => !serverIds.has(c.id));
        return [...localOnly, ...incoming];
      });
    }
  }, [data.contracts]);
  const projects  = Array.isArray(data.projects)  ? data.projects  : [];
  const clients   = Array.isArray(data.clients)   ? data.clients   : [];
  const teams     = Array.isArray(data.teams)     ? data.teams     : [];

  const BLANK = {
    contractType: 'CLIENT_SYSTEM',
    projectId: '',
    // Party
    clientName: '', clientEmail: '', clientPhone: '',
    clientAddress: '', clientIdNumber: '', clientOrganization: '',
    // Service
    serviceDescription: '', industryCategory: '',
    startDate: '', deliveryDate: '',
    // PlotConnect
    propertyName: '', propertyLocation: '', placementTier: '',
    // Developer
    developerTeamId: '', developerTeam: '', assignedProject: '',
    // Financial
    serviceAmount: '', currency: 'KES', paymentPlan: 'Full Payment',
    commitmentAmount: '', transactionId: '', paymentDate: '',
  };

  const [form,        setForm]        = useState(BLANK);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [msg,         setMsg]         = useState('');
  const [ok,          setOk]          = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [dlUrl,       setDlUrl]       = useState('');
  const [dlBusy,      setDlBusy]      = useState<string | null>(null);
  const [tab,         setTab]         = useState<'generate' | 'list'>('generate');

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-fill developer/team details when a team is selected
  const autoFillTeam = async (teamId: string) => {
    const team = teams.find((t: any) => t.id === teamId);
    if (!team) { setTeamMembers([]); return; }
    setForm(f => ({ ...f, developerTeamId: teamId, developerTeam: team.name, clientOrganization: 'TechSwiftTrix' }));
    try {
      const { apiClient: api } = await import('../../shared/api/apiClient');
      const res = await api.get(`/api/v1/organization/teams/${teamId}/members`);
      const members: any[] = Array.isArray((res.data as any)?.data) ? (res.data as any).data : [];
      setTeamMembers(members);
      const leader = members.find((m: any) => m.isTeamLeader) || members[0];
      if (leader) {
        setForm(f => ({
          ...f,
          clientName:    leader.fullName || f.clientName,
          clientEmail:   leader.email    || f.clientEmail,
          clientAddress: leader.country  || f.clientAddress,
        }));
      }
    } catch { setTeamMembers([]); }
  };

  const autoFillClient = (clientId: string) => {
    const c = clients.find((x: any) => x.id === clientId);
    if (!c) return;
    setForm(f => ({
      ...f,
      clientName:          c.name                || f.clientName,
      clientEmail:         c.email               || f.clientEmail,
      clientPhone:         c.phone               || f.clientPhone,
      clientAddress:       c.country             || f.clientAddress,
      clientOrganization:  c.organizationName    || f.clientOrganization,
      serviceDescription:  c.serviceDescription  || f.serviceDescription,
      industryCategory:    c.industryCategory    || f.industryCategory,
      // Also pre-fill estimated value if available
      serviceAmount:       c.estimatedValue ? String(c.estimatedValue) : f.serviceAmount,
    }));
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim())        { setMsg('Client name is required.');        setOk(false); return; }
    if (!form.serviceDescription.trim()){ setMsg('Service description is required.'); setOk(false); return; }
    if (!form.serviceAmount)            { setMsg('Service amount is required.');      setOk(false); return; }
    setBusy(true); setMsg(''); setDlUrl('');
    try {
      const payload: Record<string, any> = {
        contractType:       form.contractType,
        clientName:         form.clientName.trim(),
        clientEmail:        form.clientEmail.trim()        || undefined,
        clientPhone:        form.clientPhone.trim()        || undefined,
        clientAddress:      form.clientAddress.trim()      || undefined,
        clientIdNumber:     form.clientIdNumber.trim()     || undefined,
        clientOrganization: form.clientOrganization.trim() || undefined,
        serviceDescription: form.serviceDescription.trim(),
        industryCategory:   form.industryCategory          || undefined,
        serviceAmount:      parseFloat(form.serviceAmount),
        currency:           form.currency,
        paymentPlan:        form.paymentPlan,
        commitmentAmount:   form.commitmentAmount ? parseFloat(form.commitmentAmount) : undefined,
        transactionId:      form.transactionId.trim()  || undefined,
        paymentDate:        form.paymentDate           || undefined,
        startDate:          form.startDate             || undefined,
        deliveryDate:       form.deliveryDate          || undefined,
        propertyName:       form.propertyName.trim()   || undefined,
        propertyLocation:   form.propertyLocation.trim()|| undefined,
        placementTier:      form.placementTier         || undefined,
        developerTeam:      form.developerTeam.trim()  || undefined,
        assignedProject:    form.assignedProject.trim()|| undefined,
      };
      if (form.projectId) payload.projectId = form.projectId;

      const res = await apiClient.post('/api/v1/contracts/generate-direct', payload);
      const d = res.data as any;
      setMsg(`Contract ${d.referenceNumber} generated successfully!`);
      setOk(true);
      if (d.pdfDataUrl || d.pdfUrl) setDlUrl(d.pdfDataUrl || d.pdfUrl);
      // Optimistic update — show immediately in the list
      setContracts(prev => {
        const exists = prev.some(c => c.id === d.id);
        return exists ? prev : [d, ...prev];
      });
      setForm(BLANK);
      setTab('list');
      // Refetch contracts + metrics so dashboard updates immediately
      refetch(['contracts', 'metrics']);
    } catch (err: any) {
      setMsg(err?.response?.data?.error || 'Failed to generate contract.');
      setOk(false);
    } finally { setBusy(false); }
  };

  const download = async (id: string, storedUrl?: string) => {
    // Helper: convert base64 data URL → Blob URL and open it
    const openDataUrl = (dataUrl: string) => {
      try {
        const [header, b64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'application/pdf';
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } catch {
        // fallback
        window.open(dataUrl, '_blank');
      }
    };

    if (storedUrl?.startsWith('data:')) {
      openDataUrl(storedUrl);
      return;
    }
    if (storedUrl?.startsWith('http')) {
      window.open(storedUrl, '_blank');
      return;
    }

    // Need to fetch from backend
    const tab = window.open('', '_blank');
    setDlBusy(id);
    try {
      const res = await apiClient.get(`/api/v1/contracts/${id}/download`);
      const url: string = (res.data as any)?.downloadUrl || (res.data as any)?.pdfDataUrl || '';
      if (url.startsWith('data:')) {
        tab?.close();
        openDataUrl(url);
      } else if (url) {
        if (tab) tab.location.href = url;
        else window.open(url, '_blank');
      } else {
        tab?.close();
      }
    } catch {
      tab?.close();
    } finally {
      setDlBusy(null);
    }
  };

  const TYPES = [
    { v: 'CLIENT_SYSTEM',      l: 'Software Services' },
    { v: 'CLIENT_PLOTCONNECT', l: 'TST PlotConnect' },
    { v: 'DEVELOPER',          l: 'Developer / Team' },
  ];
  const INDUSTRIES = ['SCHOOLS','CHURCHES','HOTELS','HOSPITALS','COMPANIES','REAL_ESTATE','SHOPS'];
  const CURRENCIES = ['KES','UGX','TZS','RWF','ETB','GHS','NGN','ZAR','USD','EUR','GBP'];
  const PLANS = ['Full Payment','50% Deposit + 50% on Delivery','Milestone Plan (40-20-20-20)'];
  const TIERS = ['Top Placement','Medium Placement','Basic Placement'];

  return (
    <div className="space-y-5">
      <div className={card}>
        {/* Tab bar */}
        <div className="flex border-b border-slate-100">
          {(['generate', 'list'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px"
              style={tab === t
                ? { borderColor: C.blue2, color: C.blue2 }
                : { borderColor: 'transparent', color: C.muted }}>
              {t === 'generate' ? '+ Generate Contract' : `All Contracts (${contracts.length})`}
            </button>
          ))}
        </div>

        {/* ── Generate form ── */}
        {tab === 'generate' && (
          <div className="p-6">
            {msg && (
              <div className={`flex items-center gap-3 text-sm px-4 py-3.5 rounded-2xl mb-6 ${ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500'}`}>
                  {ok
                    ? <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    : <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                  }
                </span>
                <span className="flex-1 font-medium">{msg}</span>
                {ok && dlUrl && (
                  <button type="button" onClick={() => download('', dlUrl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white border-none cursor-pointer hover:bg-green-700 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Download PDF
                  </button>
                )}
              </div>
            )}

            <form onSubmit={generate}>
              <style>{`
                .cf-input { width:100%; padding:11px 14px; border-radius:10px; border:1.5px solid #e2e8f0; font-size:14px; color:#0f172a; background:#fff; transition:border-color .15s,box-shadow .15s; outline:none; box-sizing:border-box; }
                .cf-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
                .cf-input::placeholder { color:#94a3b8; }
                .cf-label { display:block; font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
                .cf-section { border-radius:16px; border:1.5px solid #e2e8f0; overflow:hidden; margin-bottom:20px; }
                .cf-section-head { display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1.5px solid #e2e8f0; }
                .cf-section-body { padding:20px; }
                .cf-grid { display:grid; gap:16px; }
                .cf-grid-2 { grid-template-columns:1fr 1fr; }
                .cf-grid-3 { grid-template-columns:1fr 1fr 1fr; }
                @media(max-width:768px){.cf-grid-2,.cf-grid-3{grid-template-columns:1fr;}}
                .cf-hint { font-size:11px; color:#94a3b8; margin-top:5px; }
                .cf-req { color:#ef4444; margin-left:2px; }
              `}</style>

              {/* ── Step 1: Contract Type ── */}
              <div className="cf-section">
                <div className="cf-section-head" style={{ background: '#eff6ff' }}>
                  <span style={{ width:28,height:28,borderRadius:'50%',background:'#2563eb',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>1</span>
                  <div>
                    <p style={{ margin:0,fontSize:14,fontWeight:700,color:'#1e3a5f' }}>Contract Type</p>
                    <p style={{ margin:0,fontSize:11,color:'#64748b' }}>Choose the type and optionally link to an existing client</p>
                  </div>
                </div>
                <div className="cf-section-body">
                  <div className="cf-grid" style={{ marginBottom:16 }}>
                    <div>
                      <label className="cf-label">Select Contract Type <span className="cf-req">*</span></label>
                      <select
                        value={form.contractType}
                        onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))}
                        className="cf-input"
                      >
                        {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                      <p className="cf-hint">
                        {form.contractType==='CLIENT_SYSTEM'&&'Software system clients — service scope, payment plan and T&Cs.'}
                        {form.contractType==='CLIENT_PLOTCONNECT'&&'TST PlotConnect property listings — placement tier and listing terms.'}
                        {form.contractType==='DEVELOPER'&&'Internal developer teams — team members, project scope and deliverables.'}
                      </p>
                    </div>
                  </div>
                  <div className="cf-grid cf-grid-2">
                    <div>
                      <label className="cf-label">Link to Project <span style={{ color:'#94a3b8',fontWeight:400,textTransform:'none',fontSize:11 }}>(optional)</span></label>
                      <select value={form.projectId} onChange={set('projectId')} className="cf-input">
                        <option value="">— Manual entry —</option>
                        {projects.map((p: any) => <option key={p.id} value={p.id}>{[p.referenceNumber || p.id, p.clientName, p.serviceAmount ? `KSh ${Number(p.serviceAmount).toLocaleString()}` : null].filter(Boolean).join(' · ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="cf-label">Auto-fill from Existing Client</label>
                      <select onChange={e => autoFillClient(e.target.value)} defaultValue="" className="cf-input">
                        <option value="">— {clients.length} clients available —</option>
                        {clients.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}{c.agentName?` (${c.agentName})`:''}</option>
                        ))}
                      </select>
                      <p className="cf-hint">Selecting a client auto-fills the fields below</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Step 2: Party Details ── */}
              <div className="cf-section">
                <div className="cf-section-head" style={{ background:'#f0fdf4' }}>
                  <span style={{ width:28,height:28,borderRadius:'50%',background:'#16a34a',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>2</span>
                  <div>
                    <p style={{ margin:0,fontSize:14,fontWeight:700,color:'#14532d' }}>{form.contractType==='DEVELOPER'?'Developer / Team Details':'Client Details'}</p>
                    <p style={{ margin:0,fontSize:11,color:'#64748b' }}>Legal name and contact information for the contract</p>
                  </div>
                </div>
                <div className="cf-section-body">
                  <div className="cf-grid cf-grid-2">
                    <div>
                      <label className="cf-label">Full Name <span className="cf-req">*</span></label>
                      <input required value={form.clientName} onChange={set('clientName')} className="cf-input" placeholder="Full legal name as it appears on ID" />
                    </div>
                    <div>
                      <label className="cf-label">Organization / Company</label>
                      <input value={form.clientOrganization} onChange={set('clientOrganization')} className="cf-input" placeholder="Company or organization name" />
                    </div>
                    <div>
                      <label className="cf-label">Email Address</label>
                      <input type="email" value={form.clientEmail} onChange={set('clientEmail')} className="cf-input" placeholder="email@example.com" />
                    </div>
                    <div>
                      <label className="cf-label">Phone Number</label>
                      <input type="tel" value={form.clientPhone} onChange={set('clientPhone')} className="cf-input" placeholder="+254 7XX XXX XXX" />
                    </div>
                    <div>
                      <label className="cf-label">Address / Location</label>
                      <input value={form.clientAddress} onChange={set('clientAddress')} className="cf-input" placeholder="City, Country" />
                    </div>
                    <div>
                      <label className="cf-label">ID / Registration Number</label>
                      <input value={form.clientIdNumber} onChange={set('clientIdNumber')} className="cf-input" placeholder="National ID or Company Reg. No." />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Step 3: Service Details ── */}
              <div className="cf-section">
                <div className="cf-section-head" style={{ background:'#fffbeb' }}>
                  <span style={{ width:28,height:28,borderRadius:'50%',background:'#d97706',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>3</span>
                  <div>
                    <p style={{ margin:0,fontSize:14,fontWeight:700,color:'#78350f' }}>Service / Project Details</p>
                    <p style={{ margin:0,fontSize:11,color:'#64748b' }}>Describe what is being delivered and the timeline</p>
                  </div>
                </div>
                <div className="cf-section-body">
                  <div className="cf-grid" style={{ marginBottom:16 }}>
                    <div>
                      <label className="cf-label">Service Description <span className="cf-req">*</span></label>
                      <textarea required rows={4} value={form.serviceDescription} onChange={set('serviceDescription')}
                        className="cf-input" style={{ resize:'vertical',minHeight:100 }}
                        placeholder="Describe the service or project in detail — what will be built, delivered, or provided…" />
                    </div>
                  </div>
                  <div className="cf-grid cf-grid-3">
                    <div>
                      <label className="cf-label">Industry Category</label>
                      <select value={form.industryCategory} onChange={set('industryCategory')} className="cf-input">
                        <option value="">— Select industry —</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i.replace(/_/g,' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="cf-label">Start Date</label>
                      <input type="date" value={form.startDate} onChange={set('startDate')} className="cf-input" />
                    </div>
                    <div>
                      <label className="cf-label">Expected Delivery Date</label>
                      <input type="date" value={form.deliveryDate} onChange={set('deliveryDate')} className="cf-input" />
                    </div>
                  </div>
                  {form.contractType==='CLIENT_PLOTCONNECT' && (
                    <div className="cf-grid cf-grid-3" style={{ marginTop:16,paddingTop:16,borderTop:'1px dashed #e2e8f0' }}>
                      <div>
                        <label className="cf-label">Property Name</label>
                        <input value={form.propertyName} onChange={set('propertyName')} className="cf-input" placeholder="Property name" />
                      </div>
                      <div>
                        <label className="cf-label">Property Location</label>
                        <input value={form.propertyLocation} onChange={set('propertyLocation')} className="cf-input" placeholder="County / Town / Area" />
                      </div>
                      <div>
                        <label className="cf-label">Placement Tier</label>
                        <select value={form.placementTier} onChange={set('placementTier')} className="cf-input">
                          <option value="">— Select tier —</option>
                          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {form.contractType==='DEVELOPER' && (
                    <div style={{ marginTop:16,paddingTop:16,borderTop:'1px dashed #e2e8f0' }}>
                      <div className="cf-grid cf-grid-2">
                        <div>
                          <label className="cf-label">Developer Team</label>
                          <select value={form.developerTeamId} onChange={e => autoFillTeam(e.target.value)} className="cf-input">
                            <option value="">— Select team —</option>
                            {teams.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.name}{t.leaderName?` · Lead: ${t.leaderName}`:''}{t.memberCount?` (${t.memberCount})`:''}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="cf-label">Assigned Project</label>
                          <input value={form.assignedProject} onChange={set('assignedProject')} className="cf-input" placeholder="Project name or reference" />
                        </div>
                      </div>
                      {teamMembers.length>0 && (
                        <div style={{ marginTop:12 }}>
                          <label className="cf-label">Team Members</label>
                          <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginTop:6 }}>
                            {teamMembers.map((m: any) => (
                              <span key={m.id} style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,background:m.isTeamLeader?'#eff6ff':'#f8fafc',color:m.isTeamLeader?'#1d4ed8':'#475569',border:`1px solid ${m.isTeamLeader?'#bfdbfe':'#e2e8f0'}` }}>
                                {m.isTeamLeader&&<span style={{ width:6,height:6,borderRadius:'50%',background:'#2563eb',display:'inline-block' }}/>}
                                {m.fullName}{m.isTeamLeader?' · Lead':''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Step 4: Financial Terms ── */}
              <div className="cf-section">
                <div className="cf-section-head" style={{ background:'#f5f3ff' }}>
                  <span style={{ width:28,height:28,borderRadius:'50%',background:'#7c3aed',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>4</span>
                  <div>
                    <p style={{ margin:0,fontSize:14,fontWeight:700,color:'#3b0764' }}>Financial Terms</p>
                    <p style={{ margin:0,fontSize:11,color:'#64748b' }}>Service amount, payment plan and transaction details</p>
                  </div>
                </div>
                <div className="cf-section-body">
                  <div className="cf-grid cf-grid-3" style={{ marginBottom:16 }}>
                    <div>
                      <label className="cf-label">Total Service Amount <span className="cf-req">*</span></label>
                      <input required type="number" min={0} step="0.01" value={form.serviceAmount} onChange={set('serviceAmount')} className="cf-input" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="cf-label">Currency</label>
                      <select value={form.currency} onChange={set('currency')} className="cf-input">
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="cf-label">Payment Plan</label>
                      <select value={form.paymentPlan} onChange={set('paymentPlan')} className="cf-input">
                        {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="cf-grid cf-grid-3">
                    <div>
                      <label className="cf-label">Commitment Amount Paid</label>
                      <input type="number" min={0} step="0.01" value={form.commitmentAmount} onChange={set('commitmentAmount')} className="cf-input" placeholder="0.00" />
                      <p className="cf-hint">Leave blank if not yet paid</p>
                    </div>
                    <div>
                      <label className="cf-label">Daraja Transaction ID (M-Pesa)</label>
                      <input value={form.transactionId} onChange={set('transactionId')} className="cf-input" placeholder="TXN-2026-XXXXXXXX" />
                    </div>
                    <div>
                      <label className="cf-label">Payment Date</label>
                      <input type="date" value={form.paymentDate} onChange={set('paymentDate')} className="cf-input" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Submit ── */}
              <div style={{ display:'flex',alignItems:'center',gap:16,padding:'20px',background:'#f8fafc',borderRadius:16,border:'1.5px solid #e2e8f0' }}>
                <button type="submit" disabled={busy}
                  style={{ display:'flex',alignItems:'center',gap:8,padding:'13px 28px',borderRadius:12,border:'none',background:busy?'#94a3b8':'#2563eb',color:'#fff',fontSize:14,fontWeight:700,cursor:busy?'not-allowed':'pointer',transition:'background .15s',flexShrink:0 }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  {busy ? 'Generating PDF…' : 'Generate Contract PDF'}
                </button>
                <div>
                  <p style={{ margin:0,fontSize:13,fontWeight:600,color:'#374151' }}>Ready to generate</p>
                  <p style={{ margin:0,fontSize:11,color:'#94a3b8' }}>PDF includes company logo, full T&Cs and signature blocks</p>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── Contracts list ── */}
        {tab === 'list' && (
          <div className="p-5">
            {msg && ok && (
              <div className="flex items-center gap-2.5 text-sm px-4 py-3 rounded-xl mb-4 border bg-green-50 text-green-700 border-green-200">
                {Ic.check}
                <span className="flex-1">{msg}</span>
                {dlUrl && (
                  <button type="button" onClick={() => download('', dlUrl)}
                    className="text-xs font-bold underline whitespace-nowrap text-green-700 bg-transparent border-none cursor-pointer p-0">
                    Download PDF
                  </button>
                )}
              </div>
            )}
            <Table
              cols={[
                { key: 'referenceNumber', label: 'Ref #', render: v => <span className="font-mono text-xs font-semibold text-slate-700">{v || '—'}</span> },
                { key: 'contractType',    label: 'Type',    render: v => {
                  const map: Record<string, string> = { CLIENT_SYSTEM: 'Software', CLIENT_PLOTCONNECT: 'PlotConnect', DEVELOPER: 'Developer' };
                  return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{map[v] || v || '—'}</span>;
                }},
                { key: 'content', label: 'Client', render: v => {
                  const name = v?.clientName || v?.partyName;
                  return <span className="text-sm text-slate-700">{name || '—'}</span>;
                }},
                { key: 'status', label: 'Status', render: (v, r) => {
                  const linkedProject = projects.find((p: any) => p.id === (r.projectId || r.project_id));
                  return <Badge status={linkedProject ? projectDisplayStatus(linkedProject) : (v || 'ACTIVE')} />;
                }},
                { key: 'createdAt',label: 'Created', render: v => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                { key: 'id', label: '', render: (_v, r) => (
                  <Btn size="sm" variant="secondary" icon={Ic.eye}
                    onClick={() => download(r.id, r.pdfUrl || r.pdfDataUrl)}
                    disabled={dlBusy === r.id}>
                    {dlBusy === r.id ? 'Loading…' : 'Download'}
                  </Btn>
                )},
              ]}
              rows={contracts}
              empty="No contracts generated yet"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Payment Approval Row ─────────────────────────────────────────────────────
// ─── Payment Approval Row ─────────────────────────────────────────────────────
function PaymentApprovalRow({ approval: p, requesterName, currentUserId, onRefetch }: {
  approval: any; requesterName: string; currentUserId?: string; onRefetch: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [execMethod, setExecMethod] = React.useState('BANK_TRANSFER');
  const [showExec, setShowExec] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const doAction = async (url: string, body: Record<string, unknown> = {}) => {
    setBusy(true); setMsg('');
    try {
      await apiClient.post(url, body);
      onRefetch();
    } catch (err: any) {
      setMsg(err?.response?.data?.error || 'Action failed');
    } finally { setBusy(false); }
  };

  const status = p.status || 'PENDING_APPROVAL';
  const isPending  = status === 'PENDING_APPROVAL';
  // Execute only available if approved AND current user was the approver
  const isApproved = status === 'APPROVED_PENDING_EXECUTION';
  const iApproved  = isApproved && (!p.approverId || p.approverId === currentUserId);

  return (
    <div className="px-5 py-4 border-b border-slate-50 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-semibold text-slate-800">{p.purpose || '—'}</p>
            <Badge status={status} />
          </div>
          <p className="text-xs text-slate-500">
            <span className="font-medium">KSh {(p.amount || 0).toLocaleString()}</span>
            <span className="ml-2 text-slate-400">· {requesterName}</span>
            {p.createdAt && <span className="ml-2 text-slate-400">· {new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
          </p>
          {msg && <p className="text-xs text-red-500 mt-1">{msg}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {isPending && (
            <>
              <Btn size="sm" icon={Ic.check} disabled={busy}
                onClick={() => doAction(`/api/v1/payments/approvals/${p.id}/approve`)}>
                Approve
              </Btn>
              <Btn size="sm" variant="danger" icon={Ic.x} disabled={busy}
                onClick={async () => {
                  const reason = prompt('Rejection reason (optional):') || 'Rejected';
                  await doAction(`/api/v1/payments/approvals/${p.id}/reject`, { reason });
                }}>
                Reject
              </Btn>
            </>
          )}
          {/* Execute only shows if this user approved it */}
          {iApproved && !showExec && (
            <Btn size="sm" icon={Ic.check} disabled={busy}
              onClick={() => setShowExec(true)}>
              Execute
            </Btn>
          )}
          {isApproved && !iApproved && (
            <span className="text-xs text-slate-400 italic">Awaiting execution by approver</span>
          )}
        </div>
      </div>
      {iApproved && showExec && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          <select value={execMethod} onChange={e => setExecMethod(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:outline-none">
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="MPESA">M-Pesa</option>
            <option value="AIRTEL_MONEY">Airtel Money</option>
          </select>
          <Btn size="sm" icon={Ic.check} disabled={busy}
            onClick={() => doAction(`/api/v1/payments/approvals/${p.id}/execute`, {
              paymentDetails: { paymentMethod: execMethod }
            })}>
            {busy ? 'Executing…' : 'Confirm Execute'}
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setShowExec(false)}>Cancel</Btn>
        </div>
      )}
    </div>
  );
}

// ─── Section: Approvals ───────────────────────────────────────────────────────
function ApprovalsSection({ data, refetch, currentUserId }: { data: any; refetch: (k?: string[]) => void; currentUserId?: string }) {
  const serviceApprovals = (Array.isArray(data.serviceApprovals) ? data.serviceApprovals : []).filter((a: any) => a.status === 'PENDING' || a.status === 'PENDING_APPROVAL');
  const paymentApprovals = [
    ...(Array.isArray(data.paymentApprovals) ? data.paymentApprovals : []),
    ...(Array.isArray(data.approvedPayments)  ? data.approvedPayments  : []),
  ].filter((p: any) => ['PENDING_APPROVAL', 'APPROVED_PENDING_EXECUTION'].includes(p.status));
  const techRequests     = Array.isArray(data.techRequests) ? data.techRequests : [];
  const users            = Array.isArray(data.users) ? data.users : [];

  // Build a quick id→name map for requester lookup
  const userMap = new Map<string, string>(users.map((u: any) => [u.id, u.fullName || u.name || u.email || u.id]));
  const requesterName = (id: string) => userMap.get(id) || id || '—';

  const act = async (url: string, method: 'post' | 'patch' = 'post') => {
    try { await apiClient[method](url, {}); refetch(['serviceApprovals', 'paymentApprovals', 'techRequests']); } catch { /* silent */ }
  };

  return (
    <div className="space-y-5">
      {/* Service amount changes */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="Pricing Change Requests"
            sub="All pricing changes require CEO confirmation before taking effect" />
        </div>
        {serviceApprovals.length === 0
          ? <p className="px-5 py-8 text-center text-slate-400 text-sm">No pending pricing changes</p>
          : serviceApprovals.map((a: any) => (
            <div key={a.id} className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-4 last:border-0">
              <div>
                <p className="text-sm font-semibold text-slate-800">{a.serviceName || a.name || 'Service'}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Current: <span className="font-medium">KSh {(a.currentAmount || a.originalAmount || 0).toLocaleString()}</span>
                  {' → '}
                  Proposed: <span className="font-semibold text-blue-600">KSh {(a.newAmount || 0).toLocaleString()}</span>
                </p>
                {a.reason && <p className="text-xs text-slate-400 mt-0.5">Reason: {a.reason}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Btn size="sm" icon={Ic.check} onClick={() => act(`/api/v1/service-amounts/changes/${a.id}/confirm`)}>Confirm</Btn>
                <Btn size="sm" variant="danger" icon={Ic.x} onClick={() => act(`/api/v1/service-amounts/changes/${a.id}/reject`)}>Reject</Btn>
              </div>
            </div>
          ))
        }
      </div>

      {/* Payment approvals — moved above tech funding */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="Payment Approvals" sub="Submitted by COO/CTO/Operations — approved & executed by CFO, CoS or CEO" />
        </div>
        {paymentApprovals.length === 0
          ? <p className="px-5 py-8 text-center text-slate-400 text-sm">No pending payment approvals</p>
          : paymentApprovals.map((p: any) => (
            <PaymentApprovalRow key={p.id} approval={p} requesterName={requesterName(p.requesterId)} currentUserId={currentUserId} onRefetch={() => refetch(['paymentApprovals', 'approvedPayments'])} />
          ))
        }
      </div>

      {/* Tech funding requests */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="Tech Funding Requests"
            sub="Submitted by CTO — approved by CFO, CoS or CEO" />
        </div>
        {techRequests.length === 0
          ? <p className="px-5 py-8 text-center text-slate-400 text-sm">No tech funding requests</p>
          : techRequests.map((r: any) => (
            <div key={r.id} className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-4 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-slate-800">{r.project}</p>
                  <Badge status={r.status || 'PENDING'} />
                </div>
                <p className="text-xs text-slate-500">
                  <span className="font-medium">KSh {(r.amount || 0).toLocaleString()}</span>
                  <span className="ml-2 text-slate-400">· {r.requesterName || requesterName(r.requesterId) || 'CTO User'}</span>
                </p>
                {r.justification && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.justification}</p>}
              </div>
              {r.status === 'PENDING' && (
                <div className="flex gap-2 flex-shrink-0">
                  <Btn size="sm" icon={Ic.check} onClick={() => act(`/api/v1/tech-funding-requests/${r.id}/approve`, 'patch')}>Approve</Btn>
                  <Btn size="sm" variant="danger" icon={Ic.x} onClick={() => act(`/api/v1/tech-funding-requests/${r.id}/reject`, 'patch')}>Reject</Btn>
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── Section: Reports ─────────────────────────────────────────────────────────
function ReportsSection({ data, refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const allReports        = data.dailyReports     || [];
  const complianceReports = data.complianceReports || [];
  const [tab, setTab]     = useState<'daily' | 'compliance' | 'missing'>('daily');
  const [search, setSearch]   = useState('');
  const [roleFilter, setRole] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [missing, setMissing]   = useState<any[]>([]);
  const [missingLoading, setMissingLoading] = useState(false);
  const [checked, setChecked]   = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const loadMissing = React.useCallback(async () => {
    setMissingLoading(true);
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      const res = await apiClient.get('/api/v1/daily-reports/missing');
      setMissing((res.data as any)?.missing || []);
    } catch { setMissing([]); }
    finally { setMissingLoading(false); }
  }, []);

  React.useEffect(() => { if (tab === 'missing') loadMissing(); }, [tab, loadMissing]);
  React.useEffect(() => { setChecked(new Set()); }, [tab, search, roleFilter, dateFrom, dateTo]);

  const filtered = allReports.filter((r: any) => {
    const name  = (r.userName || r.user || '').toLowerCase();
    const email = (r.userEmail || '').toLowerCase();
    const role  = (r.userRole  || '').toLowerCase();
    const q     = search.toLowerCase();
    const matchSearch = !q || name.includes(q) || email.includes(q) || role.includes(q);
    const matchRole   = !roleFilter || role === roleFilter.toLowerCase();
    const rDate = r.reportDate ? r.reportDate.toString().slice(0, 10) : null;
    const matchFrom = !dateFrom || (rDate && rDate >= dateFrom);
    const matchTo   = !dateTo   || (rDate && rDate <= dateTo);
    return matchSearch && matchRole && matchFrom && matchTo;
  });

  const roles = [...new Set(allReports.map((r: any) => r.userRole).filter(Boolean))].sort();

  // ── Selection ──────────────────────────────────────────────────────────────
  const allChecked = filtered.length > 0 && filtered.every((r: any) => checked.has(r.id));
  const someChecked = checked.size > 0;
  const toggleAll = () => { if (allChecked) setChecked(new Set()); else setChecked(new Set(filtered.map((r: any) => r.id))); };
  const toggleOne = (id: string) => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Print ──────────────────────────────────────────────────────────────────
  const printReports = (reports: any[]) => {
    const html = `<!DOCTYPE html><html><head><title>Daily Reports — TechSwiftTrix</title>
    <style>body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;margin:0;padding:24px}h1{font-size:18px;margin-bottom:4px}.meta{color:#64748b;font-size:11px;margin-bottom:24px}.report{border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;page-break-inside:avoid}.rh{display:flex;justify-content:space-between;margin-bottom:12px}.name{font-weight:700;font-size:14px}.role{font-size:11px;color:#64748b;margin-top:2px}.dates{text-align:right;font-size:11px;color:#64748b}.sl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin-bottom:4px;margin-top:10px}.sb{background:#f8fafc;border-radius:6px;padding:8px 10px;font-size:12px;line-height:1.5}@media print{body{padding:0}}</style>
    </head><body>
    <h1>TechSwiftTrix — Daily Reports</h1>
    <p class="meta">Printed by CEO &middot; ${new Date().toLocaleString('en-GB')}</p>
    ${reports.map(r => `<div class="report"><div class="rh"><div><div class="name">${r.userName || '—'}</div><div class="role">${r.userRole || '—'} &middot; ${r.userDepartment || '—'} &middot; ${r.userEmail || '—'}</div></div><div class="dates"><div>Report date: <strong>${fmtDate(r.reportDate)}</strong></div><div>Submitted: ${fmtDateTime(r.submittedAt)}</div>${r.hoursWorked != null ? `<div>Hours: ${r.hoursWorked}h</div>` : ''}</div></div>${r.accomplishments ? `<div class="sl">Accomplishments</div><div class="sb">${r.accomplishments}</div>` : ''}${r.challenges ? `<div class="sl">Challenges</div><div class="sb">${r.challenges}</div>` : ''}${r.tomorrowPlan ? `<div class="sl">Plan for tomorrow</div><div class="sb">${r.tomorrowPlan}</div>` : ''}</div>`).join('')}
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 400);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteReport = async (id: string) => {
    if (!window.confirm('Delete this report permanently?')) return;
    setDeleting(prev => new Set(prev).add(id));
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.delete(`/api/v1/reports/${id}`);
      setChecked(prev => { const n = new Set(prev); n.delete(id); return n; });
      if (selected?.id === id) setSelected(null);
      refetch(['dailyReports']);
    } catch (err: any) { alert(err?.response?.data?.error || 'Failed to delete'); }
    finally { setDeleting(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${checked.size} report(s) permanently?`)) return;
    const ids = Array.from(checked);
    const { apiClient } = await import('../../shared/api/apiClient');
    setDeleting(new Set(ids));
    await Promise.allSettled(ids.map(id => apiClient.delete(`/api/v1/reports/${id}`)));
    setChecked(new Set()); setDeleting(new Set());
    refetch(['dailyReports']);
  };

  const IcPrint = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
  const IcTrash = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

  return (
    <div className="space-y-5">
      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"
              style={{ background: C.blueL }}>
              <div>
                <h2 className="text-base font-bold text-slate-900">Daily Report</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selected.userName || selected.user || 'Unknown'} &nbsp;·&nbsp;
                  {selected.userRole || '—'} &nbsp;·&nbsp;
                  {selected.userDepartment || '—'}
                </p>
              </div>
              <button onClick={() => setSelected(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Sender info */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Submitted by</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{selected.userName || selected.user || '—'}</p>
                  <p className="text-xs text-slate-500">{selected.userEmail || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Role / Dept</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{selected.userRole || '—'}</p>
                  <p className="text-xs text-slate-500">{selected.userDepartment || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Report Date</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">
                    {fmtDate(selected.reportDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Submitted at</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">
                    {fmtDateTime(selected.submittedAt)}
                  </p>
                </div>
                {selected.hoursWorked != null && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Hours worked</p>
                    <p className="text-sm font-medium text-slate-700 mt-0.5">{selected.hoursWorked}h</p>
                  </div>
                )}
              </div>
              {/* Content */}
              {[
                { label: 'Accomplishments', value: selected.accomplishments },
                { label: 'Challenges', value: selected.challenges },
                { label: 'Plan for tomorrow', value: selected.tomorrowPlan },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{f.label}</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 leading-relaxed">{f.value}</p>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-2">
              <Btn variant="secondary" icon={IcPrint} onClick={() => printReports([selected])}>Print</Btn>
              <Btn variant="danger" icon={IcTrash} onClick={() => deleteReport(selected.id)}>Delete</Btn>
              <Btn variant="secondary" onClick={() => setSelected(null)}>Close</Btn>
            </div>
          </div>
        </div>
      )}

      <div className={card}>
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {(['daily', 'compliance', 'missing'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px capitalize"
              style={tab === t ? { borderColor: C.blue2, color: C.blue2 } : { borderColor: 'transparent', color: C.muted }}>
              {t === 'daily' ? `Daily Reports (${allReports.length})` : t === 'compliance' ? 'Compliance Reports' : `Missing Today${missing.length > 0 ? ` (${missing.length})` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'daily' && (
          <div>
            {/* Filters */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <p className="text-xs font-semibold text-slate-500 mb-1">Search name / email / role</p>
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="e.g. John, agent@tst.com, AGENT…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 transition-all"
                  style={{ '--tw-ring-color': C.blue2 } as any}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Role</p>
                <select value={roleFilter} onChange={e => setRole(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:outline-none">
                  <option value="">All roles</option>
                  {roles.map((r: any) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">From</p>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:outline-none" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">To</p>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:outline-none" />
              </div>
              {(search || roleFilter || dateFrom || dateTo) && (
                <Btn size="sm" variant="ghost" onClick={() => { setSearch(''); setRole(''); setDateFrom(''); setDateTo(''); }}>
                  Clear filters
                </Btn>
              )}
              <Btn size="sm" variant="secondary" onClick={() => refetch(['dailyReports'])}>Refresh</Btn>
            </div>

            {/* Batch toolbar */}
            {someChecked && (
              <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-3" style={{ background: C.blueL }}>
                <span className="text-xs font-semibold text-slate-600">{checked.size} selected</span>
                <Btn size="sm" variant="secondary" icon={IcPrint} onClick={() => printReports(filtered.filter((r: any) => checked.has(r.id)))}>Print selected</Btn>
                <Btn size="sm" variant="danger" icon={IcTrash} onClick={deleteSelected}>Delete selected</Btn>
                <button onClick={() => setChecked(new Set())} className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors">Clear selection</button>
              </div>
            )}

            {/* Table */}
            <div className="p-5">
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100" style={{ background: '#f8fafc' }}>
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded border-slate-300 cursor-pointer" />
                      </th>
                      {['Submitted By','Role','Department','Report Date','Submitted At','Hours','Summary',''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">
                        {allReports.length === 0 ? 'No daily reports submitted yet' : 'No reports match your filters'}
                      </td></tr>
                    ) : filtered.map((r: any) => (
                      <tr key={r.id} className={`border-b border-slate-50 transition-colors ${checked.has(r.id) ? 'bg-blue-50/60' : 'hover:bg-slate-50/60'}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={checked.has(r.id)} onChange={() => toggleOne(r.id)} className="rounded border-slate-300 cursor-pointer" />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 text-sm">{r.userName || r.user || '—'}</p>
                          <p className="text-xs text-slate-400">{r.userEmail || '—'}</p>
                        </td>
                        <td className="px-4 py-3">{r.userRole ? <Badge status={r.userRole} /> : <span className="text-slate-400 text-xs">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{r.userDepartment || '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-700 whitespace-nowrap">{fmtDate(r.reportDate)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(r.submittedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-700">{r.hoursWorked != null ? `${r.hoursWorked}h` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate">{r.accomplishments ? String(r.accomplishments).slice(0, 55) + (String(r.accomplishments).length > 55 ? '…' : '') : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Btn size="sm" variant="secondary" icon={Ic.eye} onClick={() => setSelected(r)}>View</Btn>
                            <button title="Print" onClick={() => printReports([r])} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">{IcPrint}</button>
                            <button title="Delete" disabled={deleting.has(r.id)} onClick={() => deleteReport(r.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40">{IcTrash}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > 0 && (
                <p className="text-xs text-slate-400 mt-3">
                  Showing {filtered.length} of {allReports.length} report{allReports.length !== 1 ? 's' : ''}
                  {someChecked && <span className="ml-2 text-blue-600 font-medium">· {checked.size} selected</span>}
                </p>
              )}
            </div>
          </div>
        )}

        {tab === 'compliance' && (
          <div className="p-5">
            <Table
              cols={[
                { key: 'title',     label: 'Report' },
                { key: 'period',    label: 'Period' },
                { key: 'status',    label: 'Status', render: v => <Badge status={v || 'PENDING'} /> },
                { key: 'createdAt', label: 'Date',   render: v => v ? new Date(v).toLocaleDateString() : '—' },
              ]}
              rows={complianceReports}
              empty="No compliance reports"
            />
          </div>
        )}

        {tab === 'missing' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">Staff who have not submitted a daily report today</p>
              <Btn size="sm" variant="secondary" onClick={loadMissing}>Refresh</Btn>
            </div>
            {missingLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${C.blue2} transparent transparent transparent` }} />
              </div>
            ) : (
              <Table
                cols={[
                  { key: 'full_name', label: 'Name',       render: v => <span className="font-semibold text-slate-800">{v || '—'}</span> },
                  { key: 'email',     label: 'Email',      render: v => <span className="text-xs text-slate-500">{v || '—'}</span> },
                  { key: 'role',      label: 'Role',       render: v => v ? <Badge status={v} /> : '—' },
                ]}
                rows={missing}
                empty="Everyone has submitted their report today ✓"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: Chat ────────────────────────────────────────────────────────────
function ChatSection({ token, currentUserId }: { token: string; currentUserId: string }) {
  return (
    <div style={{ height: 'calc(100vh - 180px)', minHeight: 400 }}>
      <ChatPanel token={token} currentUserId={currentUserId} portal="CEO Portal" inlineMode />
    </div>
  );
}

// ─── Section: Notifications ───────────────────────────────────────────────────
const PORTAL_TARGETS = [
  { value: 'all',        label: 'All Portals' },
  { value: 'executive',  label: 'Executive Portal' },
  { value: 'clevel',     label: 'C-Level Portal' },
  { value: 'operations', label: 'Operations Portal' },
  { value: 'technology', label: 'Technology Portal' },
  { value: 'agents',     label: 'Agents Portal' },
];

const NOTIF_TYPES = ['System', 'Announcement', 'Alert', 'Reminder'];

function NotificationsSection({ data, refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const [notifs, setNotifs] = React.useState<any[]>(data.notifications || []);
  React.useEffect(() => setNotifs(data.notifications || []), [data.notifications]);

  const [title, setTitle]           = React.useState('');
  const [message, setMessage]       = React.useState('');
  const [notifType, setNotifType]   = React.useState('System');
  const [targetMode, setTargetMode] = React.useState<'all' | 'portal' | 'user'>('all');
  const [portal, setPortal]         = React.useState('executive');
  const [scheduleAt, setScheduleAt] = React.useState('');
  const [wantSchedule, setWantSchedule] = React.useState(false);
  const [sending, setSending]       = React.useState(false);
  const [sendError, setSendError]   = React.useState('');
  const [sendOk, setSendOk]         = React.useState(false);

  const MAX = 255;

  const resetForm = () => {
    setTitle(''); setMessage(''); setNotifType('System');
    setTargetMode('all'); setPortal('executive');
    setScheduleAt(''); setWantSchedule(false);
    setSendError(''); setSendOk(false);
  };

  const target = targetMode === 'all' ? 'all' : targetMode === 'portal' ? portal : 'user';

  const sendNotification = async (scheduled: boolean) => {
    if (!title.trim() || !message.trim()) { setSendError('Title and message are required.'); return; }
    if (scheduled && !scheduleAt) { setSendError('Please pick a date and time to schedule.'); return; }
    setSending(true); setSendError(''); setSendOk(false);
    try {
      await apiClient.post('/api/v1/notifications/broadcast', {
        title: title.trim(),
        message: message.trim(),
        type: notifType,
        target,
        ...(scheduled && scheduleAt ? { scheduledAt: new Date(scheduleAt).toISOString() } : {}),
      });
      setSendOk(true);
      resetForm();
      refetch(['notifications']);
    } catch (e: any) {
      setSendError(e?.response?.data?.error || e?.message || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  };

  const deleteNotif = async (id: string) => {
    try {
      // Delete all copies of this broadcast across all portals
      await apiClient.delete(`/api/v1/notifications/${id}/broadcast`);
      refetch(['notifications']);
    } catch { /* silent */ }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all notification history? This removes them from all portals.')) return;
    try {
      await apiClient.delete('/api/v1/notifications/clear-all');
      refetch(['notifications']);
    } catch { /* silent */ }
  };

  const scheduled = notifs.filter(n => n.scheduledAt && new Date(n.scheduledAt) > new Date());
  const history   = notifs.filter(n => !n.scheduledAt || new Date(n.scheduledAt) <= new Date());

  return (
    <div>
      <div className="mb-1">
        <p className="text-base font-bold text-slate-900">Broadcast Notifications</p>
        <p className="text-sm text-slate-500 mt-0.5">Send targeted messages to any portal or user</p>
      </div>

      <div className="flex gap-5 mt-5 items-start">

        {/* ── Left: Compose ── */}
        <div className={`${card} p-5 flex-shrink-0`} style={{ width: 380 }}>
          <p className="text-sm font-bold text-slate-800 mb-4">Compose Notification</p>

          {/* Title */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              className={inp}
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, MAX))}
              placeholder="e.g. System Maintenance Notice"
            />
            <p className="text-[10px] text-slate-400 mt-1 text-right">{title.length}/{MAX}</p>
          </div>

          {/* Message */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              className={inp}
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your notification message here…"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Type */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
            <select className={inp} value={notifType} onChange={e => setNotifType(e.target.value)}>
              {NOTIF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Send To — radio group */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-2">Send To</label>
            <div className="space-y-2">
              {([
                { v: 'all',    icon: '🌐', label: 'All users (every portal)' },
                { v: 'portal', icon: '👥', label: 'Specific role (portal)' },
                { v: 'user',   icon: '👤', label: 'Specific user' },
              ] as const).map(opt => (
                <label key={opt.v} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="targetMode"
                    value={opt.v}
                    checked={targetMode === opt.v}
                    onChange={() => setTargetMode(opt.v)}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: C.blue2 }}
                  />
                  <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                    {opt.icon} {opt.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Portal picker — shown when "portal" selected */}
            {targetMode === 'portal' && (
              <div className="mt-2">
                <select className={inp} value={portal} onChange={e => setPortal(e.target.value)}>
                  {PORTAL_TARGETS.filter(p => p.value !== 'all').map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Schedule toggle + picker */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={wantSchedule}
                onChange={e => { setWantSchedule(e.target.checked); if (!e.target.checked) setScheduleAt(''); }}
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: C.blue2 }}
              />
              <span className="text-xs font-semibold text-slate-600">Schedule for later</span>
            </label>
            {wantSchedule && (
              <input
                type="datetime-local"
                className={inp}
                value={scheduleAt}
                min={new Date().toISOString().slice(0, 16)}
                onChange={e => setScheduleAt(e.target.value)}
              />
            )}
          </div>

          {sendError && (
            <div className="mb-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {Ic.x} {sendError}
            </div>
          )}
          {sendOk && (
            <div className="mb-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              {Ic.check} {wantSchedule ? 'Notification scheduled.' : 'Notification sent successfully.'}
            </div>
          )}

          {/* Action buttons */}
          {!wantSchedule ? (
            <button
              onClick={() => sendNotification(false)}
              disabled={sending || !title.trim() || !message.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${C.green} 0%, #15803d 100%)` }}>
              {Ic.notif}
              {sending ? 'Sending…' : 'Send Notification'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => sendNotification(false)}
                disabled={sending || !title.trim() || !message.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                style={{ background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blue2} 100%)` }}>
                {Ic.notif}
                {sending ? '…' : 'Send Now'}
              </button>
              <button
                onClick={() => sendNotification(true)}
                disabled={sending || !title.trim() || !message.trim() || !scheduleAt}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                style={{ background: `linear-gradient(135deg, ${C.amber} 0%, #b45309 100%)` }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {sending ? '…' : 'Schedule'}
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Sent History ── */}
        <div className={`${card} flex-1 min-w-0`} style={{ minHeight: 420 }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">Sent History</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{notifs.length} sent</span>
              {notifs.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50 transition-colors border border-red-100">
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Scheduled section */}
          {scheduled.length > 0 && (
            <>
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100" style={{ background: C.amberL }}>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: C.amber }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.amber }}>Scheduled</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: C.amber + '22', color: C.amber }}>
                  {scheduled.length}
                </span>
              </div>
              <div className="divide-y divide-amber-50">
                {scheduled.map((n: any, i: number) => (
                  <div key={n.id || i} className="flex items-start gap-3 px-5 py-3.5 hover:bg-amber-50/60 transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: C.amberL, color: C.amber }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                        {n.type && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{n.type}</span>}
                        {n.target && n.target !== 'all' && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: C.blueL, color: C.blue2 }}>
                            {PORTAL_TARGETS.find(p => p.value === n.target)?.label || n.target}
                          </span>
                        )}
                      </div>
                      {n.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{n.message}</p>}
                      <p className="text-[10px] font-medium mt-1" style={{ color: C.amber }}>
                        Sends: {new Date(n.scheduledAt).toLocaleString()}
                      </p>
                    </div>
                    <button onClick={() => deleteNotif(n.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                      title="Cancel scheduled notification">
                      {Ic.x}
                    </button>
                  </div>
                ))}
              </div>
              {/* Divider between scheduled and sent */}
              <div className="border-b border-slate-100" />
            </>
          )}

          {/* History list */}
          {history.length === 0 && scheduled.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: C.amberL }}>
                <svg className="w-7 h-7" style={{ color: C.amber }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">No notifications sent yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {history.map((n: any, i: number) => (
                <div key={n.id || i} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: C.blueL, color: C.blue2 }}>
                    {Ic.notif}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">{n.title || 'Notification'}</p>
                      {n.type && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{n.type}</span>
                      )}
                      {n.target && n.target !== 'all' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: C.blueL, color: C.blue2 }}>
                          {PORTAL_TARGETS.find(p => p.value === n.target)?.label || n.target}
                        </span>
                      )}
                    </div>
                    {n.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
                  </div>
                  <button onClick={() => deleteNotif(n.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                    {Ic.x}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section: System Admin ────────────────────────────────────────────────────
function AdminSection({ data, refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const users = data.users || [];

  // top-level tabs: Control (user mgmt, audit, sessions, backup) vs the rest
  const [topTab, setTopTab] = useState<'control' | 'config' | 'portals' | 'health' | 'integrations'>('control');
  // sub-tabs inside Control
  const [ctrlTab, setCtrlTab] = useState<'users' | 'audit' | 'sessions' | 'backup'>('users');

  const [filter, setFilter] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');

  // audit log state
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [auditFilter, setAuditFilter] = React.useState('');

  // sessions state
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);

  // backup state
  const [backups, setBackups] = React.useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = React.useState(false);
  const [backupMsg, setBackupMsg] = React.useState('');

  // invitations state
  const [invitations, setInvitations] = React.useState<any[]>([]);

  // portal toggle state (keyed by portal url)
  const [portalStates, setPortalStates] = React.useState<Record<string, { enabled: boolean; toggling: boolean }>>({});

  // health / integrations state
  const [health, setHealth] = React.useState<any>(null);
  const [integrations, setIntegrations] = React.useState<any[]>([]);
  const [backupEmail, setBackupEmail] = React.useState('');
  const [backupEmailSaved, setBackupEmailSaved] = React.useState('');
  const [intMsg, setIntMsg] = React.useState('');
  const [editIntKey, setEditIntKey] = React.useState<string | null>(null);
  const [editIntVal, setEditIntVal] = React.useState('');

  const loadAudit = () => {
    setAuditLoading(true);
    apiClient.get('/api/v1/admin/audit-log?limit=100').then(r => setAuditLogs((r.data as any).data || [])).catch(() => {}).finally(() => setAuditLoading(false));
  };
  const loadSessions = () => {
    setSessionsLoading(true);
    apiClient.get('/api/v1/admin/sessions').then(r => setSessions((r.data as any).data || [])).catch(() => {}).finally(() => setSessionsLoading(false));
  };
  const loadBackups = () => {
    setBackupsLoading(true);
    apiClient.get('/api/v1/admin/backups').then(r => setBackups((r.data as any).data || [])).catch(() => {}).finally(() => setBackupsLoading(false));
  };
  const loadInvitations = () => {
    apiClient.get('/api/v1/admin/invitations').then(r => setInvitations((r.data as any).data || [])).catch(() => {});
  };

  React.useEffect(() => {
    if (topTab === 'control') {
      if (ctrlTab === 'audit')    loadAudit();
      if (ctrlTab === 'sessions') { loadSessions(); loadInvitations(); }
      if (ctrlTab === 'backup')   loadBackups();
    }
    if (topTab === 'health') {
      apiClient.get('/api/v1/admin/health').then(r => setHealth((r.data as any).data)).catch(() => {});
    }
    if (topTab === 'integrations') {
      apiClient.get('/api/v1/admin/integrations').then(r => setIntegrations((r.data as any).data || [])).catch(() => {});
      apiClient.get('/api/v1/admin/ceo-backup-email').then(r => { const e = (r.data as any).data?.email || ''; setBackupEmail(e); setBackupEmailSaved(e); }).catch(() => {});
    }
  }, [topTab, ctrlTab]);

  const suspend = async (id: string) => {
    try { await apiClient.post(`/api/v1/users/${id}/suspend`, { reason: 'Suspended by CEO' }); refetch(['users']); } catch { /* silent */ }
  };
  const reactivate = async (id: string) => {
    try { await apiClient.post(`/api/v1/admin/users/${id}/reactivate`, {}); refetch(['users']); } catch { /* silent */ }
  };
  const hardDelete = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    try { await apiClient.delete(`/api/v1/admin/users/${id}`); refetch(['users']); } catch { /* silent */ }
  };
  const saveRole = async (id: string) => {
    try { await apiClient.post(`/api/v1/admin/users/${id}/role`, { role: editRole }); setEditId(null); refetch(['users']); } catch { /* silent */ }
  };
  const forceLogoutUser = async (userId: string) => {
    try { await apiClient.post(`/api/v1/admin/sessions/${userId}/force-logout`, {}); loadSessions(); } catch { /* silent */ }
  };
  const forceLogoutAll = async () => {
    if (!window.confirm('Force logout ALL users? Their sessions will be immediately invalidated.')) return;
    try { await apiClient.post('/api/v1/admin/sessions/force-logout-all', {}); loadSessions(); } catch { /* silent */ }
  };
  const revokeInvitation = async (id: string) => {
    try { await apiClient.delete(`/api/v1/admin/invitations/${id}`); loadInvitations(); } catch { /* silent */ }
  };
  const triggerBackup = async (type: 'full' | 'incremental') => {
    setBackupMsg('');
    try { await apiClient.post('/api/v1/admin/backups/trigger', { type }); setBackupMsg(`${type} backup triggered`); loadBackups(); } catch { setBackupMsg('Failed to trigger backup'); }
  };
  const saveIntegration = async (key: string) => {
    try { await apiClient.put(`/api/v1/admin/integrations/${key}`, { value: editIntVal }); setEditIntKey(null); setEditIntVal(''); setIntMsg(`${key} updated`); apiClient.get('/api/v1/admin/integrations').then(r => setIntegrations((r.data as any).data || [])).catch(() => {}); } catch { setIntMsg('Failed to update'); }
  };
  const saveBackupEmail = async () => {
    try { await apiClient.put('/api/v1/admin/ceo-backup-email', { email: backupEmail }); setBackupEmailSaved(backupEmail); setIntMsg('Backup email saved'); } catch { setIntMsg('Failed to save'); }
  };

  const filtered = users.filter((u: any) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (u.fullName || u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });
  const filteredAudit = auditLogs.filter((l: any) => {
    if (!auditFilter) return true;
    const q = auditFilter.toLowerCase();
    return (l.user_name || '').toLowerCase().includes(q) || (l.action || '').toLowerCase().includes(q) || (l.resource_type || '').toLowerCase().includes(q);
  });

  const PORTALS = [
    { name: 'Portal 1 — CEO',        url: '/gatewayalpha',  roles: 'CEO' },
    { name: 'Portal 2 — Executive',  url: '/gatewaydelta',  roles: 'CoS, CFO, EA' },
    { name: 'Portal 3 — C-Level',    url: '/gatewaysigma',  roles: 'COO, CTO' },
    { name: 'Portal 4 — Operations', url: '/gatewaynexus',  roles: 'Ops, HoT, Trainer' },
    { name: 'Portal 5 — Technology', url: '/gatewayvertex', roles: 'Tech, Developer' },
    { name: 'Portal 6 — Agents',     url: '/gatewaypulse',  roles: 'Agent' },
  ];

  const TOP_TABS = [
    { id: 'control',      label: 'Control' },
    { id: 'config',       label: 'System Config' },
    { id: 'portals',      label: 'Portal Access' },
    { id: 'health',       label: 'System Health' },
    { id: 'integrations', label: 'API & Integrations' },
  ] as const;

  const CTRL_TABS = [
    { id: 'users',    label: 'User Management' },
    { id: 'audit',    label: 'Audit Log' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'backup',   label: 'Backup' },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium"
        style={{ background: C.blueL, borderColor: '#bfdbfe', color: C.blue }}>
        {Ic.shield}
        CEO exclusive — this panel is not visible to any other role. Every action is logged and timestamped.
      </div>

      <div className={card}>
        {/* ── Top-level tabs ── */}
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {TOP_TABS.map(t => (
            <button key={t.id} onClick={() => setTopTab(t.id as any)}
              className="px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap"
              style={topTab === t.id ? { borderColor: C.blue2, color: C.blue2 } : { borderColor: 'transparent', color: C.muted }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ══════════════════════════════════════════════════════════════════
              CONTROL TAB — User Management / Audit Log / Sessions / Backup
          ══════════════════════════════════════════════════════════════════ */}
          {topTab === 'control' && (
            <div className="space-y-4">
              {/* Control sub-tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
                {CTRL_TABS.map(t => (
                  <button key={t.id} onClick={() => setCtrlTab(t.id as any)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg transition-all"
                    style={ctrlTab === t.id
                      ? { background: '#fff', color: C.blue2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                      : { color: C.muted }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── User Management ── */}
              {ctrlTab === 'users' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-500">{users.length} total accounts</p>
                    <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search…"
                      className="w-52 px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                  </div>
                <Table
                  cols={[
                    { key: 'fullName',  label: 'Name',   render: (v, r) => v || r.name || '—' },
                    { key: 'email',     label: 'Email' },
                    { key: 'role',      label: 'Role',   render: (v, r) => r.roleName || v || '—' },
                    { key: 'isActive',  label: 'Status', render: v => <Badge status={v === false ? 'SUSPENDED' : 'ACTIVE'} /> },
                    { key: 'id',        label: 'Actions', render: (_v, row) => (
                      <div className="flex items-center gap-2 flex-wrap">
                        {editId === row.id ? (
                          <>
                            <select value={editRole} onChange={e => setEditRole(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white">
                              {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <Btn size="sm" onClick={() => saveRole(row.id)}>Save</Btn>
                            <Btn size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Btn>
                          </>
                        ) : (
                          <>
                            <Btn size="sm" variant="secondary" onClick={() => { setEditId(row.id); setEditRole(row.role || ''); }}>Role</Btn>
                            {row.isActive !== false
                              ? <Btn size="sm" variant="danger" onClick={() => suspend(row.id)}>Suspend</Btn>
                              : <Btn size="sm" variant="secondary" onClick={() => reactivate(row.id)}>Reactivate</Btn>
                            }
                            <Btn size="sm" variant="danger" onClick={() => hardDelete(row.id, row.fullName || row.name || row.email)}>Delete</Btn>
                          </>
                        )}
                      </div>
                    )},
                  ]}
                  rows={filtered}
                  empty="No users found"
                />

                {/* Pending Invitations */}
                {invitations.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pending Invitations</p>
                    <div className="space-y-2">
                      {invitations.map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{inv.email}</p>
                            <p className="text-xs text-slate-400">{inv.role} · invited by {inv.invited_by} · expires {fmtDate(inv.expires_at)}</p>
                          </div>
                          <Btn size="sm" variant="danger" onClick={() => revokeInvitation(inv.id)}>Revoke</Btn>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* ── Audit Log ── */}
              {ctrlTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-500">{auditLogs.length} recent entries</p>
                    <div className="flex items-center gap-2">
                      <input value={auditFilter} onChange={e => setAuditFilter(e.target.value)} placeholder="Filter by user or action…"
                        className="w-56 px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                      <Btn size="sm" variant="secondary" onClick={loadAudit}>Refresh</Btn>
                    </div>
                  </div>
                  {auditLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
                  ) : (
                    <Table
                      cols={[
                        { key: 'created_at',    label: 'Time',     render: v => fmtDateTime(v) },
                        { key: 'user_name',     label: 'User',     render: (v, r) => <span>{v || '—'} <span className="text-xs text-slate-400">({r.user_role || ''})</span></span> },
                        { key: 'action',        label: 'Action',   render: v => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{v}</code> },
                        { key: 'resource_type', label: 'Resource', render: (v, r) => <span>{v}{r.resource_id ? <span className="text-xs text-slate-400 ml-1">#{String(r.resource_id).slice(0,8)}</span> : ''}</span> },
                        { key: 'result',        label: 'Result',   render: v => <Badge status={v === 'SUCCESS' ? 'ACTIVE' : 'SUSPENDED'} /> },
                        { key: 'ip_address',    label: 'IP' },
                      ]}
                      rows={filteredAudit}
                      empty="No audit entries"
                    />
                  )}
                </div>
              )}

              {/* ── Sessions ── */}
              {ctrlTab === 'sessions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</p>
                    <div className="flex items-center gap-2">
                      <Btn size="sm" variant="secondary" onClick={loadSessions}>Refresh</Btn>
                      <Btn variant="danger" icon={Ic.x} onClick={forceLogoutAll}>Force Logout All</Btn>
                    </div>
                  </div>
                  {sessionsLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
                  ) : (
                    <Table
                      cols={[
                        { key: 'full_name',  label: 'User',    render: (v, r) => <span>{v || '—'} <span className="text-xs text-slate-400">({r.role || ''})</span></span> },
                        { key: 'ip_address', label: 'IP' },
                        { key: 'user_agent', label: 'Device',  render: v => <span className="text-xs text-slate-500 truncate max-w-[160px] block">{v || '—'}</span> },
                        { key: 'created_at', label: 'Started', render: v => fmtDateTime(v) },
                        { key: 'expires_at', label: 'Expires', render: v => fmtDateTime(v) },
                        { key: 'user_id',    label: 'Actions', render: (_v, row) => (
                          <Btn size="sm" variant="danger" onClick={() => forceLogoutUser(row.user_id)}>Logout</Btn>
                        )},
                      ]}
                      rows={sessions}
                      empty="No active sessions"
                    />
                  )}
                </div>
              )}

              {/* ── Backup ── */}
              {ctrlTab === 'backup' && (
                <div className="space-y-4">
                  {backupMsg && <div className="p-3 rounded-xl text-sm bg-green-50 text-green-700">{backupMsg}</div>}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">Database backups — AES-256 encrypted.</p>
                    <div className="flex items-center gap-2">
                      <Btn size="sm" variant="secondary" onClick={loadBackups}>Refresh</Btn>
                      <Btn size="sm" variant="secondary" onClick={() => triggerBackup('incremental')}>Incremental</Btn>
                      <Btn size="sm" onClick={() => triggerBackup('full')}>Full Backup</Btn>
                    </div>
                  </div>
                  {backupsLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
                  ) : (
                    <Table
                      cols={[
                        { key: 'started_at',           label: 'Started',    render: v => fmtDateTime(v) },
                        { key: 'type',                 label: 'Type',       render: v => <span className="capitalize">{v}</span> },
                        { key: 'status',               label: 'Status',     render: v => <Badge status={v === 'completed' ? 'ACTIVE' : v === 'failed' ? 'SUSPENDED' : 'PENDING'} /> },
                        { key: 'completed_at',         label: 'Completed',  render: v => v ? fmtDateTime(v) : '—' },
                        { key: 'size_bytes',           label: 'Size',       render: v => v ? `${(v / 1024 / 1024).toFixed(1)} MB` : '—' },
                        { key: 'encryption_algorithm', label: 'Encryption' },
                        { key: 'error_message',        label: 'Error',      render: v => v ? <span className="text-xs text-red-500">{v}</span> : '—' },
                      ]}
                      rows={backups}
                      empty="No backup records"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Config ── */}
          {topTab === 'config' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 mb-4">Commitment amounts and service pricing. All changes require CEO confirmation before taking effect.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Full Payment Commitment', value: 'KSh 500',   desc: 'Lead Activated' },
                  { label: '50/50 Commitment',        value: 'KSh 750',   desc: 'Lead Qualified' },
                  { label: 'Milestone Commitment',    value: 'KSh 1,000', desc: 'Lead Qualified' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-slate-100 p-4" style={{ background: '#f8fafc' }}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{item.label}</p>
                    <p className="text-xl font-bold text-slate-900">{item.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl border border-amber-100 bg-amber-50 text-sm text-amber-700 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                To change pricing, use the Finance → Service Amounts section. Changes are held as pending until you confirm.
              </div>
            </div>
          )}

          {/* ── Portals ── */}
          {topTab === 'portals' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-2">Enable or disable portal access system-wide. Disabled portals return 503 to all users.</p>
              {PORTALS.map(p => {
                const ps = portalStates[p.url] ?? { enabled: true, toggling: false };
                const toggle = async () => {
                  setPortalStates(prev => ({ ...prev, [p.url]: { ...prev[p.url] ?? { enabled: true }, toggling: true } }));
                  try {
                    await apiClient.post(`/api/v1/admin/portals/${p.url.replace('/', '')}/toggle`, { enabled: !ps.enabled });
                    setPortalStates(prev => ({ ...prev, [p.url]: { enabled: !ps.enabled, toggling: false } }));
                  } catch {
                    setPortalStates(prev => ({ ...prev, [p.url]: { ...prev[p.url] ?? { enabled: true }, toggling: false } }));
                  }
                };
                return (
                  <div key={p.url} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{p.url}</code>
                        <span className="ml-2">{p.roles}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge status={ps.enabled ? 'ACTIVE' : 'SUSPENDED'} />
                      {p.url !== '/gatewayalpha' && (
                        <Btn size="sm" variant={ps.enabled ? 'danger' : 'secondary'} disabled={ps.toggling} onClick={toggle}>
                          {ps.toggling ? '…' : ps.enabled ? 'Disable' : 'Enable'}
                        </Btn>
                      )}
                      {p.url === '/gatewayalpha' && (
                        <span className="text-xs text-slate-400 italic">Cannot disable CEO portal</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── System Health ── */}
          {topTab === 'health' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Live system health status.</p>
                <Btn size="sm" variant="secondary" onClick={() => apiClient.get('/api/v1/admin/health').then(r => setHealth((r.data as any).data)).catch(() => {})}>Refresh</Btn>
              </div>
              {!health ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Overall Status', value: health.status === 'healthy' ? '✓ Healthy' : '⚠ Degraded', color: health.status === 'healthy' ? C.green : C.amber },
                    { label: 'Uptime',         value: `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`, color: C.blue2 },
                    { label: 'Memory',         value: `${health.memoryMb} MB`, color: C.purple },
                    { label: 'Database',       value: health.database?.ok ? `✓ ${health.database.responseMs}ms` : '✗ Down', color: health.database?.ok ? C.green : C.red },
                    { label: 'Cache (Redis)',  value: health.cache?.ok ? `✓ ${health.cache.responseMs}ms` : '✗ Down', color: health.cache?.ok ? C.green : C.red },
                    { label: 'Checked At',    value: health.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : '—', color: C.muted },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl border border-slate-100 p-4" style={{ background: '#f8fafc' }}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{item.label}</p>
                      <p className="text-base font-bold" style={{ color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── API & Integrations ── */}
          {topTab === 'integrations' && (
            <div className="space-y-6">
              {intMsg && <div className="p-3 rounded-xl text-sm bg-green-50 text-green-700">{intMsg}</div>}

              {/* CEO backup email — doc §25 security alert */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">CEO Security Alert — Backup Email</p>
                <p className="text-xs text-slate-400 mb-3">This email receives an immediate alert every time the CEO account logs in (doc §25).</p>
                <div className="flex gap-2 max-w-md">
                  <input type="email" value={backupEmail} onChange={e => setBackupEmail(e.target.value)}
                    placeholder="backup@example.com"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                  <Btn onClick={saveBackupEmail} disabled={backupEmail === backupEmailSaved}>Save</Btn>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* API keys */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">API Keys & Integration Settings</p>
                <p className="text-xs text-slate-400 mb-3">Values are masked for security. Click Edit to update a key.</p>
                <div className="space-y-2">
                  {integrations.length === 0 && <p className="text-sm text-slate-400">Loading…</p>}
                  {integrations.map((item: any) => (
                    <div key={item.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-600 font-mono">{item.key}</p>
                        {editIntKey === item.key ? (
                          <input autoFocus type="text" value={editIntVal} onChange={e => setEditIntVal(e.target.value)}
                            placeholder="Enter new value…"
                            className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5">{item.is_set ? '••••••••' : 'Not set'}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        {editIntKey === item.key ? (
                          <>
                            <Btn size="sm" onClick={() => saveIntegration(item.key)}>Save</Btn>
                            <Btn size="sm" variant="ghost" onClick={() => { setEditIntKey(null); setEditIntVal(''); }}>Cancel</Btn>
                          </>
                        ) : (
                          <Btn size="sm" variant="secondary" onClick={() => { setEditIntKey(item.key); setEditIntVal(''); }}>Edit</Btn>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function CEOPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');
  const [faqOpen, setFaqOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data, loading, refetch } = useMultiPortalData([
    { key: 'metrics',            endpoint: '/api/v1/dashboard/metrics',           fallback: {} },
    { key: 'serviceApprovals',   endpoint: '/api/v1/approvals/service-amounts',   fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.approvals || [] },
    { key: 'auditLog',           endpoint: '/api/v1/audit-logs',                  fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.logs || r.data || [] },
    { key: 'users',              endpoint: '/api/v1/users',                       fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.users || [] },
    { key: 'serviceAmounts',     endpoint: '/api/v1/service-amounts',             fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'paymentApprovals',   endpoint: '/api/v1/payments/approvals/pending',  fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || r.approvals || []) },
    { key: 'approvedPayments',   endpoint: '/api/v1/payments/approvals/approved-pending-execution', fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || r.approvals || []) },
    { key: 'techRequests',       endpoint: '/api/v1/tech-funding-requests',        fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'complianceReports',  endpoint: '/api/v1/reports/compliance',          fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'clients',            endpoint: '/api/v1/clients/all',                 fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.clients || [] },
    { key: 'properties',         endpoint: '/api/v1/plotconnect/properties?limit=200', fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.properties || [] },
    { key: 'projects',           endpoint: '/api/v1/projects?limit=200',              fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.projects || r.data || [] },
    { key: 'repos',              endpoint: '/api/v1/github/repos',                fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'commissions',        endpoint: '/api/v1/commissions',                 fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'contracts',          endpoint: '/api/v1/contracts',                   fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.contracts || r.data || [] },
    { key: 'teams',              endpoint: '/api/v1/organization/teams',           fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'notifications',      endpoint: '/api/v1/notifications/sent',          fallback: [], transform: (r: any) => {
      const rows = Array.isArray(r) ? r : (r.notifications || r.data || []);
      return rows.map((n: any) => ({
        ...n,
        scheduledAt: n.scheduledAt ?? n.scheduled_at ?? null,
        createdAt:   n.createdAt   ?? n.created_at   ?? null,
      }));
    }},
    { key: 'dailyReports',       endpoint: '/api/v1/reports/team?limit=500',      fallback: [], transform: (r: any) => {
      // /api/reports/team returns { reports: [...], total: N }
      // /api/v1/daily-reports/team returns { success: true, data: [...] }
      const rows = Array.isArray(r) ? r : (r.reports || r.data || []);
      // Normalise snake_case raw rows (from dailyReportRoutes) to camelCase
      return rows.map((row: any) => ({
        ...row,
        userName:       row.userName       ?? row.full_name   ?? row.user_name   ?? undefined,
        userEmail:      row.userEmail      ?? row.email       ?? undefined,
        userRole:       row.userRole       ?? row.role        ?? undefined,
        userDepartment: row.userDepartment ?? row.department  ?? undefined,
        reportDate:     row.reportDate     ?? row.report_date ?? undefined,
        tomorrowPlan:   row.tomorrowPlan   ?? row.tomorrow_plan ?? undefined,
        hoursWorked:    row.hoursWorked    ?? row.hours_worked  ?? undefined,
        submittedAt:    row.submittedAt    ?? row.submitted_at  ?? undefined,
      }));
    }}
  ] as any, [
    'data:client:created', 'data:client:updated', 'data:client:status_changed',
    'data:payment:created', 'data:payment:approved', 'data:payment:rejected', 'data:payment:executed',
    'data:project:created', 'data:project:updated', 'data:lead:converted',
    'data:metrics:updated', 'data:notification:new', 'data:service_amount:changed',
    'data:contract:generated', 'data:report:submitted',
  ]);

  const d = data as any;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading CEO Portal…</p>
        </div>
      </div>
    );
  }

  if (!user) { navigate('/login'); return null; }

  const pendingCount = (Array.isArray(d.serviceApprovals) ? d.serviceApprovals.filter((a: any) => a.status === 'PENDING' || a.status === 'PENDING_APPROVAL').length : 0)
                     + (Array.isArray(d.paymentApprovals)  ? d.paymentApprovals.filter((p: any) => p.status === 'PENDING_APPROVAL').length : 0)
                     + (Array.isArray(d.techRequests)       ? d.techRequests.filter((t: any) => t.status === 'PENDING').length : 0);

  const handleLogout = () => { logout(); navigate('/login'); };

  const sectionProps = { data: d, refetch, currentUserId: user?.id };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar
        section={section}
        setSection={(s) => { setSection(s); setMobileOpen(false); }}
        pendingCount={pendingCount}
        user={user}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar section={section} onFaqOpen={() => setFaqOpen(true)} onMenuToggle={() => setMobileOpen(o => !o)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {section === 'overview'       && <OverviewSection      {...sectionProps} />}
          {section === 'finance'        && <FinanceSection       {...sectionProps} />}
          {section === 'sales'          && <SalesSection         {...sectionProps} />}
          {section === 'operations'     && <OperationsSection    {...sectionProps} />}
          {section === 'people'         && <PeopleSection        {...sectionProps} />}
          {section === 'contracts'      && <ContractsSection     {...sectionProps} />}
          {section === 'approvals'      && <ApprovalsSection     {...sectionProps} />}
          {section === 'reports'        && <ReportsSection       {...sectionProps} />}
          {section === 'notifications'  && <NotificationsSection {...sectionProps} />}
          {section === 'chat'           && <ChatSection token={user.token} currentUserId={user.id} />}
          {section === 'admin'          && <AdminSection         {...sectionProps} />}
        </main>
      </div>

      {/* ── FAQ slide-in panel ─────────────────────────────────────────────── */}
      {faqOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setFaqOpen(false)} />
          <div className="relative w-full max-w-lg h-full flex flex-col bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0"
              style={{ borderTop: `3px solid ${C.blue2}` }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: C.blue2 }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Help & FAQ</h2>
                  <p className="text-[10px] text-slate-400">CEO Portal</p>
                </div>
              </div>
              <button onClick={() => setFaqOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                aria-label="Close FAQ">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <FAQPanel faqs={CEO_FAQS} accentColor={C.blue2} portalName="CEO Portal" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
