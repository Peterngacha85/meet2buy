import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Radio, Send } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { api, apiError, unwrap } from '../../services/api.js';
import { timeAgo } from '../../utils/format.js';

/**
 * "Invite to live demo" for a demo request. Live: the shopper gets a pop-up to join the room now.
 * Not live yet: opens Live control, which sends the invite as soon as the seller goes live.
 */
export function InviteButton({ request, isLive, onInvited, size = 'sm', className = '' }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invitedAt = request.invitedAt;

  async function invite() {
    if (!isLive) {
      navigate(`/seller/live?invite=${request.id}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { request: updated } = await unwrap(api.post(`/stores/mine/presentation-requests/${request.id}/invite`));
      onInvited?.(updated);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Button size={size} variant={invitedAt ? 'outline' : 'accent'} onClick={invite} loading={busy} className="w-full whitespace-nowrap">
        {!busy && (invitedAt ? <Send className="size-4" aria-hidden /> : <Radio className="size-4" aria-hidden />)}
        {invitedAt ? 'Invite again' : isLive ? 'Invite to live demo' : 'Go live & invite'}
      </Button>
      {invitedAt && (
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-success">
          <Check className="size-3.5" aria-hidden /> Invited {timeAgo(invitedAt)}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
