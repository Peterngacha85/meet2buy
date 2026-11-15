import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { LogOut, Menu, X } from 'lucide-react';
import { LogoMark, Wordmark } from '../../components/Logo.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useNotifyStore } from '../../store/notifyStore.js';
import { NotificationCenter } from '../../features/notify/NotificationCenter.jsx';

/**
 * Shared shell for seller and admin dashboards (doc 03 §6):
 * navy sidebar, white text, orange left bar on the active item.
 */
export function DashboardLayout({ title, items, action }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const badges = useNotifyStore((s) => s.badges);
  const totalBadges = items.reduce((n, i) => n + (i.badgeKey ? badges[i.badgeKey] ?? 0 : 0), 0);

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
      {items.map(({ to, label, icon: Icon, end, badgeKey }) => (
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
              {badgeKey && badges[badgeKey] > 0 && (
                <span className="ml-auto min-w-5 rounded-full bg-orange px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-navy">
                  {badges[badgeKey] > 99 ? '99+' : badges[badgeKey]}
                  <span className="sr-only"> new</span>
                </span>
              )}
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
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col bg-navy pb-4 transition-transform lg:sticky lg:top-0 lg:translate-x-0 ${
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
          <NavLink to="/account" className="block rounded-btn px-3 pb-2 pt-1 hover:bg-white/5" title="My account">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-white/60">{user?.email}</p>
          </NavLink>
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="relative text-navy">
            <Menu className="size-6" />
            {totalBadges > 0 && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-orange ring-2 ring-white" aria-label="New notifications" />}
          </button>
          <LogoMark className="h-7" />
          <Wordmark className="text-lg" />
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
        <NotificationCenter />
      </div>
    </div>
  );
}
