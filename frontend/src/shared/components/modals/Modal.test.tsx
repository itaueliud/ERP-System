import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders children when open=true', () => {
    render(<Modal open={true} onClose={vi.fn()}><p>Modal content</p></Modal>);
    expect(screen.getByText('Modal content')).toBeDefined();
  });

  it('does not render children when open=false', () => {
    render(<Modal open={false} onClose={vi.fn()}><p>Hidden content</p></Modal>);
    expect(screen.queryByText('Hidden content')).toBeNull();
  });

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn();
    render(<Modal open={true} onClose={onClose}><p>Content</p></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('has role="dialog" and aria-modal="true"', () => {
    render(<Modal open={true} onClose={vi.fn()}><p>Content</p></Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
});
