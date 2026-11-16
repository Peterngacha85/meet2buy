import { Link } from 'react-router';

/**
 * "I agree to the Terms of Use and Privacy Policy" — required at every sign-up (buyers and sellers).
 * The links open in a new tab so a half-filled form is not lost.
 */
export function TermsCheckbox({ checked, onChange, error, id = 'accept-terms' }) {
  return (
    <div>
      <label htmlFor={id} className={`flex items-start gap-3 rounded-btn border p-3 text-sm ${error ? 'border-danger bg-[#FDE8E7]/40' : 'border-line'}`}>
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-navy"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="text-ink">
          I have read and agree to the{' '}
          <Link to="/terms" target="_blank" className="font-semibold text-navy underline">
            Terms of Use
          </Link>{' '}
          and the{' '}
          <Link to="/privacy" target="_blank" className="font-semibold text-navy underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Blocks the Google button until the box is ticked (Google sign-up creates an account too). */
export function TermsGate({ open, children }) {
  return (
    <div className="relative">
      <div className={open ? '' : 'pointer-events-none select-none opacity-50'} aria-hidden={!open || undefined}>
        {children}
      </div>
      {!open && <p className="-mt-3 mb-4 text-center text-xs text-muted">Tick the box below to continue with Google.</p>}
    </div>
  );
}
