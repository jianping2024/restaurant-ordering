'use client';

import { Button, type ButtonVariant } from '@/components/ui/Button';

export type ModalConfirmActionsProps = {
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Disables cancel and drives confirm `loading`. */
  busy?: boolean;
  /** Extra disable on confirm (e.g. invalid form) while cancel stays usable unless `busy`. */
  confirmDisabled?: boolean;
  confirmVariant?: Extract<ButtonVariant, 'gold' | 'danger'>;
  /** Top rule + denser pad — password / reason / form sheets. */
  divided?: boolean;
  className?: string;
};

const rowClass = 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end';
const plainPadClass = 'pt-1';
const dividedClass = 'border-t border-brand-border/60 pt-4';

/**
 * Sole cancel + confirm footer for Modal dialogs (staff touch: both `size="action"`).
 * Do not hand-roll a second flex-col-reverse confirm row beside this.
 */
export function ModalConfirmActions({
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  busy = false,
  confirmDisabled = false,
  confirmVariant = 'gold',
  divided = false,
  className = '',
}: ModalConfirmActionsProps) {
  return (
    <div
      className={[rowClass, divided ? dividedClass : plainPadClass, className]
        .filter(Boolean)
        .join(' ')}
    >
      <Button type="button" variant="outline" size="action" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button
        type="button"
        variant={confirmVariant}
        size="action"
        loading={busy}
        disabled={busy || confirmDisabled}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
