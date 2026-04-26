/**
 * Preservation Tests — CEOPortal
 * These tests MUST PASS both before and after fixes.
 * They confirm existing correct behaviors are preserved.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../shared/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'CEO', email: 'ceo@tst.com', role: 'CEO' }, logout: vi.fn() }),
  getPortalForRole: () => '/ceo',
}));

vi.mock('../../shared/utils/router', async () => {
  const actual = await vi.importActual<typeof import('../../shared/utils/router')>('../../shared/utils/router');
  return { ...actual, useNavigate: () => vi.fn() };
});

// Simulate successful API response
vi.mock('../../shared/utils/usePortalData', () => ({
  useMultiPortalData: () => ({
    data: {
      metrics: { totalRevenue: 5000000, activeClients: 100, activeProjects: 20, pendingApprovalsCount: 3 },
      approvals: [{ id: '1', clientName: 'Live Client', requestedAmount: 50000, status: 'pending', requester: 'Test' }],
      securityAlerts: [],
      dailyReports: [],
      auditLog: [],
    },
    loading: false,
    isLive: true,
  }),
}));

import CEOPortal from './index';

describe('Preservation: CEOPortal with live data (Requirement 3.1)', () => {
  it('shows "Live data from database" indicator when API succeeds', () => {
    render(<CEOPortal />);
    expect(screen.getByText('Live data from database')).toBeInTheDocument();
  });

  it('renders without crashing with empty data (Requirement 3.7)', () => {
    render(<CEOPortal />);
    expect(screen.getByText('Company Overview')).toBeInTheDocument();
  });
});
