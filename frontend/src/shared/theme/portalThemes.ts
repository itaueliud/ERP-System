/**
 * TechSwiftTrix ERP — Portal Themes
 * Modern government-portal style: clean, flat, accessible.
 * Inspired by IEBC, HELB, eCitizen Kenya design language.
 *
 * Design principles:
 *  - Strong primary colors with clear hierarchy
 *  - White content areas, light gray backgrounds
 *  - Deep sidebar with white text
 *  - No glassmorphism — clean flat cards with subtle borders
 *  - Accessible contrast ratios (WCAG AA)
 */

export interface PortalTheme {
  id: string;
  name: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryText: string;
  primaryTextLight: string;
  accent: string;
  gradient: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarActive: string;
  sidebarActiveBg: string;
  headerBg: string;
  badgeBg: string;
  badgeText: string;
  hex: string;
  hexLight: string;
  // Extended tokens for modern design
  sidebarHex: string;      // sidebar background hex
  accentHex: string;       // accent/highlight hex
  borderHex: string;       // card border hex
  bgHex: string;           // page background hex
}

export const PORTAL_THEMES: Record<string, PortalTheme> = {

  // ── CEO — Deep Government Blue (like IEBC primary) ──────────────────────────
  ceo: {
    id: 'ceo',
    name: 'CEO Portal',
    primary: 'bg-blue-700',
    primaryHover: 'hover:bg-blue-800',
    primaryLight: 'bg-blue-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-blue-700',
    accent: 'bg-amber-500',
    gradient: 'from-blue-800 to-blue-950',
    sidebarBg: 'bg-blue-950',
    sidebarText: 'text-blue-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-blue-700',
    headerBg: 'bg-white',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white',
    hex: '#1d4ed8',
    hexLight: '#eff6ff',
    sidebarHex: '#0f2557',
    accentHex: '#f59e0b',
    borderHex: '#e2e8f0',
    bgHex: '#f8fafc',
  },

  // ── Executive (CFO/CoS/EA) — Charcoal/Slate (eCitizen header style) ─────────
  executive: {
    id: 'executive',
    name: 'Executive Portal',
    primary: 'bg-slate-800',
    primaryHover: 'hover:bg-slate-900',
    primaryLight: 'bg-slate-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-slate-800',
    accent: 'bg-teal-500',
    gradient: 'from-slate-800 to-slate-950',
    sidebarBg: 'bg-slate-900',
    sidebarText: 'text-slate-200',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-teal-600',
    headerBg: 'bg-white',
    badgeBg: 'bg-teal-500',
    badgeText: 'text-white',
    hex: '#0f766e',
    hexLight: '#f0fdfa',
    sidebarHex: '#1e293b',
    accentHex: '#0f766e',
    borderHex: '#e2e8f0',
    bgHex: '#f8fafc',
  },

  // ── C-Level (COO/CTO) — Forest Green (HELB green palette) ───────────────────
  clevel: {
    id: 'clevel',
    name: 'C-Level Portal',
    primary: 'bg-green-700',
    primaryHover: 'hover:bg-green-800',
    primaryLight: 'bg-green-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-green-700',
    accent: 'bg-amber-500',
    gradient: 'from-green-800 to-green-950',
    sidebarBg: 'bg-green-950',
    sidebarText: 'text-green-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-green-700',
    headerBg: 'bg-white',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white',
    hex: '#15803d',
    hexLight: '#f0fdf4',
    sidebarHex: '#052e16',
    accentHex: '#f59e0b',
    borderHex: '#e2e8f0',
    bgHex: '#f8fafc',
  },

  // ── Operations — Deep Teal (eCitizen Kenya teal) ─────────────────────────────
  operations: {
    id: 'operations',
    name: 'Operations Portal',
    primary: 'bg-teal-700',
    primaryHover: 'hover:bg-teal-800',
    primaryLight: 'bg-teal-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-teal-700',
    accent: 'bg-orange-500',
    gradient: 'from-teal-800 to-teal-950',
    sidebarBg: 'bg-teal-950',
    sidebarText: 'text-teal-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-teal-700',
    headerBg: 'bg-white',
    badgeBg: 'bg-orange-500',
    badgeText: 'text-white',
    hex: '#0f766e',
    hexLight: '#f0fdfa',
    sidebarHex: '#042f2e',
    accentHex: '#f97316',
    borderHex: '#e2e8f0',
    bgHex: '#f8fafc',
  },

  // ── Technology — Indigo/Purple (modern tech portal) ──────────────────────────
  technology: {
    id: 'technology',
    name: 'Technology Portal',
    primary: 'bg-indigo-700',
    primaryHover: 'hover:bg-indigo-800',
    primaryLight: 'bg-indigo-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-indigo-700',
    accent: 'bg-cyan-500',
    gradient: 'from-indigo-800 to-indigo-950',
    sidebarBg: 'bg-indigo-950',
    sidebarText: 'text-indigo-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-indigo-700',
    headerBg: 'bg-white',
    badgeBg: 'bg-cyan-500',
    badgeText: 'text-white',
    hex: '#4338ca',
    hexLight: '#eef2ff',
    sidebarHex: '#1e1b4b',
    accentHex: '#06b6d4',
    borderHex: '#e2e8f0',
    bgHex: '#f8fafc',
  },

  // ── Agents — Warm Orange/Red (action-oriented, field agents) ─────────────────
  agents: {
    id: 'agents',
    name: 'Agents Portal',
    primary: 'bg-orange-600',
    primaryHover: 'hover:bg-orange-700',
    primaryLight: 'bg-orange-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-orange-700',
    accent: 'bg-blue-600',
    gradient: 'from-orange-700 to-red-900',
    sidebarBg: 'bg-orange-950',
    sidebarText: 'text-orange-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-orange-600',
    headerBg: 'bg-white',
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    hex: '#ea580c',
    hexLight: '#fff7ed',
    sidebarHex: '#431407',
    accentHex: '#2563eb',
    borderHex: '#e2e8f0',
    bgHex: '#f8fafc',
  },

  // ── Trainers — Deep Purple (training/education) ───────────────────────────────
  trainers: {
    id: 'trainers',
    name: 'Trainers Portal',
    primary: 'bg-purple-700',
    primaryHover: 'hover:bg-purple-800',
    primaryLight: 'bg-purple-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-purple-700',
    accent: 'bg-green-500',
    gradient: 'from-purple-800 to-purple-950',
    sidebarBg: 'bg-purple-950',
    sidebarText: 'text-purple-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-purple-700',
    headerBg: 'bg-white',
    badgeBg: 'bg-green-500',
    badgeText: 'text-white',
    hex: '#7c3aed',
    hexLight: '#f5f3ff',
    sidebarHex: '#2e1065',
    accentHex: '#22c55e',
    borderHex: '#e2e8f0',
    bgHex: '#f8fafc',
  },
};
