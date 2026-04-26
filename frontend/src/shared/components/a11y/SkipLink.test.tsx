import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink } from './SkipLink';

describe('SkipLink', () => {
  it('renders as an anchor tag', () => {
    render(<SkipLink />);
    expect(screen.getByRole('link')).toBeDefined();
  });

  it('has correct href pointing to main-content by default', () => {
    render(<SkipLink />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('#main-content');
  });

  it('renders custom label when provided', () => {
    render(<SkipLink label="Skip to navigation" />);
    expect(screen.getByText('Skip to navigation')).toBeDefined();
  });
});
