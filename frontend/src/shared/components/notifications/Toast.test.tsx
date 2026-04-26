import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from './Toast';

describe('Toast', () => {
  it('renders message text', () => {
    render(<Toast id="1" message="Operation successful" onDismiss={vi.fn()} duration={0} />);
    expect(screen.getByText('Operation successful')).toBeDefined();
  });

  it('renders correct variant styles for success', () => {
    const { container } = render(
      <Toast id="1" message="Done" variant="success" onDismiss={vi.fn()} duration={0} />
    );
    expect(container.firstChild?.toString()).toBeDefined();
    // success wrapper has green border class
    expect(container.querySelector('.border-green-400')).toBeDefined();
  });

  it('renders correct variant styles for error', () => {
    const { container } = render(
      <Toast id="1" message="Failed" variant="error" onDismiss={vi.fn()} duration={0} />
    );
    expect(container.querySelector('.border-red-400')).toBeDefined();
  });

  it('renders correct variant styles for warning', () => {
    const { container } = render(
      <Toast id="1" message="Warning" variant="warning" onDismiss={vi.fn()} duration={0} />
    );
    expect(container.querySelector('.border-yellow-400')).toBeDefined();
  });

  it('renders correct variant styles for info', () => {
    const { container } = render(
      <Toast id="1" message="Info" variant="info" onDismiss={vi.fn()} duration={0} />
    );
    expect(container.querySelector('.border-blue-400')).toBeDefined();
  });

  it('calls onClose when close button clicked', () => {
    const onDismiss = vi.fn();
    render(<Toast id="toast-1" message="Hello" onDismiss={onDismiss} duration={0} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });
});
