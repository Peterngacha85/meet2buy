import { Hammer } from 'lucide-react';
import { Card } from '../components/ui/Card.jsx';

export function ComingSoon({ title, sprint }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-0 sm:py-0">
      <h1 className="text-[28px] font-bold">{title}</h1>
      <Card className="mt-6 flex items-center gap-3 p-6 text-muted">
        <Hammer className="size-5 text-navy" aria-hidden />
        <span>Being built in Sprint {sprint}.</span>
      </Card>
    </div>
  );
}
