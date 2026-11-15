import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { LogOut, Receipt, Store, User } from 'lucide-react';
import { FullLogo, Logo } from '../../components/Logo.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { homeForRole } from '../../store/authStore.js';
import { NotificationCenter } from '../../features/notify/NotificationCenter.jsx';

function AccountMenu() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  if (status === 'loading') return <div className="h-9 w-24" />;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button to="/login" variant="ghost" size="sm">
          Log in
        </Button>
        <Button to="/register" variant="primary" size="sm">
          Sign up
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {user.role !== 'buyer' && (
        <Button to={homeForRole(user.role)} variant="ghost" size="sm">
          <Store className="size-4" aria-hidden />
          <span className="hidden sm:inline">{user.role === 'admin' ? 'Admin' : 'My store'}</span>
        </Button>
      )}
      {user.role === 'buyer' && (
        <Button to="/orders" variant="ghost" size="sm" aria-label="My orders">
          <Receipt className="size-4" aria-hidden />
          <span className="hidden lg:inline">Orders</span>
        </Button>
      )}
      <Button to="/account" variant="ghost" size="sm" aria-label="My account">
        <User className="size-4" aria-hidden />
        <span className="hidden text-ink md:inline">{user.name.split(' ')[0]}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await logout();
          navigate('/');
        }}
        aria-label="Log out"
      >
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="flex items-center gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `hidden rounded-btn px-3 py-2 text-sm font-semibold sm:block ${isActive ? 'text-navy' : 'text-muted hover:text-navy'}`
              }
            >
              The mall
            </NavLink>
            {!user && (
              <Button to="/open-store" variant="accent" size="sm" className="max-md:hidden">
                Open your shop
              </Button>
            )}
            <AccountMenu />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
      <NotificationCenter />

      <footer className="bg-navy-dark text-white/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" aria-label="Meet2buy home">
            <FullLogo inverse className="w-56" />
          </Link>
          <p className="text-sm">© {new Date().getFullYear()} Meet2buy. Payments by M-Pesa.</p>
        </div>
      </footer>
    </div>
  );
}
