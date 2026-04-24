/**
 * useApi — thin wrapper around apiClient for data fetching.
 * React Query was removed; portals use useMultiPortalData instead.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/apiClient';

export function useApi<T>(
  queryKey: unknown[],
  fetcher: () => Promise<{ data: T }>,
  options?: { enabled?: boolean }
) {
  const [data, setData]       = useState<T | undefined>(undefined);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]     = useState<Error | null>(null);

  const run = useCallback(async () => {
    if (options?.enabled === false) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetcher();
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(queryKey)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { run(); }, [run]);

  return { data, isLoading, error, refetch: run };
}

export function useApiMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<{ data: TData }>
) {
  const [isLoading, setLoading] = useState(false);
  const [error, setError]       = useState<Error | null>(null);

  const mutate = useCallback(async (variables: TVariables): Promise<TData> => {
    setLoading(true);
    try {
      const res = await mutationFn(variables);
      setError(null);
      return res.data;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { mutate, isLoading, error };
}
