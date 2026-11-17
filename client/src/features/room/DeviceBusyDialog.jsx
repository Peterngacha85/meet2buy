import { Camera, Mic } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';

/**
 * Another app (a WhatsApp or phone call, Zoom…) is holding the buyer's microphone or camera.
 * Ask them to free it and try again, or carry on without it.
 */
export function DeviceBusyDialog({ device, onRetry, onSkip }) {
  const mic = device === 'microphone';
  const Icon = mic ? Mic : Camera;
  return (
    <Dialog open={Boolean(device)} onClose={onSkip} title={mic ? 'Your microphone is busy' : 'Your camera is busy'}>
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-soft text-orange-ink">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="space-y-2 text-sm text-ink">
          <p>
            Another app is using your {device} right now, for example a <strong>WhatsApp or phone call</strong>, or a video app
            like Zoom or Google Meet.
          </p>
          <p className="text-muted">End that call or close the app, then tap Try again.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onSkip}>
          {mic ? 'Continue without mic' : 'Continue without camera'}
        </Button>
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Dialog>
  );
}
