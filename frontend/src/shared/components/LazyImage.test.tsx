import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LazyImage } from './LazyImage';

describe('LazyImage', () => {
  it('renders an img element with the correct alt text', () => {
    render(<LazyImage src="/test.jpg" alt="Test image" />);
    const img = screen.getAllByRole('img').find((el) => el.getAttribute('alt') === 'Test image');
    expect(img).toBeDefined();
  });

  it('sets loading="lazy" on the img element', () => {
    render(<LazyImage src="/test.jpg" alt="Lazy test" />);
    const img = screen.getAllByRole('img').find((el) => el.getAttribute('alt') === 'Lazy test');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('sets decoding="async" on the img element', () => {
    render(<LazyImage src="/test.jpg" alt="Async test" />);
    const img = screen.getAllByRole('img').find((el) => el.getAttribute('alt') === 'Async test');
    expect(img?.getAttribute('decoding')).toBe('async');
  });

  it('prepends CDN base to relative src', () => {
    render(<LazyImage src="images/photo.jpg" alt="CDN test" cdnBase="https://cdn.example.com" />);
    const img = screen.getAllByRole('img').find((el) => el.getAttribute('alt') === 'CDN test');
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/images/photo.jpg');
  });

  it('does not modify absolute src when cdnBase is provided', () => {
    render(
      <LazyImage
        src="https://other.com/photo.jpg"
        alt="Absolute test"
        cdnBase="https://cdn.example.com"
      />
    );
    const img = screen.getAllByRole('img').find((el) => el.getAttribute('alt') === 'Absolute test');
    expect(img?.getAttribute('src')).toBe('https://other.com/photo.jpg');
  });
});
