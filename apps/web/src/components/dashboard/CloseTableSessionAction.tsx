'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import { showToast } from '@/components/ui/Toast';
import { interpretCloseTableSessionResponse } from '@/lib/close-table-session-ui';
import { getMessages } from '@/lib/i18n/messages';
import { abnormalReasonOptions } from '@/lib/audit/reason-labels';

interface Props {
  tableId: string;
  /** When true, open the unpaid-close reason dialog directly (checkout page). */
  isCheckoutPending?: boolean;
  onClosed?: () => void;
  className?: string;
  disabled?: boolean;
}

export function CloseTableSessionAction({
  tableId,
  isCheckoutPending = false,
  onClosed,
  className = 'text-sm px-3 py-1.5 rounded-lg border border-brand-border text-brand-text hover:border-brand-gold/50 hover:text-brand-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
  disabled = false,
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

  const handleCloseTable = async (
    closeTableId: string,
    confirmClose = false,
    closeReason?: string,
    closeReasonDetail?: string,
  ) => {
    setClosingTable(closeTableId);
    setUnpaidCloseReasonError(null);
    try {
      const res = await fetch('/api/dashboard/close-table-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: closeTableId,
          confirm_close: confirmClose,
          ...(closeReason ? { close_reason: closeReason } : {}),
          ...(closeReasonDetail ? { close_reason_detail: closeReasonDetail } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        message?: string;
      };
      const next = interpretCloseTableSessionResponse(res.status, data);
      if (next.action === 'no_session') {
        showToast(i18n.closeTableNoSession, 'error');
        return;
      }
      if (next.action === 'confirm_close') {
        if (isCheckoutPending) {
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
      showToast(i18n.closeTableSuccess, 'success');
      onClosed?.();
      router.refresh();
    } catch {
      showToast(i18n.closeTableFailed, 'error');
    } finally {
      setClosingTable(null);
    }
  };

  const isClosing = closingTable === tableId;

  return (
    <>
      <button
        type="button"
        disabled={disabled || isClosing}
        onClick={() => {
          if (isCheckoutPending) {
            setUnpaidCloseReasonOpen(true);
            return;
          }
          setConfirmOpen(true);
        }}
        className={className}
      >
        {isClosing ? i18n.closeTableOperating : i18n.closeTable}
      </button>
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
