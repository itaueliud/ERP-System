import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExecutivePortal from './index';

vi.mock('../../shared/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'CFO User', email: 'cfo@tst.com', role: 'CFO' },
    logout: vi.fn(),
  }),
  getPortalForRole: () => '/executive',
}));

vi.mock('../../shared/utils/router', async () => {
  const actual = await vi.importActual<typeof import('../../shared/utils/router')>(
    '../../shared/utils/router'
  );
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../shared/utils/usePortalData', () => ({
  useMultiPortalData: () => ({
    data: { financialSummary: {}, paymentApprovals: [], complianceReports: [], notifications: [] },
    loading: false,
    isLive: false,
  }),
}));

describe('ExecutivePortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ExecutivePortal />);
    expect(document.body).toBeTruthy();
  });

  it('shows sidebar navigation items', () => {
    render(<ExecutivePortal />);
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Payment Approvals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Execute Payments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Compliance').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Notifications').length).toBeGreaterThan(0);
  });

  it('shows overview section by default', () => {
    render(<ExecutivePortal />);
    expect(screen.getByText('Financial Overview')).toBeInTheDocument();
  });

  it('shows "Demo data" indicator when API is unavailable', () => {
    render(<ExecutivePortal />);
    expect(screen.getByText(/Demo data/i)).toBeInTheDocument();
  });

  it('navigates to payment approvals section', () => {
    render(<ExecutivePortal />);
    fireEvent.click(screen.getAllByText('Payment Approvals')[0]);
    expect(screen.getAllByText('Payment Approvals').length).toBeGreaterThan(0);
  });

  it('shows empty approvals when no data', () => {
    render(<ExecutivePortal />);
    fireEvent.click(screen.getAllByText('Payment Approvals')[0]);
    expect(screen.getByText('No pending approvals')).toBeInTheDocument();
  });

  it('navigates to execute payments section', () => {
    render(<ExecutivePortal />);
    fireEvent.click(screen.getAllByText('Execute Payments')[0]);
    expect(screen.getAllByText('Execute Payments').length).toBeGreaterThan(0);
  });

  it('navigates to compliance section', () => {
    render(<ExecutivePortal />);
    fireEvent.click(screen.getAllByText('Compliance')[0]);
    expect(screen.getAllByText('Compliance Reports').length).toBeGreaterThan(0);
  });

  it('navigates to notifications section', () => {
    render(<ExecutivePortal />);
    fireEvent.click(screen.getAllByText('Notifications')[0]);
    expect(screen.getAllByText('Notifications').length).toBeGreaterThan(0);
  });

  it('does NOT show mock data strings', () => {
    render(<ExecutivePortal />);
    expect(screen.queryByText('Nairobi Tech Hub')).not.toBeInTheDocument();
    expect(screen.queryByText('Monthly Financial Summary')).not.toBeInTheDocument();
  });
});
