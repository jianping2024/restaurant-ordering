'use client';

import { useEffect, useState } from 'react';
import {
  BuffetPackagesEstimatedTotal,
  WaiterBuffetPackagesEditor,
} from '@/components/waiter/WaiterBuffetPackagesEditor';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { toastBuffetGuestCountViolation } from '@/lib/waiter-buffet-open-failure-toast';
import {
  buffetGuestCountViolation,
  buffetGuestRuleForDraft,
  currentTableBuffet,
  effectiveTableBuffet,
  selectTableBuffetDraft,
  totalGuestsFromCounts,
  type ResolvedBuffetPriceRow,
  type TableBuffetSelection,
} from '@/lib/buffet-order';
import type { UILanguage } from '@/lib/i18n';
import type { Buffet, Order } from '@/types';

type Labels = {
  title: string;
  confirm: string;
  cancel: string;
  needHeadcount: string;
};

type Props = {
  open: boolean;
  lang: UILanguage;
  activeBuffets: Buffet[];
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
  sessionOrders: Order[];
  busy: boolean;
  labels: Labels;
  onClose: () => void;
  onConfirm: (buffet: TableBuffetSelection) => void | Promise<void>;
};

/**
 * Sole checkout-detail headcount editor after zero-headcount soft-confirm.
 * Package is fixed when the table already has one; only headcount is edited.
 * Confirm still requires at least one guest (checkout soft-confirm path).
 */
export function CheckoutHeadcountAdjustModal({
  open,
  lang,
  activeBuffets,
  buffetPricesByBuffetId,
  sessionOrders,
  busy,
  labels,
  onClose,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState<TableBuffetSelection | null>(null);
  const [packageLocked, setPackageLocked] = useState(false);

  useEffect(() => {
    if (!open) return;
    const current = currentTableBuffet(sessionOrders);
    setPackageLocked(current != null);
    setDraft(
      current
        ?? (activeBuffets[0] ? { buffetId: activeBuffets[0].id, adults: 0, children: 0 } : null),
    );
  }, [open, sessionOrders, activeBuffets]);

  const effectiveDraft = effectiveTableBuffet(draft);
  const hasGuests = effectiveDraft != null && totalGuestsFromCounts(effectiveDraft) > 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      title={labels.title}
      size="md"
      dismissOnBackdrop={!busy}
    >
      <div className="space-y-4">
        <WaiterBuffetPackagesEditor
          lang={lang}
          buffetOptions={activeBuffets}
          draft={draft}
          onSelectBuffet={(buffetId) => {
            if (packageLocked) return;
            setDraft((prev) =>
              selectTableBuffetDraft(prev, buffetId, buffetPricesByBuffetId[buffetId]),
            );
          }}
          onSetGuestCount={(which, value) => {
            setDraft((prev) => (prev ? { ...prev, [which]: Math.max(0, value) } : prev));
          }}
          resolvedByBuffetId={buffetPricesByBuffetId}
          priceLoading={false}
          layout="sheet"
          disabled={busy}
          packageLocked={packageLocked}
          hideEstimatedTotal
        />
        <BuffetPackagesEstimatedTotal
          lang={lang}
          draft={draft}
          resolvedByBuffetId={buffetPricesByBuffetId}
        />
        {!hasGuests ? (
          <p className="text-sm text-brand-text-muted">{labels.needHeadcount}</p>
        ) : null}
        <ModalConfirmActions
          cancelLabel={labels.cancel}
          confirmLabel={labels.confirm}
          onCancel={() => {
            if (busy) return;
            onClose();
          }}
          onConfirm={() => {
            if (busy || !effectiveDraft || !hasGuests) return;
            const guestRule = buffetGuestRuleForDraft(
              effectiveDraft,
              activeBuffets,
              buffetPricesByBuffetId,
            );
            const violation = guestRule
              ? buffetGuestCountViolation({
                  ...guestRule,
                  adults: effectiveDraft.adults,
                  children: effectiveDraft.children,
                })
              : null;
            if (violation) {
              toastBuffetGuestCountViolation(WAITER_TEXT[lang], violation);
              return;
            }
            void onConfirm(effectiveDraft);
          }}
          busy={busy}
          confirmDisabled={!hasGuests}
        />
      </div>
    </Modal>
  );
}
