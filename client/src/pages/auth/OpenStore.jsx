import { BadgePercent, Radio, Wallet } from 'lucide-react';
import { AuthCard } from './AuthCard.jsx';

// Seller registration wizard — Sprint 2.
const points = [
  { icon: BadgePercent, text: 'Free to join — Meet2buy only earns a small commission when you sell.' },
  { icon: Radio, text: 'Go live from your store and show products to shoppers face to face.' },
  { icon: Wallet, text: 'Get paid straight to your Till or Paybill as soon as the buyer pays.' },
];

export function OpenStore() {
  return (
    <AuthCard title="Open your store" subtitle="Seller registration opens soon.">
      <ul className="space-y-4">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-btn bg-orange-soft text-orange-ink">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <span className="text-sm text-ink">{text}</span>
          </li>
        ))}
      </ul>
    </AuthCard>
  );
}
