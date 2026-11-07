import { useId } from 'react';

const control = (error) =>
  `w-full rounded-btn border bg-white px-3.5 text-[15px] text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-navy/25 ${
    error ? 'border-danger' : 'border-line focus:border-navy'
  }`;

function Wrapper({ id, label, error, hint, className, children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Textarea({ label, error, hint, className = '', rows = 3, ...props }) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} className={className}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${control(error)} block resize-y py-2.5`}
        {...props}
      />
    </Wrapper>
  );
}

export function Select({ label, error, hint, className = '', children, ...props }) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${control(error)} h-11`}
        {...props}
      >
        {children}
      </select>
    </Wrapper>
  );
}
