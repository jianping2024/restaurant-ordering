'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

type Props = {
  title: string;
  triggerLabel: string;
  children: React.ReactNode;
};

function HelpIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** Opens help in a modal so long copy never reflows the settings page. */
export function SettingsPageHelp({ title, triggerLabel, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-brand-border/50 bg-brand-card/40 px-2 text-[12px] text-brand-text-muted transition-colors hover:border-brand-border hover:text-brand-gold"
        aria-haspopup="dialog"
      >
        <HelpIcon />
        <span>{triggerLabel}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="md">
        <div className="text-[13px] leading-relaxed text-brand-text-muted">{children}</div>
      </Modal>
    </>
  );
}
