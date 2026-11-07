import { LayoutDashboard, MessageSquareText, Package, Radio, Receipt, Store, Wallet } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout.jsx';
import { Button } from '../../components/ui/Button.jsx';

const items = [
  { to: '/seller', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/seller/store', label: 'Shop profile', icon: Store },
  { to: '/seller/products', label: 'Products', icon: Package },
  { to: '/seller/requests', label: 'Demo requests', icon: MessageSquareText },
  { to: '/seller/orders', label: 'Orders', icon: Receipt },
  { to: '/seller/payouts', label: 'Payout settings', icon: Wallet },
];

export function SellerLayout() {
  return (
    <DashboardLayout
      title="Seller"
      items={items}
      action={
        <Button to="/seller/live" variant="accent" className="w-full">
          <Radio className="size-4" aria-hidden /> Go Live
        </Button>
      }
    />
  );
}
