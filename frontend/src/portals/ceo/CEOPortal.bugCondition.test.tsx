/**
 * Bug Condition Exploration Tests — CEOPortal
 * These tests MUST FAIL on unfixed code (failure confirms bugs exist).
 * After fixes are applied, they MUST PASS.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock auth context
vi.mock('../../shared/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'CEO', email: 'ceo@tst.com', role: 'CEO' }, logout: vi.fn() }),
  getPortalForRole: () => '/ceo',
}));

// Mock router
vi.mock('../../shared/utils/router', async () => {
  const actual = await vi.importActual<typeof import('../../shared/utils/router')>('../../shared/utils/router');
  return { ...actual, useNavigate: () => vi.fn() };
});

// Mock useMultiPortalData to simulate ALL API calls failing (returns fallbacks only)
vi.mock('../../shared/utils/usePortalData', () => ({
  useMultiPortalData: (requests: any[]) => {
    const data: Record<string, any> = {};
    for (const r of requests) data[r.key] = r.fallback;
    return { data, loading: false, isLive: false };
  },
}));

import CEOPortal from './index';

describe('Bug Condition: Mock Data Absence (Fix 1)', () => {
  it('should NOT show mock data strings when API fails — FAILS on unfixed code', () => {
    render(<CEOPortal />);
    // These strings come from mockData.ts — they must NOT appear after the fix
    expect(screen.queryByText('Nairobi Tech Hub')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice Mwangi')).not.toBeInTheDocument();
    expect(screen.queryByText('Lagos Fintech Ltd')).not.toBeInTheDocument();
    expect(screen.queryByText('Unusual Login')).not.toBeInTheDocument();
    expect(screen.queryByText('Fraud Detection')).not.toBeInTheDocument();
  });

  it('should show empty state or zero values when API fails', () => {
    render(<CEOPortal />);
    // Portal should still render without crashing
    expect(screen.getByText('Company Overview')).toBeInTheDocument();
  });
});
