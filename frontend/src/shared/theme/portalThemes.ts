/**
 * Portal-specific color themes — all derived from the TechSwiftTrix brand palette.
 *
 * Brand colors from the TST logo:
 *   Electric Blue  #1e90ff  (primary TST letter color)
 *   Cyan/Teal      #00d4ff  (mid-gradient)
 *   Lime Green     #84cc16  (right side of gradient)
 *   Gold           #eab308  (lens flare accent)
 *   Navy            #0a1628  (background)
 *
 * Each portal uses a distinct hue pulled from or inspired by the logo gradient.
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
}

export const PORTAL_THEMES: Record<string, PortalTheme> = {
  // CEO — Electric Blue (core TST letter color)
  ceo: {
    id: 'ceo',
    name: 'CEO Portal',
    primary: 'bg-blue-600',
    primaryHover: 'hover:bg-blue-700',
    primaryLight: 'bg-blue-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-blue-700',
    accent: 'bg-yellow-400',
    gradient: 'from-blue-700 to-blue-900',
    sidebarBg: 'bg-blue-950',
    sidebarText: 'text-blue-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-blue-600',
    headerBg: 'bg-blue-900',
    badgeBg: 'bg-yellow-400',
    badgeText: 'text-blue-900',
    hex: '#1e90ff',
    hexLight: '#eff6ff',
  },

  // Executive (CFO/CoS/EA) — Deep Navy (logo background)
  executive: {
    id: 'executive',
    name: 'Executive Portal',
    primary: 'bg-slate-800',
    primaryHover: 'hover:bg-slate-900',
    primaryLight: 'bg-slate-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-slate-800',
    accent: 'bg-cyan-400',
    gradient: 'from-slate-800 to-slate-950',
    sidebarBg: 'bg-slate-950',
    sidebarText: 'text-slate-200',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-slate-700',
    headerBg: 'bg-slate-900',
    badgeBg: 'bg-cyan-400',
    badgeText: 'text-slate-900',
    hex: '#0a1628',
    hexLight: '#f8fafc',
  },

  // C-Level (COO/CTO) — Cyan/Teal (mid-gradient of TST letters)
  clevel: {
    id: 'clevel',
    name: 'C-Level Portal',
    primary: 'bg-cyan-600',
    primaryHover: 'hover:bg-cyan-700',
    primaryLight: 'bg-cyan-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-cyan-700',
    accent: 'bg-lime-400',
    gradient: 'from-cyan-600 to-cyan-900',
    sidebarBg: 'bg-cyan-950',
    sidebarText: 'text-cyan-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-cyan-600',
    headerBg: 'bg-cyan-900',
    badgeBg: 'bg-lime-400',
    badgeText: 'text-cyan-900',
    hex: '#0891b2',
    hexLight: '#ecfeff',
  },

  // Operations — Lime Green (right side of TST gradient)
  operations: {
    id: 'operations',
    name: 'Operations Portal',
    primary: 'bg-lime-600',
    primaryHover: 'hover:bg-lime-700',
    primaryLight: 'bg-lime-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-lime-700',
    accent: 'bg-yellow-400',
    gradient: 'from-lime-600 to-green-800',
    sidebarBg: 'bg-green-950',
    sidebarText: 'text-lime-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-lime-600',
    headerBg: 'bg-green-900',
    badgeBg: 'bg-yellow-400',
    badgeText: 'text-green-900',
    hex: '#65a30d',
    hexLight: '#f7fee7',
  },

  // Technology — Bright Cyan (orbital ring color)
  technology: {
    id: 'technology',
    name: 'Technology Portal',
    primary: 'bg-sky-500',
    primaryHover: 'hover:bg-sky-600',
    primaryLight: 'bg-sky-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-sky-700',
    accent: 'bg-lime-400',
    gradient: 'from-sky-500 to-blue-800',
    sidebarBg: 'bg-sky-950',
    sidebarText: 'text-sky-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-sky-500',
    headerBg: 'bg-sky-900',
    badgeBg: 'bg-lime-400',
    badgeText: 'text-sky-900',
    hex: '#00d4ff',
    hexLight: '#f0f9ff',
  },

  // Agents — Gold/Amber (lens flare accent in logo)
  agents: {
    id: 'agents',
    name: 'Agents Portal',
    primary: 'bg-amber-500',
    primaryHover: 'hover:bg-amber-600',
    primaryLight: 'bg-amber-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-amber-700',
    accent: 'bg-lime-400',
    gradient: 'from-amber-500 to-orange-700',
    sidebarBg: 'bg-amber-950',
    sidebarText: 'text-amber-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-amber-500',
    headerBg: 'bg-amber-900',
    badgeBg: 'bg-lime-400',
    badgeText: 'text-amber-900',
    hex: '#eab308',
    hexLight: '#fefce8',
  },

  // Trainers — Emerald (complementary to the lime in the logo)
  trainers: {
    id: 'trainers',
    name: 'Trainers Portal',
    primary: 'bg-emerald-600',
    primaryHover: 'hover:bg-emerald-700',
    primaryLight: 'bg-emerald-50',
    primaryText: 'text-white',
    primaryTextLight: 'text-emerald-700',
    accent: 'bg-cyan-400',
    gradient: 'from-emerald-600 to-teal-800',
    sidebarBg: 'bg-emerald-950',
    sidebarText: 'text-emerald-100',
    sidebarActive: 'text-white',
    sidebarActiveBg: 'bg-emerald-600',
    headerBg: 'bg-emerald-900',
    badgeBg: 'bg-cyan-400',
    badgeText: 'text-emerald-900',
    hex: '#059669',
    hexLight: '#ecfdf5',
  },
};
