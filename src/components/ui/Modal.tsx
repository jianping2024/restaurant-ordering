'use client';

import { useEffect } from 'react';

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

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  // ESC 键关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // 防止背景滚动
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden p-2 sm:p-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* 内容 */}
      <div className={`
        relative my-2 sm:my-6 mx-auto bg-brand-card border border-brand-border rounded-2xl
        w-full ${sizes[size]} max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)] shadow-2xl flex flex-col
        animate-in fade-in zoom-in-95 duration-200
      `}>
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-brand-border flex-shrink-0">
            <h2 className="font-heading text-xl text-brand-gold">{title}</h2>
            <button onClick={onClose} className="text-brand-text-muted hover:text-brand-text transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="modal-scroll p-4 sm:p-6 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  );
}
