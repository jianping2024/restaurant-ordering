'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { requiresAbnormalReasonDetail, type AbnormalReasonGroup } from '@/lib/audit/reasons';

export type ReasonOption = { value: string; label: string };

export interface ReasonConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  reasonLabel: string;
  detailLabel: string;
  detailPlaceholder: string;
  confirmLabel: string;
  cancelLabel: string;
  reasonRequiredError: string;
  detailRequiredError: string;
  reasons: ReasonOption[];
  reasonGroup?: AbnormalReasonGroup;
  voidItemWasServed?: boolean;
  onConfirm: (reason: string, detail: string) => void | Promise<void>;
  confirming?: boolean;
  externalError?: string | null;
}

export function ReasonConfirmDialog({
  open,
  onClose,
  title,
  message,
  reasonLabel,
  detailLabel,
  detailPlaceholder,
  confirmLabel,
  cancelLabel,
  reasonRequiredError,
  detailRequiredError,
  reasons,
  reasonGroup = 'unpaid_close',
  voidItemWasServed = false,
  onConfirm,
  confirming = false,
  externalError = null,
}: ReasonConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason('');
      setDetail('');
      setLocalError(null);
    }
  }, [open]);

  const needsDetail = reason
    ? requiresAbnormalReasonDetail(reasonGroup, reason, { voidItemWasServed })
    : false;

  const handleConfirm = () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setLocalError(reasonRequiredError);
      return;
    }
    if (needsDetail && !detail.trim()) {
      setLocalError(detailRequiredError);
      return;
    }
    setLocalError(null);
    void onConfirm(trimmedReason, detail.trim());
  };

  const displayError = externalError || localError;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-brand-text leading-relaxed whitespace-pre-wrap">{message}</p>
        <div className="space-y-2">
          <label className="block text-sm text-brand-text-muted" htmlFor="unpaid-close-reason">
            {reasonLabel}
          </label>
          <select
            id="unpaid-close-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setLocalError(null);
            }}
            disabled={confirming}
            className="w-full rounded-lg border border-brand-border bg-brand-card px-3 py-2 text-sm text-brand-text"
          >
            <option value="">{reasonLabel}</option>
            {reasons.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {needsDetail ? (
          <div className="space-y-2">
            <label className="block text-sm text-brand-text-muted" htmlFor="unpaid-close-detail">
              {detailLabel}
            </label>
            <textarea
              id="unpaid-close-detail"
              value={detail}
              onChange={(event) => {
                setDetail(event.target.value);
                setLocalError(null);
              }}
              disabled={confirming}
              rows={3}
              placeholder={detailPlaceholder}
              className="w-full rounded-lg border border-brand-border bg-brand-card px-3 py-2 text-sm text-brand-text resize-y"
            />
          </div>
        ) : null}
        {displayError ? (
          <p className="text-sm text-red-400" role="alert">
            {displayError}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
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
