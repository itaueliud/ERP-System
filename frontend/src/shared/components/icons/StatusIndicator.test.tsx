import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusIndicator } from './StatusIndicator';

describe('StatusIndicator', () => {
  it('renders label text', () => {
    render(<StatusIndicator status="success" label="All good" />);
    expect(screen.getByText('All good')).toBeDefined();
  });

  it('has role="status"', () => {
    render(<StatusIndicator status="info" />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('renders default label for success status', () => {
    render(<StatusIndicator status="success" />);
    expect(screen.getByText('Success')).toBeDefined();
  });

  it('renders default label for error status', () => {
    render(<StatusIndicator status="error" />);
    expect(screen.getByText('Error')).toBeDefined();
  });

  it('renders default label for pending status', () => {
    render(<StatusIndicator status="pending" />);
    expect(screen.getByText('Pending')).toBeDefined();
  });

  it('renders default label for inactive status', () => {
    render(<StatusIndicator status="inactive" />);
    expect(screen.getByText('Inactive')).toBeDefined();
  });
});
