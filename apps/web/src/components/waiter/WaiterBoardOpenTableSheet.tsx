'use client';

import { useCallback, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { WaiterBoardOpenTableForm } from '@/components/waiter/WaiterBoardOpenTableForm';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import type { WaiterBoardOpenTableDefaults } from '@/lib/waiter-board-open-table';
import {
  activeBuffetsFromModel,
  buildIdleOpenTablePageModel,
} from '@/lib/waiter-board-open-table';
import type { UILanguage } from '@/lib/i18n';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import {
  openTableSheetLayout,
  WaiterTablePrimaryButton,
  WaiterTableSecondaryButton,
  buttonIcon,
} from '@/components/waiter/waiter-table-detail-ui';
import { WaiterTableIcon } from '@/components/waiter/waiter-table-detail-icons';

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenTableSuccess: (model: WaiterTablePageModel) => void;
  onStaleBoard: () => void;
  restaurant: { id: string; name: string; slug: string };
  tableId: string;
  displayName: string;
  table: RestaurantTableRow | null;
  openTableDefaults: WaiterBoardOpenTableDefaults | null;
  lang: UILanguage;
  /** When true: hide buffet/headcount; one 〔开台〕 button. */
  isTakeawayTable?: boolean;
};

export function WaiterBoardOpenTableSheet({
  open,
  onClose,
  onOpenTableSuccess,
  onStaleBoard,
  restaurant,
  tableId,
  displayName,
  table,
  openTableDefaults,
  lang,
  isTakeawayTable = false,
}: Props) {
  const t = WAITER_TEXT[lang];

  const hasSeed = open && table != null && openTableDefaults != null;
  const missingSeed = open && !hasSeed && !isTakeawayTable;

  const sheetModel = useMemo(() => {
    if (isTakeawayTable) return null;
    if (!hasSeed || !table || !openTableDefaults) return null;
    return buildIdleOpenTablePageModel(openTableDefaults, table);
  }, [hasSeed, isTakeawayTable, openTableDefaults, table]);

  const [takeawaySubmitting, setTakeawaySubmitting] = useState(false);

  const openTakeaway = useCallback(async () => {
    setTakeawaySubmitting(true);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurant.slug)}/staff/waiter/open-takeaway`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_id: tableId }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        session_id?: string;
      };
      if (res.status === 409 && data.error === 'already_open') {
        onStaleBoard();
        onClose();
        return;
      }
      if (!res.ok || !data.session_id) {
        return;
      }
      onStaleBoard();
      onClose();
    } finally {
      setTakeawaySubmitting(false);
    }
  }, [onClose, onStaleBoard, restaurant.slug, tableId]);

  const sheetBody = (() => {
    if (isTakeawayTable) {
      return (
        <div className={openTableSheetLayout.stack}>
          <p className="text-sm text-brand-text-muted text-center py-2">
            {lang === 'zh'
              ? '外卖桌：开台后按外卖价点单，无需人数/套餐。'
              : 'Takeaway desk: open without guest count / buffet.'}
          </p>
          <div className={openTableSheetLayout.actionRow}>
            <WaiterTableSecondaryButton
              type="button"
              onClick={onClose}
              disabled={takeawaySubmitting}
              className={openTableSheetLayout.actionButton}
            >
              {t.closeTableCancel}
            </WaiterTableSecondaryButton>
            <WaiterTablePrimaryButton
              type="button"
              onClick={() => void openTakeaway()}
              disabled={takeawaySubmitting}
              loading={takeawaySubmitting}
              className={openTableSheetLayout.actionButton}
              icon={<WaiterTableIcon className={buttonIcon.sm} />}
            >
              {lang === 'zh' ? '开台' : t.buffetConfirm}
            </WaiterTablePrimaryButton>
          </div>
        </div>
      );
    }

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
        onOpenTableSuccess={onOpenTableSuccess}
        onStaleBoard={onStaleBoard}
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
