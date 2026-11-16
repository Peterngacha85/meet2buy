import { useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, FileText, LifeBuoy, RotateCcw, Send, ShieldAlert, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Textarea } from '../../components/ui/Field.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { FormError } from '../../pages/auth/AuthCard.jsx';
import { ImageList } from '../seller/ImageUpload.jsx';
import { api, apiError, unwrap } from '../../services/api.js';
import { imgUrl } from '../../services/uploads.js';
import { timeAgo } from '../../utils/format.js';

export const TICKET_STATUS = {
  open: 'Waiting for the seller',
  in_progress: 'Seller replied',
  escalated: 'With Meet2buy',
  resolved: 'Resolved',
  closed: 'Closed',
};

/** What each side sees as the next step. */
const NEXT = {
  buyer: {
    open: 'The seller has been told and will reply here.',
    in_progress: 'Reply below. If you can’t agree, ask Meet2buy to step in.',
    escalated: 'A Meet2buy admin is reviewing this request and will reply here.',
    resolved: 'The seller says this is sorted. Not happy? Reply or reopen it.',
    closed: 'This request is closed. Raise a new one from My orders if you need more help.',
  },
  seller: {
    open: 'The buyer is waiting for your reply. Answer quickly and agree on a fix.',
    in_progress: 'Mark it resolved once the buyer has a fix: repair, replacement, refund or another fair solution.',
    escalated: 'The buyer asked Meet2buy to step in. Keep replying here; an admin is reviewing it.',
    resolved: 'You marked this resolved. The buyer can reopen it if needed.',
    closed: 'This request is closed.',
  },
  admin: {
    open: 'Waiting for the seller.',
    in_progress: 'Buyer and seller are talking.',
    escalated: 'Needs Meet2buy: review the messages and the order, then help both sides agree.',
    resolved: 'Marked resolved.',
    closed: 'Closed.',
  },
};

const ACTION = {
  escalated: { label: 'Ask Meet2buy to step in', icon: ShieldAlert, variant: 'outline', confirm: 'Meet2buy will review the messages and the order.' },
  resolved: { label: 'Mark resolved', icon: CheckCircle2, variant: 'primary', note: 'What was done? (shown to the buyer)' },
  closed: { label: 'Close request', icon: XCircle, variant: 'ghost' },
  open: { label: 'Reopen', icon: RotateCcw, variant: 'outline' },
};
const BUYER_CLOSE_LABEL = { resolved: 'Yes, it’s sorted — close', default: 'Close (no longer needed)' };

function Photos({ images }) {
  if (!images?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {images.map((src) => (
        <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-btn border border-line">
          <img src={imgUrl(src, { w: 200 })} alt="Attached photo" className="size-20 object-cover" />
        </a>
      ))}
    </div>
  );
}

