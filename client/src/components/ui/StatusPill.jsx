// Status pill colours — doc 03 §7.
const styles = {
  live: 'bg-orange text-navy',
  pending: 'bg-[#FFF4D6] text-[#8A6100]',
  approved: 'bg-[#E6F4EA] text-success',
  paid: 'bg-[#E6F4EA] text-success',
  completed: 'bg-[#E6F4EA] text-success',
  failed: 'bg-[#FDE8E7] text-danger',
  suspended: 'bg-[#FDE8E7] text-danger',
  rejected: 'bg-[#FDE8E7] text-danger',
  processing: 'bg-navy-soft text-navy',
  awaiting_payment: 'bg-[#FFF4D6] text-[#8A6100]',
  on_hold: 'bg-[#FFF4D6] text-[#8A6100]',
  payment_failed: 'bg-[#FDE8E7] text-danger',
  cancelled: 'bg-bg-soft text-muted',
  shipped: 'bg-navy-soft text-navy',
  delivered: 'bg-[#E6F4EA] text-success',
  // After-sales requests
  open: 'bg-[#FFF4D6] text-[#8A6100]',
  in_progress: 'bg-navy-soft text-navy',
  escalated: 'bg-[#FDE8E7] text-danger',
  resolved: 'bg-[#E6F4EA] text-success',
  closed: 'bg-bg-soft text-muted',
};

export function StatusPill({ status, children }) {
  const key = String(status).toLowerCase();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        styles[key] ?? 'bg-bg-soft text-muted'
      }`}
    >
      {key === 'live' && <span className="size-1.5 rounded-full bg-navy animate-live-pulse" aria-hidden />}
      {children ?? status}
    </span>
  );
}
