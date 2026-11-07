import { Card } from '../../components/ui/Card.jsx';

const stats = ['Total sellers', 'Pending approvals', 'Live rooms now', 'Sales today', 'Commission today', 'Commission this month'];

export function AdminOverview() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[28px] font-bold">Overview</h1>
      <p className="mt-1 text-muted">Platform numbers appear here once stores and sales exist.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((label) => (
          <Card key={label} className="p-5">
            <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-navy">—</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
