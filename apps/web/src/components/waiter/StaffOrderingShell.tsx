'use client';

import { useEffect, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
};

export function StaffOrderingShell({
  open,
  title,
  onClose,
  closeDisabled = false,
  children,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeDisabled, onClose, open]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-ordering-shell-title"
        className={`
          fixed z-50 flex flex-col bg-brand-bg border-brand-border shadow-2xl
          transition-transform duration-300 ease-out
          inset-x-0 bottom-0 top-[12vh] rounded-t-3xl border-t
          md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-full md:max-w-4xl md:rounded-none md:border-l md:border-t-0
          ${open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
        `}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
          <h2 id="staff-ordering-shell-title" className="font-heading text-xl text-brand-gold truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="shrink-0 rounded-lg px-2 py-1 text-brand-text-muted hover:text-brand-text disabled:opacity-40"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </>
  );
}
