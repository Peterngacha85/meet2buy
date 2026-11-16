import { useCallback, useEffect, useRef, useState } from 'react';
import { apiError, unwrap } from '../services/api.js';
import { onDataChanged } from '../services/live.js';

const REFOCUS_AFTER_MS = 15_000;

/**
 * Load data from the API: const { data, loading, error, reload, setData } = useFetch(() => api.get('/x'), [dep], { live })
 * `request` returns an axios promise; the { success, data } envelope is unwrapped.
 *
 * `live: ['orders', …]` keeps the page current without a refresh: when the server announces that one
 * of these topics changed (or the connection comes back, or you return to the tab after a while), the
 * data is refetched quietly — no spinner, and the old data stays on screen if the refetch fails.
 * Leave it off for pages with forms, so nobody's half-typed edits are replaced.
 */
export function useFetch(request, deps = [], { live = null } = {}) {
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

  // Quiet refetch for live pages.
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await unwrap(load());
      setState({ data, loading: false, error: null });
    } catch {
      /* keep what is on screen */
    } finally {
      inFlight.current = false;
    }
  }, [load]);

  const topics = live ? live.join(',') : '';
  useEffect(() => {
    if (!topics) return undefined;
    const wanted = topics.split(',');
    let timer = null;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 300); // a burst of changes → one refetch
    };
    const off = onDataChanged((changed) => {
      if (changed.includes('*') || changed.some((t) => wanted.includes(t))) soon();
    });
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > REFOCUS_AFTER_MS) soon();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      off();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [topics, refresh]);

  const setData = useCallback((update) => {
    setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update }));
  }, []);

  return { ...state, reload, refresh, setData };
}
