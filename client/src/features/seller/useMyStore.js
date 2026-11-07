import { useAuth } from '../../hooks/useAuth.js';
import { api, unwrap } from '../../services/api.js';

/** The seller's shop from the auth store, plus a save helper that keeps it in sync. */
export function useMyStore() {
  const { store, setStore } = useAuth();

  async function save(path, body, method = 'patch') {
    const { store: updated } = await unwrap(api[method](`/stores/mine${path}`, body));
    setStore(updated);
    return updated;
  }

  return { store, setStore, save };
}