function Message({ m, mine }) {
  if (m.role === 'system') {
    return <p className="mx-auto max-w-md rounded-full bg-bg-soft px-3 py-1.5 text-center text-xs text-muted">{m.body}</p>;
  }
  const tone = m.role === 'admin' ? 'bg-navy text-white' : mine ? 'bg-orange-soft text-ink' : 'bg-white text-ink ring-1 ring-line';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-card px-4 py-3 ${tone}`}>
        <p className={`text-xs font-semibold ${m.role === 'admin' ? 'text-orange' : 'text-navy'}`}>
          {m.name}
          {m.role === 'seller' && ' · Seller'}
          <span className={`ml-2 font-normal ${m.role === 'admin' ? 'text-white/60' : 'text-muted'}`}>{timeAgo(m.createdAt)}</span>
        </p>
        <p className="mt-1 whitespace-pre-line text-[15px]">{m.body}</p>
        <Photos images={m.images} />
      </div>
    </div>
  );
}

/** One after-sales request: details, the conversation, reply box and the next steps for this viewer. */
export function SupportThread({ ticket, onChange }) {
  const role = ticket.viewerRole;
  const [body, setBody] = useState('');
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // status awaiting a note / confirmation
  const [note, setNote] = useState('');

  async function send(e) {
    e.preventDefault();
    setBusy('send');
    setError('');
    try {
      const data = await unwrap(api.post(`/support/${ticket.id}/messages`, { body, images }));
      setBody('');
      setImages([]);
      onChange(data.ticket);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy('');
    }
  }

  async function act(status, withNote = '') {
    setBusy(status);
    setError('');
    try {
      const data = await unwrap(api.patch(`/support/${ticket.id}/status`, { status, ...(withNote.trim() ? { note: withNote } : {}) }));
      setPending(null);
      setNote('');
      onChange(data.ticket);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy('');
    }
  }

  const mine = (m) => m.role === role && (role !== 'buyer' || m.role === 'buyer');
  const receiptLink = `/receipt/${ticket.order}`;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{ticket.ticketNumber}</span> · opened {timeAgo(ticket.createdAt)}
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{ticket.categoryLabel}</h1>
            <p className="mt-0.5 text-ink">
              {ticket.productName} · {role === 'buyer' ? ticket.store?.name : `Order ${ticket.orderNumber}`}
            </p>
          </div>
          <StatusPill status={ticket.status}>{TICKET_STATUS[ticket.status]}</StatusPill>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className="text-muted">Order {ticket.orderNumber}</span>
          {ticket.receiptNumber && (
            <Link to={receiptLink} className="inline-flex items-center gap-1 font-semibold text-navy hover:underline">
              <FileText className="size-3.5" aria-hidden /> Receipt {ticket.receiptNumber}
            </Link>
          )}
        </div>
        <p className="mt-3 rounded-btn bg-bg-soft px-3 py-2 text-sm text-ink">{NEXT[role]?.[ticket.status]}</p>
      </Card>

      <div className="space-y-3" aria-live="polite">
        {ticket.messages.map((m) => (
          <Message key={m.id} m={m} mine={mine(m)} />
        ))}
      </div>

      <FormError message={error} />

      {ticket.status !== 'closed' && (
        <Card className="p-4">
          <form onSubmit={send} className="space-y-3">
            <Textarea
              label={role === 'admin' ? 'Reply as Meet2buy support' : 'Your reply'}
              rows={3}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={role === 'seller' ? 'e.g. Please bring it to the shop, we will check it for free.' : 'Write a message…'}
            />
            <ImageList value={images} onChange={setImages} max={4} kind="support" label="Photos (optional)" cover={false} />
            <div className="flex justify-end">
              <Button type="submit" loading={busy === 'send'} disabled={!body.trim()}>
                <Send className="size-4" aria-hidden /> Send
              </Button>
            </div>
          </form>
        </Card>
      )}

      {ticket.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ticket.actions.map((status) => {
            const a = ACTION[status];
            const Icon = a.icon;
            const label =
              role === 'buyer' && status === 'closed' ? BUYER_CLOSE_LABEL[ticket.status] ?? BUYER_CLOSE_LABEL.default : a.label;
            return (
              <Button
                key={status}
                variant={a.variant}
                size="sm"
                loading={busy === status}
                onClick={() => (a.note || a.confirm ? setPending(status) : act(status))}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </Button>
            );
          })}
        </div>
      )}

      {pending && (
        <Card className="space-y-3 border-orange p-4">
          <p className="font-semibold text-ink">{ACTION[pending].label}</p>
          {ACTION[pending].confirm && <p className="text-sm text-muted">{ACTION[pending].confirm}</p>}
          <Textarea
            label={ACTION[pending].note ?? 'Add a note (optional)'}
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => act(pending, note)} loading={busy === pending}>
              Confirm
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/** A list of requests: buyer's, a shop's, or all (admin). `base` is the link prefix, e.g. "/seller/support". */
export function TicketList({ tickets, base, showStore = false, showBuyer = false, empty }) {
  if (!tickets.length) {
    return (
      <Card className="px-6 py-12 text-center">
        <LifeBuoy className="mx-auto size-8 text-muted" aria-hidden />
        <p className="mt-3 font-semibold text-ink">{empty ?? 'No requests'}</p>
      </Card>
    );
  }
  return (
    <ul className="space-y-2">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link to={`${base}/${t.id}`} className="block rounded-card border border-line bg-white p-4 transition hover:border-navy/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink">{t.ticketNumber}</span> · {t.orderNumber} · {timeAgo(t.lastActivityAt)}
              </p>
              <StatusPill status={t.status}>{TICKET_STATUS[t.status]}</StatusPill>
            </div>
            <p className="mt-1 font-semibold text-ink">
              {t.categoryLabel} · {t.productName}
            </p>
            <p className="text-sm text-muted">
              {[showStore && t.store, showBuyer && `Buyer: ${t.buyer}`].filter(Boolean).join(' · ')}
            </p>
            {t.lastMessage && (
              <p className="mt-1 line-clamp-1 text-sm text-ink">
                <span className="font-medium">{t.lastMessage.name}:</span> {t.lastMessage.body}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
