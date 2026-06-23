'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  /** Use danger styling for destructive actions (e.g. revoke). */
  variant?: 'default' | 'danger';
  confirming?: boolean;
}

/** In-app confirm dialog (replaces window.confirm); same API as @mesa/web ConfirmModal. */
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
  const handleClose = () => {
    if (confirming) return;
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{message}</p>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            loading={confirming}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
