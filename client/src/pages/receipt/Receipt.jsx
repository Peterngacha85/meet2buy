import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Download, LifeBuoy, Printer, RotateCcw, Share2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Wordmark } from '../../components/Logo.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api } from '../../services/api.js';
import { kes } from '../../utils/format.js';
import { DEVELOPER, SUPPORT_EMAIL, SUPPORT_PHONE } from '../../config/legal.js';

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const PRINT_MS = reduced ? 0 : 2400;
const dateTime = new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
const when = (d) => (d ? dateTime.format(new Date(d)) : '—');
const phone = (p) => (p?.startsWith('254') ? `0${p.slice(3)}` : p);

const COPY_LABEL = { buyer: 'Customer copy', seller: 'Seller copy', admin: 'Meet2buy copy' };

function Row({ label, children, strong = false }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'font-bold text-ink' : ''}`}>
      <span className={strong ? '' : 'text-[#5b6175]'}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

const Rule = () => <div className="my-3 border-t border-dashed border-[#c9c3b8]" />;

/** The paper itself: what gets printed. Thermal-receipt look, but readable on screen. */
function Paper({ r }) {
  const s = r.settlement;
  return (
    <div className="receipt-paper relative bg-white px-5 pb-8 pt-6 font-mono text-[13px] leading-relaxed text-[#14182b]">
      <div className="text-center">
        <Wordmark className="!text-2xl" />
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-[#5b6175]">The live mall</p>
        <p className="mt-3 inline-block rounded-full border border-[#14182b] px-3 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em]">
          Receipt · {COPY_LABEL[r.copy]}
        </p>
      </div>

      <Rule />
      <Row label="Receipt no.">
        <strong>{r.receiptNumber}</strong>
      </Row>
      <Row label="Order no.">{r.orderNumber}</Row>
      <Row label="Date">{when(r.paidAt)}</Row>
      <Rule />
      <Row label="Sold by">
        <strong>{r.store?.name ?? '—'}</strong>
      </Row>
      {r.store?.phone && <Row label="Seller phone">{phone(r.store.phone)}</Row>}
      <Row label="Customer">{r.buyer.name}</Row>
      <Rule />

      <div className="space-y-2">
        {r.items.map((i, n) => (
          <div key={n}>
            <p className="font-bold">{i.name}</p>
            {i.variant && <p className="text-[12px] text-[#5b6175]">{i.variant}</p>}
            <Row label={`${i.quantity} × ${kes(i.unitPrice)}`}>{kes(i.total)}</Row>
          </div>
        ))}
      </div>
      <Rule />
      <div className="text-[16px]">
        <Row label="TOTAL PAID" strong>
          {kes(r.amount)}
        </Row>
      </div>
      <Rule />
      <Row label="Paid with">{r.payment.method}</Row>
      {r.payment.mpesaReceipt && (
        <Row label="M-Pesa ref.">
          <strong>{r.payment.mpesaReceipt}</strong>
        </Row>
      )}
      {r.payment.phone && <Row label="From">{phone(r.payment.phone)}</Row>}

      {r.delivery && (
        <>
          <Rule />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b6175]">Deliver to</p>
          <p>
            {r.delivery.name} · {phone(r.delivery.phone)}
          </p>
          <p>{r.delivery.location}</p>
        </>
      )}

      {s && (
        <>
          <Rule />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b6175]">Settlement</p>
          <Row label="Sale">{kes(r.amount)}</Row>
          <Row label={`Meet2buy commission (${s.commissionRate ?? 0}%)`}>− {kes(s.commissionAmount ?? 0)}</Row>
          {s.payoutFee > 0 && <Row label="M-Pesa B2B fee">− {kes(s.payoutFee)}</Row>}
          <Row label="Paid to seller" strong>
            {kes(s.payoutAmount ?? 0)}
          </Row>
          {s.payout && (
            <>
              <Row label="To">{s.payout.to}</Row>
              <Row label="Payout">{s.payout.status === 'completed' ? `Sent · ${s.payout.transactionId ?? ''}` : s.payout.status}</Row>
            </>
          )}
        </>
      )}

      <Rule />
      <p className="text-center font-bold">Asante! Thank you for shopping live.</p>
      <p className="mt-1 text-center text-[11px] text-[#5b6175]">
        Keep this receipt for returns, warranty and after-sales support.
        {SUPPORT_EMAIL && <> · {SUPPORT_EMAIL}</>}
        {SUPPORT_PHONE && <> · {SUPPORT_PHONE}</>}
      </p>
      <p className="mt-3 text-center text-[10px] text-[#8a8f9e]">Issued {when(r.issuedAt)} · meet2buy</p>
      {/* Torn edge */}
      <div
        aria-hidden
        className="absolute inset-x-0 -bottom-2 h-3"
        style={{
          background: 'linear-gradient(-45deg, transparent 6px, #fff 0) 0 0 / 12px 12px repeat-x, linear-gradient(45deg, transparent 6px, #fff 0) 0 0 / 12px 12px repeat-x',
        }}
      />
    </div>
  );
}

/**
 * Receipt page (client brief, Nov 2026): the receipt prints out of a little printer, then can be
 * printed for real or saved as PDF. Buyer, seller and admin each get their own copy.
 */
export function ReceiptPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(() => api.get(`/orders/${orderId}/receipt`), [orderId], { live: ['orders', 'payouts'] });
  const [run, setRun] = useState(0); // bump to replay the print animation
  const [printing, setPrinting] = useState(true);
  const r = data?.receipt;

  useEffect(() => {
    if (!r) return undefined;
    setPrinting(true);
    const t = setTimeout(() => setPrinting(false), PRINT_MS);
    return () => clearTimeout(t);
  }, [r, run]);

  const share = async () => {
    try {
      await navigator.share({ title: `Meet2buy receipt ${r.receiptNumber}`, url: window.location.href });
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="receipt-page min-h-dvh bg-bg-soft px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <div className="no-print mb-6 flex items-center justify-between gap-3">
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Back
          </button>
          {r && <span className="text-sm text-muted">{r.receiptNumber}</span>}
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="rounded-card bg-white p-6 text-center">
            <p className="font-semibold text-ink">{error.message}</p>
            <Button to="/" variant="ghost" className="mt-4">
              Back to the mall
            </Button>
          </div>
        ) : (
          <>
            {/* The printer */}
            <div className={`no-print relative z-10 mx-auto w-[calc(100%+24px)] -translate-x-3 rounded-[20px] bg-navy px-5 pb-4 pt-4 shadow-[0_18px_40px_-18px_rgb(7_20_64/0.7)] ${printing ? 'animate-printer-buzz' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-white">
                  Meet<span className="text-orange">2</span>buy
                </span>
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70" aria-live="polite">
                  <span className={`size-2 rounded-full ${printing ? 'animate-live-pulse bg-orange' : 'bg-[#34c759]'}`} />
                  {printing ? 'Printing…' : 'Ready'}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-navy-dark shadow-[inset_0_2px_3px_rgb(0_0_0/0.6)]" />
            </div>

            {/* Paper feeding out of the slot */}
            <div className="print-area relative -mt-2 overflow-hidden px-1 pb-4">
              <div key={run} className="print-receipt animate-receipt-feed drop-shadow-[0_10px_18px_rgb(7_20_64/0.18)]">
                <Paper r={r} />
              </div>
            </div>

            <div className={`no-print mt-4 grid grid-cols-2 gap-2 transition-opacity duration-500 ${printing ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
              <Button onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden /> Print
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Download className="size-4" aria-hidden /> Save PDF
              </Button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <Button variant="ghost" onClick={share}>
                  <Share2 className="size-4" aria-hidden /> Share
                </Button>
              )}
              <Button variant="ghost" onClick={() => setRun((n) => n + 1)}>
                <RotateCcw className="size-4" aria-hidden /> Print again
              </Button>
            </div>
            {r.copy === 'buyer' && !printing && (
              <Link
                to={`/orders/${r.orderId}/help`}
                className="no-print mt-4 flex items-center justify-center gap-2 rounded-card border border-line bg-white px-4 py-3 text-sm font-semibold text-navy hover:border-navy/40"
              >
                <LifeBuoy className="size-4" aria-hidden /> Problem with this order? Get help
              </Link>
            )}
            <p className="no-print mt-6 text-center text-xs text-muted">
              Developed by{' '}
              <a href={DEVELOPER.url} target="_blank" rel="noopener noreferrer" className="underline">
                {DEVELOPER.name}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
