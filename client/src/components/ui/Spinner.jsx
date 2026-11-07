import { Loader2 } from 'lucide-react';

export function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-2 text-muted">
      <Loader2 className="size-5 animate-spin text-navy" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
