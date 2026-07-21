'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import { showToast } from '@/components/ui/Toast';
import { interpretCloseTableSessionResponse } from '@/lib/close-table-session-ui';
import { postCloseTableSessionClient } from '@/lib/close-table-session-client';
import { getMessages } from '@/lib/i18n/messages';
import { abnormalReasonOptions } from '@/lib/audit/reason-labels';

export type CloseTableConfirmEntry = 'generic' | 'reason';

interface Props {
  tableId: string;
  /** When true, use checkout copy in the unpaid-close reason dialog. */
  isCheckoutPending?: boolean;
  /** `reason` opens the unpaid-close dialog on click (table detail); default `generic` ConfirmModal. */
  closeConfirmEntry?: CloseTableConfirmEntry;
  /** When false, host handles success UX (e.g. navigate away). Default true. */
  showSuccessToast?: boolean;
  onClosed?: () => void;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  leadingIcon?: ReactNode;
}

export function CloseTableSessionAction({
  tableId,
  isCheckoutPending = false,
  closeConfirmEntry = 'generic',
  showSuccessToast = true,
  onClosed,
  className = '',
  variant = 'close',
  size = 'action',
  disabled = false,
  leadingIcon,
}: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const unpaidCloseReasonOptionsList = useMemo(
    () => abnormalReasonOptions(lang, 'unpaid_close'),
    [lang],
  );

  const [closingTable, setClosingTable] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unpaidCloseReasonOpen, setUnpaidCloseReasonOpen] = useState(false);
  const [unpaidCloseReasonError, setUnpaidCloseReasonError] = useState<string | null>(null);

  const closeConfirmCopy = useMemo(
    () => ({
      title: i18n.closeTableConfirmTitle,
      message: i18n.closeTableConfirmMessage,
    }),
    [i18n],
  );

  const unpaidCloseReasonMessage = useMemo(
    () =>
      isCheckoutPending
        ? i18n.closeTableUnpaidReasonMessageCheckout
        : i18n.closeTableUnpaidReasonMessage,
    [isCheckoutPending, i18n],
  );

  const reasonCloseEntry = closeConfirmEntry === 'reason' || isCheckoutPending;

  const handleCloseTable = async (
    closeTableId: string,
    confirmClose = false,
    closeReason?: string,
    closeReasonDetail?: string,
  ) => {
    if (closingTable) return;
    setClosingTable(closeTableId);
    setUnpaidCloseReasonError(null);
    try {
      const { status, body: data } = await postCloseTableSessionClient({
        table_id: closeTableId,
        confirm_close: confirmClose,
        close_reason: closeReason,
        close_reason_detail: closeReasonDetail,
      });
      const next = interpretCloseTableSessionResponse(status, data);
      if (next.action === 'no_session') {
        showToast(i18n.closeTableNoSession, 'error');
        return;
      }
      if (next.action === 'confirm_close') {
        if (reasonCloseEntry) {
          setUnpaidCloseReasonOpen(true);
        } else {
          setConfirmOpen(true);
        }
        return;
      }
      if (next.action === 'reason_required') {
        setUnpaidCloseReasonOpen(true);
        return;
      }
      if (next.action === 'forbidden') {
        showToast(next.message ?? i18n.closeTableForbidden, 'error');
        return;
      }
      if (next.action === 'invalid_reason') {
        setUnpaidCloseReasonError(i18n.closeTableUnpaidReasonRequired);
        setUnpaidCloseReasonOpen(true);
        return;
      }
      if (next.action === 'reason_detail_required') {
        setUnpaidCloseReasonError(i18n.closeTableUnpaidReasonDetailRequired);
        setUnpaidCloseReasonOpen(true);
        return;
      }
      if (next.action === 'error') {
        showToast(i18n.closeTableFailed, 'error');
        return;
      }
      setUnpaidCloseReasonOpen(false);
      setConfirmOpen(false);
      if (showSuccessToast) {
        showToast(i18n.closeTableSuccess, 'success');
      }
      onClosed?.();
      if (showSuccessToast) {
        router.refresh();
      }
    } catch {
      showToast(i18n.closeTableFailed, 'error');
    } finally {
      setClosingTable(null);
    }
  };

  const isClosing = closingTable === tableId;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        loading={isClosing}
        aria-label={i18n.closeTable}
        onClick={() => {
          if (reasonCloseEntry) {
            setUnpaidCloseReasonOpen(true);
            return;
          }
          setConfirmOpen(true);
        }}
        className={className}
      >
        {leadingIcon}
        {i18n.closeTable}
      </Button>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={closeConfirmCopy.title}
        message={closeConfirmCopy.message}
        confirmLabel={i18n.closeTableConfirmButton}
        cancelLabel={i18n.closeTableCancel}
        variant="danger"
        confirming={isClosing}
        onConfirm={async () => {
          setConfirmOpen(false);
          await handleCloseTable(tableId, true);
        }}
      />
      <ReasonConfirmDialog
        open={unpaidCloseReasonOpen}
        onClose={() => {
          setUnpaidCloseReasonOpen(false);
          setUnpaidCloseReasonError(null);
        }}
        title={i18n.closeTableUnpaidReasonTitle}
        message={unpaidCloseReasonMessage}
        reasonLabel={i18n.closeTableUnpaidReasonLabel}
        detailLabel={i18n.closeTableUnpaidReasonDetailLabel}
        detailPlaceholder={i18n.closeTableUnpaidReasonDetailPlaceholder}
        confirmLabel={i18n.closeTableConfirmButton}
        cancelLabel={i18n.closeTableCancel}
        reasonRequiredError={i18n.closeTableUnpaidReasonRequired}
        detailRequiredError={i18n.closeTableUnpaidReasonDetailRequired}
        reasons={unpaidCloseReasonOptionsList}
        confirming={isClosing}
        externalError={unpaidCloseReasonError}
        onConfirm={async (reason, detail) => {
          await handleCloseTable(tableId, true, reason, detail);
        }}
      />
    </>
  );
}
