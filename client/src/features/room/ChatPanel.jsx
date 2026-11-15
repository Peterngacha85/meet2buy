import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { SendHorizontal } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';

const MAX = 300;

function Message({ m }) {
  if (m.type === 'system') {
    return <li className="px-2 py-1 text-center text-xs font-medium text-muted">{m.body}</li>;
  }
  const seller = m.sender?.isSeller;
  return (
    <li className="px-1 py-1 text-[14px] leading-snug">
      <span className={`mr-1.5 font-semibold ${seller ? 'text-orange-ink' : 'text-navy'}`}>{m.sender?.name ?? 'Shopper'}</span>
      {seller && (
        <span className="mr-1.5 rounded bg-orange px-1.5 py-px align-[1px] text-[10px] font-bold uppercase tracking-wide text-navy">
          Seller
        </span>
      )}
      <span className="break-words text-ink">{m.body}</span>
    </li>
  );
}

/**
 * Public chat (doc 07 §6). Guests can read; logging in unlocks typing.
 * `welcome` is a local greeting shown at the top (not saved).
 */
export function ChatPanel({ messages, canChat, onSend, welcome, disabled = false, readOnly = null, className = '' }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const stick = useRef(true);
  const location = useLocation();

  // Follow new messages unless the reader has scrolled up to read older ones.
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function submit(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    const res = await onSend(text);
    setSending(false);
    if (res?.ok) {
      setBody('');
      stick.current = true;
    } else setError(res?.error ?? 'Message not sent');
  }

  return (
    <section aria-label="Chat" className={`flex min-h-0 flex-col bg-white ${className}`}>
      <ol
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        {welcome && <li className="mb-2 rounded-btn bg-navy-soft px-3 py-2 text-sm text-navy">{welcome}</li>}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
      </ol>

      <div className="border-t border-line p-3">
        {readOnly ? (
          <p className="text-center text-sm text-muted">{readOnly}</p>
        ) : canChat ? (
          <form onSubmit={submit}>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="chat-input">
                Message
              </label>
              <input
                id="chat-input"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX))}
                placeholder="Ask the seller anything…"
                autoComplete="off"
                disabled={disabled}
                className="h-11 min-w-0 flex-1 rounded-btn border border-line bg-white px-3.5 text-[15px] focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/25"
              />
              <Button type="submit" size="md" className="!px-3.5" loading={sending} disabled={disabled || !body.trim()} aria-label="Send">
                {!sending && <SendHorizontal className="size-4" aria-hidden />}
              </Button>
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-danger" role="alert">
                {error}
              </span>
              {body.length > MAX - 50 && <span className="text-muted">{MAX - body.length} left</span>}
            </div>
          </form>
        ) : (
          <Button to={`/login?next=${encodeURIComponent(location.pathname)}`} variant="outline" className="w-full">
            Log in to chat with the seller
          </Button>
        )}
      </div>
    </section>
  );
}
