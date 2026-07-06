'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import { WaiterBoardOpenTableForm } from '@/components/waiter/WaiterBoardOpenTableForm';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { fetchWaiterTablePageModelClient } from '@/lib/staff-board-client';
import type { WaiterBoardOpenTableDefaults } from '@/lib/waiter-board-open-table';
import {
  activeBuffetsFromModel,
  buildIdleOpenTablePageModel,
  reconcileOpenTablePageModel,
} from '@/lib/waiter-board-open-table';
import type { UILanguage } from '@/lib/i18n';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import {
  openTableSheetLayout,
  WaiterTableSecondaryButton,
} from '@/components/waiter/waiter-table-detail-ui';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurant: { id: string; name: string; slug: string };
  tableId: string;
  displayName: string;
  table: RestaurantTableRow | null;
  openTableDefaults: WaiterBoardOpenTableDefaults | null;
  reconcileEnabled?: boolean;
  lang: UILanguage;
};

export function WaiterBoardOpenTableSheet({
  open,
  onClose,
  onSuccess,
  restaurant,
  tableId,
  displayName,
  table,
  openTableDefaults,
  reconcileEnabled = true,
  lang,
}: Props) {
  const t = WAITER_TEXT[lang];
  const [reconciledModel, setReconciledModel] = useState<WaiterTablePageModel | null>(null);
  const [reconcile, setReconcile] = useState<'pending' | 'settled'>('settled');
  const [missingSeed, setMissingSeed] = useState(false);

  const seedModel = useMemo(() => {
    if (!open || !table || !openTableDefaults) return null;
    return buildIdleOpenTablePageModel(openTableDefaults, table);
  }, [open, openTableDefaults, table]);

  const sheetModel = reconciledModel ?? seedModel;

  useEffect(() => {
    if (!open) {
      setReconciledModel(null);
      setReconcile('settled');
      setMissingSeed(false);
      return;
    }

    if (!seedModel) {
      setMissingSeed(true);
      return;
    }
    setMissingSeed(false);

    if (!reconcileEnabled) {
      setReconcile('settled');
      return;
    }

    let cancelled = false;
    setReconcile('pending');

    void (async () => {
      try {
        const authoritative = await fetchWaiterTablePageModelClient(restaurant.slug, tableId);
        if (cancelled) return;

        const outcome = reconcileOpenTablePageModel(authoritative);
        if (outcome.kind === 'unavailable') {
          showToast(t.actionFailed, 'error');
          onClose();
          return;
        }
        if (outcome.kind === 'stale_occupied') {
          showToast(t.refreshHint, 'info');
          onSuccess();
          onClose();
          return;
        }
        setReconciledModel(outcome.model);
      } catch {
        if (!cancelled) showToast(t.actionFailed, 'error');
      } finally {
        if (!cancelled) setReconcile('settled');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, restaurant.slug, tableId, seedModel, reconcileEnabled, t.actionFailed, t.refreshHint, onClose, onSuccess]);

  const sheetBody = (() => {
    if (missingSeed || !sheetModel) {
      return (
        <div className={openTableSheetLayout.stack}>
          <p className="text-sm text-brand-text-muted py-4 text-center">
            {missingSeed ? t.buffetNoRule : t.actionFailed}
          </p>
          <SheetCancelButton label={t.closeTableCancel} onClose={onClose} />
        </div>
      );
    }

    if (activeBuffetsFromModel(sheetModel).length === 0) {
      return (
        <div className={openTableSheetLayout.stack}>
          <p className="text-sm text-brand-text-muted py-4 text-center">{t.buffetNoRule}</p>
          <SheetCancelButton label={t.closeTableCancel} onClose={onClose} />
        </div>
      );
    }

    return (
      <WaiterBoardOpenTableForm
        key={tableId}
        model={sheetModel}
        restaurant={restaurant}
        tableId={tableId}
        lang={lang}
        onClose={onClose}
        onSuccess={onSuccess}
        submitBlocked={reconcile === 'pending'}
      />
    );
  })();

  return (
    <Modal open={open} onClose={onClose} title={`${t.table} ${displayName}`} size="lg">
      {sheetBody}
    </Modal>
  );
}

function SheetCancelButton({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className={openTableSheetLayout.actionRow}>
      <WaiterTableSecondaryButton
        type="button"
        onClick={onClose}
        className={openTableSheetLayout.actionButton}
      >
        {label}
      </WaiterTableSecondaryButton>
    </div>
  );
}
