import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../../api/apiClient';

// ─── Role → Portal path mapping (spec §3 — gateway URL naming) ───────────────
// Portal 1: gatewayalpha — CEO only
// Portal 2: gatewaydelta — CoS, CFO, EA (RBA loads correct dashboard)
// Portal 3: gatewaysigma — COO, CTO (RBA loads correct dashboard)
// Portal 4: gatewaynexus — All 3 COO depts incl. HoT & Trainers (RBA loads correct dept)
// Portal 5: gatewayvertex — All 3 CTO depts + Developer teams (RBA loads correct dept)
// Portal 6: gatewaypulse — Agents only
export const ROLE_PORTAL_MAP: Record<string, string> = {
  CEO:                    '/gatewayalpha',
  CoS:                    '/gatewaydelta',
  CFO:                    '/gatewaydelta',
  CFO_ASSISTANT:          '/gatewaydelta',
  EA:                     '/gatewaydelta',
  COO:                    '/gatewaysigma',
  CTO:                    '/gatewaysigma',
  OPERATIONS_USER:        '/gatewaynexus',
  SALES_MANAGER:          '/gatewaynexus',
  HEAD_OF_TRAINERS:       '/gatewaynexus',  // Portal 4 — same as COO depts (spec §3 NB)
  TRAINER:                '/gatewaynexus',  // Portal 4 — same as COO depts (spec §3 NB)
  CLIENT_SUCCESS_USER:    '/gatewaynexus',
  ACCOUNT_EXECUTIVE:      '/gatewaynexus',
  SENIOR_ACCOUNT_MANAGER: '/gatewaynexus',
  MARKETING_USER:         '/gatewaynexus',
  MARKETING_OFFICER:      '/gatewaynexus',
  TECH_STAFF:        '/gatewayvertex',
  DEVELOPER:              '/gatewayvertex',
  AGENT:                  '/gatewaypulse',
};

/** @deprecated Each portal handles its own role-based routing. */
export function getPortalForRole(role: string): string {
  return ROLE_PORTAL_MAP[role] ?? '/';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  departmentId?: string;
  sessionId?: string;
  token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('tst_token');
    const userData = localStorage.getItem('tst_user');
    if (token && userData) {
      try {
        const parsed = JSON.parse(userData) as AuthUser;
        // Re-attach token in case it was stripped
        parsed.token = token;
        setUser(parsed);
        // Set default auth header
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch {
        localStorage.removeItem('tst_token');
        localStorage.removeItem('tst_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await apiClient.post('/api/v1/auth/login', { email, password });
      const { token, user: u, sessionId } = res.data;

      if (!token) {
        return { success: false, error: 'No token received from server' };
      }

      const authUser: AuthUser = {
        id: u.id,
        email: u.email,
        name: u.fullName || u.name || email,
        role: u.role,
        permissions: u.permissions || [],
        departmentId: u.departmentId,
        sessionId,
        token,
      };

      // Persist
      localStorage.setItem('tst_token', token);
      localStorage.setItem('tst_user', JSON.stringify(authUser));

      // Set default auth header for all future requests
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setUser(authUser);

      return { success: true };
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Login failed';
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem('tst_token');
    localStorage.removeItem('tst_user');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
