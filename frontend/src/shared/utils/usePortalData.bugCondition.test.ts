/**
 * Bug Condition Exploration Tests — useMultiPortalData stale closure
 * These tests MUST FAIL on unfixed code (failure confirms bugs exist).
 * After fixes are applied, they MUST PASS.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to test the actual hook behavior
// Mock apiClient to control which calls succeed/fail
vi.mock('../api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

import { useMultiPortalData } from './usePortalData';
import { apiClient } from '../api/apiClient';

describe('Bug Condition: Stale Closure in useMultiPortalData (Fix 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('failed keys should contain fallback values, not undefined — FAILS on unfixed code', async () => {
    const mockGet = vi.mocked(apiClient.get);
    // First call succeeds, second fails
    mockGet
      .mockResolvedValueOnce({ data: { totalRevenue: 5000000 } })
      .mockRejectedValueOnce(new Error('Network error'));

    const requests = [
      { key: 'metrics', endpoint: '/api/v1/dashboard/metrics', fallback: { defaultMetric: true } },
      { key: 'clients', endpoint: '/api/v1/clients', fallback: [] },
    ];

    const { result } = renderHook(() => useMultiPortalData(requests as any));

    // Wait for async resolution
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Failed key 'clients' should have its fallback [] not undefined
    expect((result.current.data as any).clients).not.toBeUndefined();
    expect((result.current.data as any).clients).toEqual([]);
  });
});
