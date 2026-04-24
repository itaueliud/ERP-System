import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CLevelPortal from './index';

vi.mock('../../shared/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'COO User', email: 'coo@tst.com', role: 'COO' },
    logout: vi.fn(),
  }),
  getPortalForRole: () => '/clevel',
}));

vi.mock('../../shared/utils/router', async () => {
  const actual = await vi.importActual<typeof import('../../shared/utils/router')>(
    '../../shared/utils/router'
  );
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../shared/utils/usePortalData', () => ({
  useMultiPortalData: () => ({
    data: { summary: {}, departments: [], goals: [], team: [] },
    loading: false,
    isLive: false,
  }),
}));

describe('CLevelPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CLevelPortal />);
    expect(document.body).toBeTruthy();
  });

  it('shows sidebar navigation items', () => {
    render(<CLevelPortal />);
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Departments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Strategic Goals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Team Performance').length).toBeGreaterThan(0);
  });

  it('shows overview section by default', () => {
    render(<CLevelPortal />);
    expect(screen.getByText('C-Level Dashboard')).toBeInTheDocument();
  });

  it('shows "Demo data" indicator when API is unavailable', () => {
    render(<CLevelPortal />);
    expect(screen.getByText(/Demo data/i)).toBeInTheDocument();
  });

  it('navigates to departments section', () => {
    render(<CLevelPortal />);
    fireEvent.click(screen.getAllByText('Departments')[0]);
    expect(screen.getByText('Department Management')).toBeInTheDocument();
  });

  it('shows empty departments table when no data', () => {
    render(<CLevelPortal />);
    fireEvent.click(screen.getAllByText('Departments')[0]);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('navigates to strategic goals section', () => {
    render(<CLevelPortal />);
    fireEvent.click(screen.getAllByText('Strategic Goals')[0]);
    expect(screen.getAllByText('Strategic Goals').length).toBeGreaterThan(0);
  });

  it('navigates to team performance section', () => {
    render(<CLevelPortal />);
    fireEvent.click(screen.getAllByText('Team Performance')[0]);
    expect(screen.getAllByText('Team Performance').length).toBeGreaterThan(0);
  });

  it('does NOT show mock data strings', () => {
    render(<CLevelPortal />);
    expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice Mwangi')).not.toBeInTheDocument();
  });
});
