import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TechnologyPortal from './index';

vi.mock('../../shared/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Tech Lead', email: 'tech@tst.com', role: 'TECH_STAFF' },
    logout: vi.fn(),
  }),
  getPortalForRole: () => '/technology',
}));

vi.mock('../../shared/utils/router', async () => {
  const actual = await vi.importActual<typeof import('../../shared/utils/router')>(
    '../../shared/utils/router'
  );
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../shared/utils/usePortalData', () => ({
  useMultiPortalData: () => ({
    data: { summary: {}, projects: [], repos: [], commits: [], contributors: [] },
    loading: false,
    isLive: false,
  }),
}));

describe('TechnologyPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<TechnologyPortal />);
    expect(document.body).toBeTruthy();
  });

  it('shows sidebar navigation items', () => {
    render(<TechnologyPortal />);
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GitHub').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Developers').length).toBeGreaterThan(0);
  });

  it('shows overview section by default', () => {
    render(<TechnologyPortal />);
    expect(screen.getByText('Technology Overview')).toBeInTheDocument();
  });

  it('shows "Demo data" indicator when API is unavailable', () => {
    render(<TechnologyPortal />);
    expect(screen.getByText(/Demo data/i)).toBeInTheDocument();
  });

  it('navigates to projects section', () => {
    render(<TechnologyPortal />);
    fireEvent.click(screen.getByText('Projects'));
    expect(screen.getByText('Project Tracking')).toBeInTheDocument();
  });

  it('shows empty projects table when no data', () => {
    render(<TechnologyPortal />);
    fireEvent.click(screen.getByText('Projects'));
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('navigates to github section', () => {
    render(<TechnologyPortal />);
    fireEvent.click(screen.getByText('GitHub'));
    expect(screen.getByText('GitHub Integration')).toBeInTheDocument();
  });

  it('navigates to developers section', () => {
    render(<TechnologyPortal />);
    fireEvent.click(screen.getAllByText('Developers')[0]);
    expect(screen.getByText('Developer Metrics')).toBeInTheDocument();
  });

  it('does NOT show mock data strings', () => {
    render(<TechnologyPortal />);
    expect(screen.queryByText('TST ERP Backend')).not.toBeInTheDocument();
    expect(screen.queryByText('Nadia Benali')).not.toBeInTheDocument();
    expect(screen.queryByText('feat: add commission calculation service')).not.toBeInTheDocument();
  });
});
