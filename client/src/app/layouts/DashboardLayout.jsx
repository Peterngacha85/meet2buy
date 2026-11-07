import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { LogOut, Menu, X } from 'lucide-react';
import { LogoMark, Wordmark } from '../../components/Logo.jsx';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * Shared shell for seller and admin dashboards (doc 03 §6):
 * navy sidebar, white text, orange left bar on the active item.
 */
export function DashboardLayout({ title, items, action }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `relative flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-orange" aria-hidden />}
              <Icon className="size-4.5" aria-hidden />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Sidebar: fixed on desktop, drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy pb-4 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <NavLink to="/" className="inline-flex items-center gap-2" aria-label="Meet2buy home">
            <LogoMark inverse className="h-7" />
            <Wordmark inverse className="text-lg" />
          </NavLink>
          <button className="text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <p className="px-6 pb-3 text-xs font-medium uppercase tracking-[0.04em] text-white/50">{title}</p>
        {action && <div className="px-3 pb-4">{action}</div>}
        {nav}
        <div className="border-t border-white/10 px-3 pt-4">
          <p className="truncate px-3 text-sm font-medium text-white">{user?.name}</p>
          <p className="truncate px-3 pb-2 text-xs text-white/60">{user?.email}</p>
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-4.5" aria-hidden /> Log out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-navy-dark/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-navy">
            <Menu className="size-6" />
          </button>
          <LogoMark className="h-7" />
          <Wordmark className="text-lg" />
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
