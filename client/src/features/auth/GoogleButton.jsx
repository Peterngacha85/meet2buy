import { useEffect, useRef, useState } from 'react';
import { api, unwrap } from '../../services/api.js';

// Google Identity Services: https://developers.google.com/identity/gsi/web
// The client ID comes from the server (GET /api/auth/config), so it is only set in server/.env.
let configPromise;
const loadConfig = () => (configPromise ??= unwrap(api.get('/auth/config')).catch(() => ({ googleClientId: null })));

let scriptPromise;
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * "Continue with Google". Renders nothing until Google sign-in is configured on the server.
 * onCredential(idToken) is called with Google's ID token.
 */
export function GoogleButton({ onCredential, text = 'continue_with', onError }) {
  const box = useRef(null);
  const [clientId, setClientId] = useState(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  useEffect(() => {
    let alive = true;
    loadConfig().then((c) => alive && setClientId(c.googleClientId));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !box.current) return;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !box.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => handler.current(res.credential),
          ux_mode: 'popup',
          use_fedcm_for_button: true,
        });
        window.google.accounts.id.renderButton(box.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'center',
          width: Math.min(box.current.offsetWidth || 360, 400),
        });
      })
      .catch((err) => errorHandler.current?.(err.message));
    return () => {
      alive = false;
    };
  }, [clientId, text]);

  if (!clientId) return null;

  return (
    <div>
      <div ref={box} className="flex min-h-11 w-full justify-center" />
      <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

