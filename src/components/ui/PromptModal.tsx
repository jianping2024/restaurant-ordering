'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface PromptModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  submitLabel: string;
  cancelLabel: string;
  onSubmit: (value: string) => void | Promise<void>;
  submitting?: boolean;
}

/**
 * In-app text prompt (replaces window.prompt) using the same Modal shell as the rest of Mesa.
 */
export function PromptModal({
  open,
  onClose,
  title,
  label,
  defaultValue = '',
  placeholder,
  submitLabel,
  cancelLabel,
  onSubmit,
  submitting = false,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open, defaultValue]);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <label className="block">
          <span className="text-[13px] text-brand-text-muted">{label}</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder={placeholder}
            className="mt-1.5 w-full rounded-xl border border-brand-border bg-brand-bg px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-gold/35 focus:border-brand-gold/50"
            disabled={submitting}
            autoComplete="off"
          />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="gold" size="sm" loading={submitting} onClick={() => void handleSubmit()}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
