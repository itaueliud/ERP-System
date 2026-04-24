import React, { useState } from 'react';
import type { PortalTheme } from '../../theme/portalThemes';
import { TSTEmblem } from '../TSTLogo';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export interface PortalUser {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface PortalLayoutProps {
  theme: PortalTheme;
  user: PortalUser;
  navItems: NavItem[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

// ─── Stat Card — Neumorphism ──────────────────────────────────────────────────

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; up: boolean };
  color?: string;
}

export function StatCard({ label, value, icon, trend, color = '#6d28d9' }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: 'linear-gradient(145deg, #f0f4ff, #e8ecf8)',
        boxShadow: '6px 6px 14px #c8cde0, -6px -6px 14px #ffffff',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && (
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{
              background: `linear-gradient(135deg, ${color}dd, ${color})`,
              boxShadow: `0 4px 12px ${color}55`,
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {trend && (
          <span
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
              trend.up ? 'text-emerald-600' : 'text-red-500'
            }`}
            style={{
              background: trend.up ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              boxShadow: trend.up ? 'inset 1px 1px 3px rgba(16,185,129,0.2)' : 'inset 1px 1px 3px rgba(239,68,68,0.2)',
            }}
          >
            {trend.up ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Portal Button — Glassmorphism primary / Neumorphism secondary ────────────

export function PortalButton({
  children, onClick, variant = 'primary', size = 'md', color, disabled, fullWidth, icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };

  const getStyle = (): React.CSSProperties => {
    if (disabled) return {};
    if (variant === 'primary' && color) {
      return {
        background: `linear-gradient(135deg, ${color}ee, ${color})`,
        boxShadow: `0 4px 15px ${color}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
        backdropFilter: 'blur(8px)',
      };
    }
    if (variant === 'secondary') {
      return {
        background: 'linear-gradient(145deg, #f0f4ff, #e8ecf8)',
        boxShadow: '4px 4px 8px #c8cde0, -4px -4px 8px #ffffff',
      };
    }
    if (variant === 'danger') {
      return {
        background: 'linear-gradient(135deg, #ef4444dd, #dc2626)',
        boxShadow: '0 4px 12px rgba(239,68,68,0.35)',
      };
    }
    return {};
  };

  const baseClass = `inline-flex items-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none
    ${sizes[size]}
    ${fullWidth ? 'w-full justify-center' : ''}
    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.97]'}
    ${variant === 'primary' ? 'text-white' : ''}
    ${variant === 'secondary' ? 'text-gray-700' : ''}
    ${variant === 'ghost' ? 'text-gray-600 hover:bg-white/60' : ''}
    ${variant === 'danger' ? 'text-white' : ''}
  `;

  return (
    <button onClick={onClick} disabled={disabled} style={getStyle()} className={baseClass}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

// ─── Data Table — Glass card ──────────────────────────────────────────────────

export function DataTable<T extends Record<string, any>>({
  columns, rows, emptyMessage = 'No data',
}: {
  columns: { key: string; label: string; render?: (val: any, row: T) => React.ReactNode }[];
  rows: T[];
  emptyMessage?: string;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(248,250,255,0.9)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {columns.map((col) => (
                <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-gray-400">{emptyMessage}</td>
              </tr>
            ) : rows.map((row, i) => (
              <tr
                key={i}
                className="transition-colors"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.9)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-700">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    ACTIVE:              ['rgba(16,185,129,0.12)',  '#059669'],
    COMPLETED:           ['rgba(59,130,246,0.12)',  '#2563eb'],
    PENDING:             ['rgba(245,158,11,0.12)',  '#d97706'],
    PENDING_APPROVAL:    ['rgba(245,158,11,0.12)',  '#d97706'],
    FAILED:              ['rgba(239,68,68,0.12)',   '#dc2626'],
    CANCELLED:           ['rgba(107,114,128,0.12)', '#6b7280'],
    LEAD:                ['rgba(139,92,246,0.12)',  '#7c3aed'],
    PROJECT:             ['rgba(59,130,246,0.12)',  '#2563eb'],
    QUALIFIED_LEAD:      ['rgba(99,102,241,0.12)',  '#4f46e5'],
    PENDING_COMMITMENT:  ['rgba(249,115,22,0.12)',  '#ea580c'],
    IN_PROGRESS:         ['rgba(6,182,212,0.12)',   '#0891b2'],
    NOT_STARTED:         ['rgba(107,114,128,0.12)', '#6b7280'],
    VERIFIED:            ['rgba(16,185,129,0.12)',  '#059669'],
    FILED:               ['rgba(16,185,129,0.12)',  '#059669'],
    DRAFT:               ['rgba(107,114,128,0.12)', '#6b7280'],
    APPROVED:            ['rgba(16,185,129,0.12)',  '#059669'],
    REJECTED:            ['rgba(239,68,68,0.12)',   '#dc2626'],
    SUSPENDED:           ['rgba(239,68,68,0.12)',   '#dc2626'],
  };
  const [bg, text] = map[status] ?? ['rgba(107,114,128,0.12)', '#6b7280'];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: text, border: `1px solid ${text}22` }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Portal Layout ────────────────────────────────────────────────────────────

export function PortalLayout({ theme, user, navItems, activeSection, onSectionChange, onLogout, children }: PortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user.name, email: user.email });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const showLabels = sidebarOpen || mobileOpen;

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg('');
    try {
      const { apiClient } = await import('../../api/apiClient');
      await apiClient.put('/api/v1/users/me', { fullName: profileForm.name });
      setProfileMsg('Profile updated!');
    } catch { setProfileMsg('Failed to save'); }
    finally { setProfileSaving(false); }
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 20% 50%, ${theme.hex}18 0%, transparent 60%),
                     radial-gradient(ellipse at 80% 20%, ${theme.hex}10 0%, transparent 50%),
                     linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #f5f0ff 100%)`,
      }}
    >
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar — Glassmorphism */}
      <aside
        className={`fixed lg:relative z-[60] lg:z-auto flex flex-col h-full transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'lg:w-64' : 'lg:w-16'} w-64
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{
          background: `linear-gradient(160deg, ${theme.hex}f0 0%, ${theme.hex}cc 100%)`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
        }}
        aria-label="Sidebar navigation"
        id="portal-sidebar"
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <TSTEmblem size={showLabels ? 36 : 28} className="flex-shrink-0" />
          {showLabels && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>TechSwiftTrix</p>
              <p className="text-white/60 text-xs truncate">{theme.name}</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {navItems.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <button
                key={item.id}
                onClick={() => { onSectionChange(item.id); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200 text-sm font-medium`}
                style={isActive ? {
                  background: 'rgba(255,255,255,0.22)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.1)',
                  color: 'white',
                } : {
                  color: 'rgba(255,255,255,0.7)',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                title={!showLabels ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>
                {showLabels && <span className="flex-1 text-left truncate">{item.label}</span>}
                {showLabels && item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center"
                    style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <div className={`flex items-center gap-3 ${showLabels ? '' : 'justify-center'}`}>
            <button
              onClick={() => setProfileOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold hover:opacity-80 transition-opacity"
              style={{ background: 'rgba(255,255,255,0.25)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }}
              title="View profile"
            >
              {initials}
            </button>
            {showLabels && (
              <div className="flex-1 overflow-hidden cursor-pointer" onClick={() => setProfileOpen(true)}>
                <p className="text-white text-xs font-medium truncate">{user.name}</p>
                <p className="text-white/50 text-xs truncate">{user.role}</p>
              </div>
            )}
            {showLabels && onLogout && (
              <button onClick={onLogout}
                className="text-white/50 hover:text-white transition-colors p-1 rounded"
                title="Sign out" aria-label="Sign out">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          style={{
            background: 'linear-gradient(145deg, #f0f4ff, #e8ecf8)',
            boxShadow: '3px 3px 6px #c8cde0, -3px -3px 6px #ffffff',
            border: '1px solid rgba(255,255,255,0.8)',
          }}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <svg className={`w-3 h-3 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header — Glassmorphism */}
        <header
          className="h-16 flex items-center px-4 gap-4 flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
          }}
        >
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="lg:hidden p-2 rounded-xl text-gray-500 transition-all"
            style={{
              background: 'linear-gradient(145deg, #f0f4ff, #e8ecf8)',
              boxShadow: '3px 3px 6px #c8cde0, -3px -3px 6px #ffffff',
            }}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="portal-sidebar"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Portal name pill — glass */}
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${theme.hex}dd, ${theme.hex})`,
              boxShadow: `0 2px 8px ${theme.hex}44`,
            }}
          >
            {theme.name}
          </span>

          <div className="flex-1" />

          {/* Notifications bell — neumorphic */}
          <button
            className="relative p-2 rounded-xl text-gray-500 transition-all"
            style={{
              background: 'linear-gradient(145deg, #f0f4ff, #e8ecf8)',
              boxShadow: '3px 3px 6px #c8cde0, -3px -3px 6px #ffffff',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* User avatar — clickable to open profile */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setProfileOpen(true)}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity"
              style={{
                background: `linear-gradient(135deg, ${theme.hex}dd, ${theme.hex})`,
                boxShadow: `0 3px 10px ${theme.hex}44, inset 0 1px 0 rgba(255,255,255,0.3)`,
              }}
            >
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-400">{user.role}</p>
            </div>
          </div>
        </header>

        {/* Profile slide-over panel */}
        {profileOpen && (
          <div className="fixed inset-0 z-[70] flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setProfileOpen(false)} />
            <div
              className="relative w-full max-w-sm h-full flex flex-col overflow-y-auto"
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
              }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">My Profile</h2>
                <button onClick={() => setProfileOpen(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Avatar */}
              <div className="flex flex-col items-center py-8 px-6 border-b border-gray-100">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3"
                  style={{
                    background: `linear-gradient(135deg, ${theme.hex}dd, ${theme.hex})`,
                    boxShadow: `0 8px 24px ${theme.hex}44`,
                  }}
                >
                  {initials}
                </div>
                <p className="text-lg font-bold text-gray-900">{user.name}</p>
                <span
                  className="mt-1 text-xs font-semibold px-3 py-1 rounded-full text-white"
                  style={{ background: theme.hex }}
                >
                  {user.role}
                </span>
              </div>

              {/* Profile fields */}
              <div className="flex-1 px-6 py-6 flex flex-col gap-4">
                {profileMsg && (
                  <div className={`p-3 rounded-xl text-sm ${profileMsg.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {profileMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{ background: 'linear-gradient(145deg, #e8ecf8, #f0f4ff)', boxShadow: 'inset 3px 3px 6px #c8cde0, inset -3px -3px 6px #ffffff', border: 'none' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    readOnly
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                    style={{ background: 'linear-gradient(145deg, #e8ecf8, #f0f4ff)', boxShadow: 'inset 3px 3px 6px #c8cde0, inset -3px -3px 6px #ffffff', border: 'none' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role</label>
                  <div
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-gray-600"
                    style={{ background: 'linear-gradient(145deg, #e8ecf8, #f0f4ff)', boxShadow: 'inset 3px 3px 6px #c8cde0, inset -3px -3px 6px #ffffff' }}
                  >
                    {user.role}
                  </div>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 mt-2"
                  style={{ background: `linear-gradient(135deg, ${theme.hex}dd, ${theme.hex})`, boxShadow: `0 4px 15px ${theme.hex}44` }}
                >
                  {profileSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

              {/* Sign out */}
              {onLogout && (
                <div className="px-6 pb-6">
                  <button
                    onClick={() => { setProfileOpen(false); onLogout(); }}
                    className="w-full py-3 rounded-xl text-red-600 font-semibold text-sm border border-red-100 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default PortalLayout;
