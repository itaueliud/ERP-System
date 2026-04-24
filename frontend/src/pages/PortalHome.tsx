import React from 'react';
import { useNavigate } from '../shared/utils/router';
import { PORTAL_THEMES } from '../shared/theme/portalThemes';
import TSTLogo from '../shared/components/TSTLogo';

const PORTALS = [
  { id: 'ceo',        path: '/gatewayalpha',  description: 'Company overview, approvals, achievements & audit trail', roles: ['CEO'],                                    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
  { id: 'executive',  path: '/gatewaydelta',  description: 'Financial oversight, payment approvals & compliance',     roles: ['CFO', 'CoS', 'EA'],                       icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
  { id: 'clevel',     path: '/gatewaysigma',  description: 'Department management, strategic planning & analytics',   roles: ['COO', 'CTO'],                             icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
  { id: 'operations', path: '/gatewaynexus',  description: 'Sales, client success, marketing, trainers & HoT',       roles: ['OPERATIONS_USER', 'HEAD_OF_TRAINERS', 'TRAINER'], icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { id: 'technology', path: '/gatewayvertex', description: 'Projects, GitHub integration & developer metrics',        roles: ['TECHNOLOGY_USER', 'DEVELOPER'],           icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
  { id: 'agents',     path: '/gatewaypulse',  description: 'Client capture, lead tracking & personal performance',    roles: ['AGENT'],                                  icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
];

const CREDS = [
  { role: 'CEO',          email: 'ceo@tst.com',          password: 'Ceo@123456789!',  path: '/gatewayalpha' },
  { role: 'CFO',          email: 'cfo@tst.com',          password: 'Cfo@123456789!',  path: '/gatewaydelta' },
  { role: 'CoS',          email: 'cos@tst.com',          password: 'Cos@123456789!',  path: '/gatewaydelta' },
  { role: 'EA',           email: 'ea@tst.com',           password: 'Ea@1234567890!',  path: '/gatewaydelta' },
  { role: 'COO',          email: 'coo@tst.com',          password: 'Coo@123456789!',  path: '/gatewaysigma' },
  { role: 'CTO',          email: 'cto@tst.com',          password: 'Cto@123456789!',  path: '/gatewaysigma' },
  { role: 'Operations',   email: 'ops@tst.com',          password: 'Ops@123456789!',  path: '/gatewaynexus' },
  { role: 'Head Trainer', email: 'headtrainer@tst.com',  password: 'Head@12345678!',  path: '/gatewaynexus' },
  { role: 'Trainer',      email: 'trainer@tst.com',      password: 'Train@1234567!',  path: '/gatewaynexus' },
  { role: 'Tech Lead',    email: 'tech@tst.com',         password: 'Tech@12345678!',  path: '/gatewayvertex' },
  { role: 'Developer',    email: 'dev@tst.com',          password: 'Dev@123456789!',  path: '/gatewayvertex' },
  { role: 'Agent',        email: 'agent@tst.com',        password: 'Agent@1234567!',  path: '/gatewaypulse' },
];

export default function PortalHome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <TSTLogo size="sm" showWordmark dark />
        <div className="ml-auto">
          <span className="text-xs text-white/30 font-mono">v1.0 · localhost:5173</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-3">Portal Directory</h2>
          <p className="text-white/50 text-base">Select your portal — you'll be redirected to the correct dashboard based on your role</p>
        </div>

        {/* Portal cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-12">
          {PORTALS.map((portal) => {
            const theme = PORTAL_THEMES[portal.id];
            return (
              <button
                key={portal.id}
                onClick={() => navigate(portal.path)}
                className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 rounded-2xl p-6 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {/* Color accent top bar */}
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: theme.hex }} />

                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white"
                  style={{ backgroundColor: theme.hex + '30', color: theme.hex }}>
                  {portal.icon}
                </div>

                <h3 className="text-white font-semibold text-base mb-1">{theme.name}</h3>
                <p className="text-white/50 text-xs leading-relaxed mb-4">{portal.description}</p>

                {/* Role pills */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {portal.roles.map((r) => (
                    <span key={r} className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: theme.hex + '25', color: theme.hex === '#334155' ? '#94a3b8' : theme.hex }}>
                      {r}
                    </span>
                  ))}
                </div>

                {/* URL badge */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white/30">{window.location.origin}{portal.path}</span>
                  <svg className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>

        {/* Credentials table */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            <h3 className="text-white font-semibold">Default Login Credentials</h3>
            <span className="ml-auto text-xs text-white/30">All accounts connect to the live PostgreSQL database</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">Password</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">Portal</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {CREDS.map((c) => {
                  const theme = PORTAL_THEMES[c.path.replace('/', '')];
                  return (
                    <tr key={c.email} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: theme?.hex + '25', color: theme?.hex === '#334155' ? '#94a3b8' : theme?.hex }}>
                          {c.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-white/70">{c.email}</td>
                      <td className="px-6 py-3 font-mono text-xs text-white/40">{c.password}</td>
                      <td className="px-6 py-3 font-mono text-xs text-white/30">{c.path}</td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => navigate(c.path)}
                          className="text-xs px-3 py-1.5 rounded-lg text-white font-medium transition-all hover:opacity-90"
                          style={{ backgroundColor: theme?.hex }}>
                          Open →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-white/20 text-xs">
          Backend API: <span className="font-mono">http://localhost:3000</span> · Frontend: <span className="font-mono">{window.location.origin}</span>
        </div>
      </div>
    </div>
  );
}
