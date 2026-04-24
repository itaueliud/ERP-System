import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CEOPortal from './index';

// Mock auth context
vi.mock('../../shared/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'CEO User', email: 'ceo@tst.com', role: 'CEO' },
    logout: vi.fn(),
  }),
  getPortalForRole: () => '/ceo',
}));

// Mock router navigate
vi.mock('../../shared/utils/router', async () => {
  const actual = await vi.importActual<typeof import('../../shared/utils/router')>(
    '../../shared/utils/router'
  );
  return { ...actual, useNavigate: () => vi.fn() };
});

// Mock useMultiPortalData — returns empty data (no mock data)
vi.mock('../../shared/utils/usePortalData', () => ({
  useMultiPortalData: () => ({
    data: { metrics: {}, approvals: [], securityAlerts: [], dailyReports: [], auditLog: [] },
    loading: false,
    isLive: false,
  }),
}));

describe('CEOPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CEOPortal />);
    expect(document.body).toBeTruthy();
  });

  it('shows the sidebar navigation items', () => {
    render(<CEOPortal />);
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Approvals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Daily Reports').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Security').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Audit Log').length).toBeGreaterThan(0);
  });

  it('shows overview section by default', () => {
    render(<CEOPortal />);
    expect(screen.getByText('Company Overview')).toBeInTheDocument();
  });

  it('shows "Demo data" indicator when API is unavailable', () => {
    render(<CEOPortal />);
    expect(screen.getByText(/Demo data/i)).toBeInTheDocument();
  });

  it('navigates to approvals section when clicking Approvals', () => {
    render(<CEOPortal />);
    fireEvent.click(screen.getByText('Approvals'));
    expect(screen.getByText('Service Amount Approvals')).toBeInTheDocument();
  });

  it('shows empty approvals table when no data', () => {
    render(<CEOPortal />);
    fireEvent.click(screen.getByText('Approvals'));
    expect(screen.getByText('No pending approvals')).toBeInTheDocument();
  });

  it('navigates to daily reports section', () => {
    render(<CEOPortal />);
    fireEvent.click(screen.getAllByText('Daily Reports')[0]);
    expect(screen.getAllByText('Daily Reports').length).toBeGreaterThan(0);
  });

  it('navigates to security section', () => {
    render(<CEOPortal />);
    fireEvent.click(screen.getAllByText('Security')[0]);
    expect(screen.getAllByText('Security Alerts').length).toBeGreaterThan(0);
  });

  it('navigates to audit log section', () => {
    render(<CEOPortal />);
    fireEvent.click(screen.getAllByText('Audit Log')[0]);
    expect(screen.getAllByText('Audit Log').length).toBeGreaterThan(0);
  });

  it('shows empty audit log when no data', () => {
    render(<CEOPortal />);
    fireEvent.click(screen.getAllByText('Audit Log')[0]);
    expect(screen.getByText('No audit entries')).toBeInTheDocument();
  });

  it('does NOT show mock data strings (Nairobi Tech Hub, Alice Mwangi)', () => {
    render(<CEOPortal />);
    expect(screen.queryByText('Nairobi Tech Hub')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice Mwangi')).not.toBeInTheDocument();
    expect(screen.queryByText('Lagos Fintech Ltd')).not.toBeInTheDocument();
  });
});

describe('CEOPortal with live data', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('shows "Live data from database" when API succeeds', async () => {
    vi.doMock('../../shared/utils/usePortalData', () => ({
      useMultiPortalData: () => ({
        data: {
          metrics: { totalRevenue: 5000000, activeClients: 100, activeProjects: 20, pendingApprovalsCount: 3 },
          approvals: [],
          securityAlerts: [],
          dailyReports: [],
          auditLog: [],
        },
        loading: false,
        isLive: true,
      }),
    }));

    const { default: CEOPortalLive } = await import('./index');
    render(<CEOPortalLive />);
    expect(screen.getByText('Live data from database')).toBeInTheDocument();
  });
});
