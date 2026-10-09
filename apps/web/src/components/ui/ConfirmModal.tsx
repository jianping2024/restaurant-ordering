'use client';

import { useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  /** When omitted, only the confirm action is shown (e.g. peer notify). */
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  /** Use danger styling for destructive actions (e.g. delete). */
  variant?: 'default' | 'danger';
  confirming?: boolean;
}

/**
 * In-app confirm dialog (replaces window.confirm) using the same Modal shell as the rest of Mesa.
 */
export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = 'default',
  confirming = false,
}: ConfirmModalProps) {
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!open) {
      inFlightRef.current = false;
    }
  }, [open]);

  const handleConfirm = () => {
    if (inFlightRef.current || confirming) return;
    inFlightRef.current = true;
    void Promise.resolve(onConfirm()).finally(() => {
      inFlightRef.current = false;
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissOnBackdrop={variant === 'danger' ? false : !confirming}
    >
      <div className="space-y-4">
        <p className="text-sm text-brand-text leading-relaxed whitespace-pre-wrap">{message}</p>
        {cancelLabel ? (
          <ModalConfirmActions
            cancelLabel={cancelLabel}
            confirmLabel={confirmLabel}
            onCancel={onClose}
            onConfirm={handleConfirm}
            busy={confirming}
            confirmVariant={variant === 'danger' ? 'danger' : 'gold'}
          />
        ) : (
          <div className="pt-1">
            <Button
              type="button"
              variant="gold"
              size="action"
              className="w-full"
              loading={confirming}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
