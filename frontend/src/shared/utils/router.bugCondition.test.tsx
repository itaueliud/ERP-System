/**
 * Bug Condition Exploration Tests — Navigate component deps
 * These tests MUST FAIL on unfixed code (failure confirms bugs exist).
 * After fixes are applied, they MUST PASS.
 */

import { render, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// We test the Navigate component in isolation
// Import the actual router module
import { BrowserRouter, Navigate } from './router';

describe('Bug Condition: Navigate Missing Deps (Fix 6)', () => {
  it('should re-navigate when "to" prop changes — FAILS on unfixed code', async () => {

    // Wrap in BrowserRouter to provide context
    function TestComponent({ destination }: { destination: string }) {
      return (
        <BrowserRouter>
          <Navigate to={destination} replace />
        </BrowserRouter>
      );
    }

    const { rerender } = render(<TestComponent destination="/a" />);

    // Initial navigation to /a
    expect(window.location.pathname).toBe('/a');

    // Update destination to /b
    await act(async () => {
      rerender(<TestComponent destination="/b" />);
    });

    // After fix: should navigate to /b
    // Before fix: stays at /a (effect only ran once)
    expect(window.location.pathname).toBe('/b');
  });
});
