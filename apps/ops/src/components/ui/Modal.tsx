'use client';

import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={`relative mx-auto my-2 flex max-h-[calc(100dvh-1rem)] w-full flex-col rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:my-6 sm:max-h-[calc(100dvh-3rem)] ${sizes[size]}`}
      >
        {title ? (
          <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="text-lg font-semibold text-amber-400">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 transition-colors hover:text-zinc-200"
              aria-label="关闭"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
