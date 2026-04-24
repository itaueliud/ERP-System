/**
 * Generic hook for fetching portal data from the real API,
 * falling back to mock data when the API is unavailable or returns an error.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/apiClient';

interface UsePortalDataResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isLive: boolean; // true = real API data, false = mock fallback
}

export function usePortalData<T>(
  endpoint: string,
  fallback: T,
  transform?: (raw: any) => T
): UsePortalDataResult<T> {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(endpoint);
      const raw = res.data;
      const transformed = transform ? transform(raw) : (raw as T);
      setData(transformed);
      setIsLive(true);
    } catch (err: any) {
      // Fall back to mock data silently
      setData(fallback);
      setIsLive(false);
      setError(err?.response?.data?.error || err?.message || 'API unavailable');
    } finally {
      setLoading(false);
    }
  }, [endpoint, fallback, transform]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch, isLive };
}

/**
 * Fetch multiple endpoints in parallel, each with its own fallback.
 */
export function useMultiPortalData<T extends Record<string, any>>(
  requests: { key: keyof T; endpoint: string; fallback: T[keyof T]; transform?: (raw: any) => T[keyof T] }[]
): { data: T; loading: boolean; isLive: boolean; refetch: (keys?: (keyof T)[]) => void } {
  const [data, setData] = useState<T>(() => {
    const init = {} as T;
    for (const r of requests) init[r.key] = r.fallback;
    return init;
  });
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchAll = useCallback((keys?: (keyof T)[]) => {
    const targets = keys ? requests.filter(r => keys.includes(r.key)) : requests;
    if (!keys) setLoading(true);

    Promise.allSettled(
      targets.map(async (r) => {
        const res = await apiClient.get(r.endpoint);
        return { key: r.key, value: r.transform ? r.transform(res.data) : res.data };
      })
    ).then((results) => {
      setData(prev => {
        const next = { ...prev };
        // Reset targeted keys to fallback first
        for (const r of targets) next[r.key] = r.fallback;
        let anyLive = isLive;
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.status === 'fulfilled') {
            next[result.value.key] = result.value.value;
            anyLive = true;
          }
        }
        setIsLive(anyLive);
        return next;
      });
      if (!keys) setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled(
      requests.map(async (r) => {
        const res = await apiClient.get(r.endpoint);
        return { key: r.key, value: r.transform ? r.transform(res.data) : res.data };
      })
    ).then((results) => {
      if (cancelled) return;
      const next = {} as T;
      for (const r of requests) next[r.key] = r.fallback;
      let anyLive = false;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          next[result.value.key] = result.value.value;
          anyLive = true;
        }
      }
      setData(next);
      setIsLive(anyLive);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, isLive, refetch: fetchAll };
}
