import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentsPortal from './index';

// Mock auth context
vi.mock('../../shared/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Agent User', email: 'agent@tst.com', role: 'AGENT' },
    logout: vi.fn(),
  }),
  getPortalForRole: () => '/agents',
}));

// Mock router navigate
vi.mock('../../shared/utils/router', async () => {
  const actual = await vi.importActual<typeof import('../../shared/utils/router')>(
    '../../shared/utils/router'
  );
  return { ...actual, useNavigate: () => vi.fn() };
});

// Mock apiClient for form submissions
vi.mock('../../shared/api/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../shared/api/apiClient')>(
    '../../shared/api/apiClient'
  );
  return {
    ...actual,
    apiClient: {
      post: vi.fn().mockResolvedValue({ data: { id: 'new-client-id' } }),
      get: vi.fn().mockResolvedValue({ data: [] }),
      defaults: { headers: { common: {} } },
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
  };
});

// Mock useMultiPortalData — returns empty data (no mock data)
vi.mock('../../shared/utils/usePortalData', () => ({
  useMultiPortalData: () => ({
    data: { performance: {}, clients: [], commissions: [], training: [] },
    loading: false,
    isLive: false,
  }),
}));

describe('AgentsPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AgentsPortal />);
    expect(document.body).toBeTruthy();
  });

  it('shows the sidebar navigation items', () => {
    render(<AgentsPortal />);
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Capture Client').length).toBeGreaterThan(0);
    expect(screen.getAllByText('My Clients').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Commissions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Training').length).toBeGreaterThan(0);
  });

  it('shows overview section by default', () => {
    render(<AgentsPortal />);
    expect(screen.getByText('Agent Dashboard')).toBeInTheDocument();
  });

  it('shows "Demo data" indicator when API is unavailable', () => {
    render(<AgentsPortal />);
    expect(screen.getByText(/Demo data/i)).toBeInTheDocument();
  });

  it('navigates to capture client section', () => {
    render(<AgentsPortal />);
    fireEvent.click(screen.getByText('Capture Client'));
    expect(screen.getByText('Capture New Client')).toBeInTheDocument();
  });

  it('capture form renders all required fields', () => {
    render(<AgentsPortal />);
    fireEvent.click(screen.getByText('Capture Client'));
    expect(screen.getByPlaceholderText('Client full name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('client@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+254 7XX XXX XXX')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Kenya')).toBeInTheDocument();
    expect(screen.getByText('Register Client')).toBeInTheDocument();
  });

  it('capture form fields have required attribute', () => {
    render(<AgentsPortal />);
    fireEvent.click(screen.getByText('Capture Client'));
    const nameInput = screen.getByPlaceholderText('Client full name');
    const emailInput = screen.getByPlaceholderText('client@example.com');
    expect(nameInput).toHaveAttribute('required');
    expect(emailInput).toHaveAttribute('required');
  });

  it('navigates to my clients section', () => {
    render(<AgentsPortal />);
    fireEvent.click(screen.getAllByText('My Clients')[0]);
    expect(screen.getAllByText('My Clients').length).toBeGreaterThan(0);
  });

  it('shows empty clients table when no data', () => {
    render(<AgentsPortal />);
    fireEvent.click(screen.getAllByText('My Clients')[0]);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('navigates to commissions section', () => {
    render(<AgentsPortal />);
    fireEvent.click(screen.getByText('Commissions'));
    expect(screen.getByText('My Commissions')).toBeInTheDocument();
  });

  it('navigates to training section', () => {
    render(<AgentsPortal />);
    fireEvent.click(screen.getByText('Training'));
    expect(screen.getByText('My Training')).toBeInTheDocument();
  });

  it('does NOT show mock data strings', () => {
    render(<AgentsPortal />);
    expect(screen.queryByText('Amara Diallo')).not.toBeInTheDocument();
    expect(screen.queryByText('Nadia Benali')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced Sales Techniques')).not.toBeInTheDocument();
  });
});
