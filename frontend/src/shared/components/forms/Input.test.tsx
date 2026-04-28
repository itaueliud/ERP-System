import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Username" id="username" />);
    expect(screen.getByLabelText('Username')).toBeDefined();
  });

  it('shows error message when error prop provided', () => {
    render(<Input label="Email" id="email" error="Email is required" />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Email is required')).toBeDefined();
  });

  it('associates label with input via htmlFor/id', () => {
    render(<Input label="Phone" id="phone" />);
    const input = screen.getByLabelText('Phone');
    expect(input.getAttribute('id')).toBe('phone');
  });

  it('calls onChange handler', () => {
    const onChange = vi.fn();
    render(<Input label="Name" id="name" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } });
    expect(onChange).toHaveBeenCalled();
  });
});
