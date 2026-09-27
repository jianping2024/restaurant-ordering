'use client';

import { useEffect, useState } from 'react';
import { PasswordInput } from '@mesa/ui';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';

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
        <ModalConfirmActions
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          onCancel={onClose}
          onConfirm={handleConfirm}
          busy={confirming}
          confirmVariant="danger"
          divided
        />
      </div>
    </Modal>
  );
}
