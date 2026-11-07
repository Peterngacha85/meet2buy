import { Card } from '../../components/ui/Card.jsx';
import { useAuth } from '../../hooks/useAuth.js';

export function SellerOverview() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[28px] font-bold">Hi, {user.name.split(' ')[0]}</h1>
      <p className="mt-1 text-muted">Your store dashboard.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {['Store status', "Today's sales", 'Pending requests'].map((label) => (
          <Card key={label} className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-navy">—</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
