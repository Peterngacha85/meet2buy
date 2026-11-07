import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Modal built on <dialog>: focus trap, Esc to close and backdrop click come for free. */
export function Dialog({ open, onClose, title, children, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-card bg-white p-0 text-ink shadow-xl backdrop:bg-navy-dark/55 ${
        wide ? 'max-w-3xl' : 'max-w-lg'
      }`}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button onClick={onClose} className="-m-1 rounded-btn p-1 text-muted hover:bg-bg-soft hover:text-navy" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
