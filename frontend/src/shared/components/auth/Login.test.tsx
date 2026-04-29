import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Login } from './Login';

describe('Login', () => {
  it('renders email and password fields', () => {
    render(<Login onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
  });

  it('renders submit button', () => {
    render(<Login onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
  });

  it('calls onSubmit with credentials when form submitted', () => {
    const onSubmit = vi.fn();
    render(<Login onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('user@example.com', 'secret');
  });

  it('shows error message when error prop provided', () => {
    render(<Login onSubmit={vi.fn()} error="Invalid credentials" />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Invalid credentials')).toBeDefined();
  });
});
