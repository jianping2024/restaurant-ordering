'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BuffetPackagesEstimatedTotal,
  WaiterBuffetPackagesEditor,
} from '@/components/waiter/WaiterBuffetPackagesEditor';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import {
  buildIdleBuffetDraftSnapshot,
  buffetSnapshotFromOrders,
  totalGuestsInBuffetSnapshot,
  type BuffetGuestSnapshot,
  type ResolvedBuffetPriceRow,
} from '@/lib/buffet-order';
import type { UILanguage } from '@/lib/i18n';
import type { Buffet, Order } from '@/types';

function seedHeadcountSnapshot(
  orders: Order[],
  activeBuffetIds: string[],
): BuffetGuestSnapshot {
  return {
    ...buildIdleBuffetDraftSnapshot(activeBuffetIds),
    ...buffetSnapshotFromOrders(orders),
  };
}

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
  onConfirm: (snapshot: BuffetGuestSnapshot) => void | Promise<void>;
};

/** Sole checkout-detail headcount editor after zero-headcount soft-confirm. */
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
  const activeBuffetIds = useMemo(() => activeBuffets.map((b) => b.id), [activeBuffets]);
  const [guestSnapshot, setGuestSnapshot] = useState<BuffetGuestSnapshot>({});

  useEffect(() => {
    if (!open) return;
    setGuestSnapshot(seedHeadcountSnapshot(sessionOrders, activeBuffetIds));
  }, [open, sessionOrders, activeBuffetIds]);

  const headcountOk = totalGuestsInBuffetSnapshot(guestSnapshot) > 0;

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
          activeBuffets={activeBuffets}
          guestSnapshot={guestSnapshot}
          onSetGuestCount={(buffetId, which, value) => {
            setGuestSnapshot((prev) => {
              const current = prev[buffetId] ?? { adults: 0, children: 0 };
              return {
                ...prev,
                [buffetId]: {
                  ...current,
                  [which]: Math.max(0, value),
                },
              };
            });
          }}
          resolvedByBuffetId={buffetPricesByBuffetId}
          priceLoading={false}
          layout="sheet"
          disabled={busy}
        />
        <BuffetPackagesEstimatedTotal
          lang={lang}
          guestSnapshot={guestSnapshot}
          resolvedByBuffetId={buffetPricesByBuffetId}
        />
        {!headcountOk ? (
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
            if (busy || !headcountOk) return;
            void onConfirm(guestSnapshot);
          }}
          busy={busy}
          confirmDisabled={!headcountOk}
        />
      </div>
    </Modal>
  );
}
