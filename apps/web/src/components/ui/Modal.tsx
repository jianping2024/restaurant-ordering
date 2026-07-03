'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

const overlayClassName =
  'fixed inset-0 z-50 flex min-h-0 items-center justify-center overflow-y-auto px-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:px-4 sm:pt-[max(1rem,env(safe-area-inset-top,0px))] sm:pb-[max(1rem,env(safe-area-inset-bottom,0px))]';

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className={overlayClassName}>
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative z-10 mx-auto flex w-full max-h-full flex-col rounded-2xl border border-brand-border bg-brand-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${sizes[size]}`}
      >
        {title ? (
          <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-border px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="font-heading text-xl text-brand-gold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-brand-text-muted transition-colors hover:text-brand-text"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
        <div className="modal-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
