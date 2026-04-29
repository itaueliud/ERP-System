import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrainersPortal from './index';

vi.mock('../../shared/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Trainer User', email: 'trainer@tst.com', role: 'TRAINER' },
    logout: vi.fn(),
  }),
  getPortalForRole: () => '/trainers',
}));

vi.mock('../../shared/utils/router', async () => {
  const actual = await vi.importActual<typeof import('../../shared/utils/router')>(
    '../../shared/utils/router'
  );
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../shared/utils/usePortalData', () => ({
  useMultiPortalData: () => ({
    data: { summary: {}, courses: [], assignments: [], agentRecords: [] },
    loading: false,
    isLive: false,
  }),
}));

describe('TrainersPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<TrainersPortal />);
    expect(document.body).toBeTruthy();
  });

  it('shows sidebar navigation items', () => {
    render(<TrainersPortal />);
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Courses').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Assignments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agent Performance').length).toBeGreaterThan(0);
  });

  it('shows overview section by default', () => {
    render(<TrainersPortal />);
    expect(screen.getByText('Training Overview')).toBeInTheDocument();
  });

  it('shows "Demo data" indicator when API is unavailable', () => {
    render(<TrainersPortal />);
    expect(screen.getByText(/Demo data/i)).toBeInTheDocument();
  });

  it('navigates to courses section', () => {
    render(<TrainersPortal />);
    fireEvent.click(screen.getByText('Courses'));
    expect(screen.getByText('Course Management')).toBeInTheDocument();
  });

  it('navigates to assignments section', () => {
    render(<TrainersPortal />);
    fireEvent.click(screen.getByText('Assignments'));
    expect(screen.getByText('Course Assignments')).toBeInTheDocument();
  });

  it('shows empty assignments table when no data', () => {
    render(<TrainersPortal />);
    fireEvent.click(screen.getByText('Assignments'));
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('navigates to agent performance section', () => {
    render(<TrainersPortal />);
    fireEvent.click(screen.getAllByText('Agent Performance')[0]);
    expect(screen.getAllByText('Agent Performance').length).toBeGreaterThan(0);
  });

  it('does NOT show mock data strings', () => {
    render(<TrainersPortal />);
    expect(screen.queryByText('Advanced Sales Techniques')).not.toBeInTheDocument();
    expect(screen.queryByText('Amara Diallo')).not.toBeInTheDocument();
    expect(screen.queryByText('CRM System Mastery')).not.toBeInTheDocument();
  });
});
