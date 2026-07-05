'use client';

import { useEffect, useState } from 'react';
import { PasswordInput } from '@mesa/ui';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface PasswordConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  passwordLabel: string;
  passwordRequiredError: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (password: string) => void | Promise<void>;
  confirming?: boolean;
  externalError?: string | null;
}

export function PasswordConfirmDialog({
  open,
  onClose,
  title,
  message,
  passwordLabel,
  passwordRequiredError,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirming = false,
  externalError = null,
}: PasswordConfirmDialogProps) {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setLocalError(null);
    }
  }, [open]);

  const handleConfirm = () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setLocalError(passwordRequiredError);
      return;
    }
    setLocalError(null);
    void onConfirm(trimmed);
  };

  const displayError = externalError || localError;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-brand-text-muted leading-relaxed whitespace-pre-wrap">{message}</p>
        <PasswordInput
          label={passwordLabel}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setLocalError(null);
          }}
          disabled={confirming}
          autoComplete="current-password"
        />
        {displayError ? (
          <p className="text-sm text-red-400" role="alert">
            {displayError}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 border-t border-brand-border/60 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={confirming}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
