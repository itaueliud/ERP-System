import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OperationsPortal from './index';

vi.mock('../../shared/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Ops User', email: 'ops@tst.com', role: 'OPERATIONS_USER' },
    logout: vi.fn(),
  }),
  getPortalForRole: () => '/operations',
}));

vi.mock('../../shared/utils/router', async () => {
  const actual = await vi.importActual<typeof import('../../shared/utils/router')>(
    '../../shared/utils/router'
  );
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../shared/utils/usePortalData', () => ({
  useMultiPortalData: () => ({
    data: { metrics: {}, clients: [], leads: [], properties: [] },
    loading: false,
    isLive: false,
  }),
}));

describe('OperationsPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<OperationsPortal />);
    expect(document.body).toBeTruthy();
  });

  it('shows sidebar navigation items', () => {
    render(<OperationsPortal />);
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Clients').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Leads').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pipeline').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Properties').length).toBeGreaterThan(0);
  });

  it('shows overview section by default', () => {
    render(<OperationsPortal />);
    expect(screen.getByText('Operations Overview')).toBeInTheDocument();
  });

  it('shows "Demo data" indicator when API is unavailable', () => {
    render(<OperationsPortal />);
    expect(screen.getByText(/Demo data/i)).toBeInTheDocument();
  });

  it('navigates to clients section', () => {
    render(<OperationsPortal />);
    fireEvent.click(screen.getByText('Clients'));
    expect(screen.getByText('Client Management')).toBeInTheDocument();
  });

  it('shows empty clients table when no data', () => {
    render(<OperationsPortal />);
    fireEvent.click(screen.getByText('Clients'));
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('navigates to leads section', () => {
    render(<OperationsPortal />);
    fireEvent.click(screen.getAllByText('Leads')[0]);
    expect(screen.getByText('Lead Management')).toBeInTheDocument();
  });

  it('navigates to pipeline section', () => {
    render(<OperationsPortal />);
    fireEvent.click(screen.getByText('Pipeline'));
    expect(screen.getByText('Sales Pipeline')).toBeInTheDocument();
  });

  it('navigates to properties section', () => {
    render(<OperationsPortal />);
    fireEvent.click(screen.getByText('Properties'));
    expect(screen.getByText('Property Listings')).toBeInTheDocument();
  });

  it('does NOT show mock data strings', () => {
    render(<OperationsPortal />);
    expect(screen.queryByText('Amara Diallo')).not.toBeInTheDocument();
    expect(screen.queryByText('Luxury Apartment - Westlands')).not.toBeInTheDocument();
  });
});
