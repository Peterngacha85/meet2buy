import { Armchair, Gem, Laptop, Shirt, Sparkles, UtensilsCrossed, Video } from 'lucide-react';
import { FullLogo } from '../../components/Logo.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';

// Placeholder wings until the client confirms the list (doc 09, open question 6).
const wings = [
  { name: 'Fashion', icon: Shirt },
  { name: 'Electronics', icon: Laptop },
  { name: 'Beauty', icon: Sparkles },
  { name: 'Home', icon: Armchair },
  { name: 'Food', icon: UtensilsCrossed },
  { name: 'Jewellery', icon: Gem },
];

export function MallHome() {
  return (
    <>
      {/* Mall entrance */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:pb-20 sm:pt-20">
          <FullLogo className="w-56 sm:w-72" />
          <h1 className="mt-8 max-w-3xl text-[28px] font-extrabold leading-tight sm:text-[40px] sm:leading-[48px]">
            Don&rsquo;t search for what you want,{' '}
            <span className="relative inline-block">
              meet the person selling it.
              <svg
                viewBox="0 0 300 12"
                preserveAspectRatio="none"
                className="absolute -bottom-2 left-0 h-2.5 w-full"
                aria-hidden
              >
                <path d="M2 9C80 2 200 2 290 6l-8-5m8 5-9 5" fill="none" stroke="#F7700A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted sm:text-lg">
            Walk into a live store, watch products shown on camera, ask the seller anything, and pay with M-Pesa
            without leaving the conversation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" to="#live">
              Walk the mall
            </Button>
            <Button size="lg" variant="accent" to="/open-store">
              Open your store free
            </Button>
          </div>
        </div>
      </section>

      {/* Live now */}
      <section id="live" className="bg-bg-soft">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold sm:text-[28px]">Live now</h2>
            <StatusPill status="live">Live</StatusPill>
          </div>
          <Card className="mt-6 flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-navy-soft text-navy">
              <Video className="size-6" aria-hidden />
            </span>
            <p className="font-semibold text-ink">No stores are live right now</p>
            <p className="max-w-sm text-sm text-muted">
              Stores open their doors throughout the day. Browse the wings below and come back soon.
            </p>
          </Card>
        </div>
      </section>

      {/* Wings */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold sm:text-[28px]">Explore the wings</h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {wings.map(({ name, icon: Icon }) => (
            <li key={name}>
              <Card className="flex h-full flex-col items-start gap-3 p-4 transition-colors hover:border-navy">
                <span className="grid size-10 place-items-center rounded-btn bg-orange-soft text-orange-ink">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-semibold text-navy">{name}</span>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
