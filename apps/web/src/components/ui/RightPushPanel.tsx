'use client';

import { useEffect, type ReactNode } from 'react';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';

export type RightPushPanelWidth = 'ordering' | 'form';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  closeDisabled?: boolean;
  /**
   * `ordering` = continue-order menu (~max-w-4xl).
   * `form` = checkout take-away editor (~max-w-xl).
   */
  width?: RightPushPanelWidth;
  /** Title element id (a11y). */
  titleId?: string;
  titleClassName?: string;
  children: ReactNode;
};

const WIDTH_CLASS: Record<RightPushPanelWidth, string> = {
  ordering: 'md:max-w-4xl',
  form: 'md:max-w-xl',
};

/**
 * Sole staff right-push / phone bottom-sheet chrome (continue order + checkout take-away).
 * Backdrop + Escape + body scroll lock; content is the caller's responsibility.
 */
export function RightPushPanel({
  open,
  title,
  onClose,
  closeDisabled = false,
  width = 'ordering',
  titleId = 'right-push-panel-title',
  titleClassName = 'font-heading text-xl text-brand-ink',
  children,
}: Props) {
  useBodyScrollLock(open);

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
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
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
        aria-labelledby={titleId}
        className={`
          fixed z-[70] flex flex-col bg-brand-bg border-brand-border shadow-2xl
          transition-transform duration-300 ease-out
          inset-x-0 bottom-0 top-[12vh] rounded-t-3xl border-t
          md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-full md:rounded-none md:border-l md:border-t-0
          ${WIDTH_CLASS[width]}
          ${open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
        `}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
          <h2 id={titleId} className={`${titleClassName} truncate`}>
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
