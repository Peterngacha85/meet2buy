import { ArrowLeftRight, LayoutDashboard, LifeBuoy, Radio, Settings, ShieldCheck, Store, Users, Wallet } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout.jsx';

const items = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/sellers', label: 'Sellers', icon: Store, badgeKey: 'pendingSellers' },
  { to: '/admin/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/admin/payouts', label: 'Payouts', icon: Wallet },
  { to: '/admin/live-rooms', label: 'Live rooms', icon: Radio },
  { to: '/admin/support', label: 'After-sales', icon: LifeBuoy, badgeKey: 'support' },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/admins', label: 'Admins', icon: ShieldCheck },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminLayout() {
  return <DashboardLayout title="Admin" items={items} />;
}
