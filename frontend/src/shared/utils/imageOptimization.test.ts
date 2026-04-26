import { describe, it, expect } from 'vitest';
import { cdnUrl, supportsWebP } from './imageOptimization';

// ── cdnUrl ────────────────────────────────────────────────────────────────────

describe('cdnUrl', () => {
  it('returns the path unchanged when no CDN base is provided', () => {
    expect(cdnUrl('/assets/logo.png')).toBe('/assets/logo.png');
  });

  it('prepends the CDN base to a relative path', () => {
    expect(cdnUrl('/assets/logo.png', 'https://cdn.example.com')).toBe(
      'https://cdn.example.com/assets/logo.png'
    );
  });

  it('handles CDN base with trailing slash', () => {
    expect(cdnUrl('/assets/logo.png', 'https://cdn.example.com/')).toBe(
      'https://cdn.example.com/assets/logo.png'
    );
  });

  it('handles path without leading slash', () => {
    expect(cdnUrl('assets/logo.png', 'https://cdn.example.com')).toBe(
      'https://cdn.example.com/assets/logo.png'
    );
  });

  it('returns empty-base path as-is', () => {
    expect(cdnUrl('/assets/logo.png', '')).toBe('/assets/logo.png');
  });
});

// ── supportsWebP ──────────────────────────────────────────────────────────────

describe('supportsWebP', () => {
  it('returns a boolean', () => {
    const result = supportsWebP();
    expect(typeof result).toBe('boolean');
  });
});
