import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { homeForRole } from '../store/authStore.js';
import { Spinner } from '../components/ui/Spinner.jsx';

/** Guards a route subtree. With no roles, any logged-in user may enter. */
export function RequireRole({ roles }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Spinner />;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
