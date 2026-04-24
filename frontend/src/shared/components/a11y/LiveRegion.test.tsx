import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveRegion } from './LiveRegion';

describe('LiveRegion', () => {
  it('renders with aria-live="polite" by default', () => {
    const { container } = render(<LiveRegion message="Loading..." />);
    expect(container.firstElementChild?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders with aria-live="assertive" when specified', () => {
    const { container } = render(<LiveRegion message="Error occurred" politeness="assertive" />);
    expect(container.firstElementChild?.getAttribute('aria-live')).toBe('assertive');
  });

  it('renders message text', () => {
    render(<LiveRegion message="Data saved successfully" />);
    expect(screen.getByText('Data saved successfully')).toBeDefined();
  });
});
