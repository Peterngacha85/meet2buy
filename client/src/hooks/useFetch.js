import { useCallback, useEffect, useState } from 'react';
import { apiError, unwrap } from '../services/api.js';

/**
 * Load data from the API: const { data, loading, error, reload, setData } = useFetch(() => api.get('/x'), [dep])
 * `request` returns an axios promise; the { success, data } envelope is unwrapped.
 */
export function useFetch(request, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(request, deps);

  const reload = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    unwrap(load())
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ data: null, loading: false, error: apiError(err) }));
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => reload(), [reload]);

  const setData = useCallback((update) => {
    setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update }));
  }, []);

  return { ...state, reload, setData };
}
