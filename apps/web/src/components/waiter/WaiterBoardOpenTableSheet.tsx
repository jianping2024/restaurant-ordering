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
import { postWaiterOpenTakeawayClient } from '@/lib/waiter-open-takeaway-client';

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
  /**
   * Takeaway desk: same open sheet chrome; headcount steppers locked;
   * confirm calls open-takeaway (no buffet write).
   */
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
    if (!hasSeed || !table || !openTableDefaults) return null;
    return buildIdleOpenTablePageModel(openTableDefaults, table);
  }, [hasSeed, openTableDefaults, table]);

  const [takeawaySubmitting, setTakeawaySubmitting] = useState(false);

  const openTakeaway = useCallback(async () => {
    setTakeawaySubmitting(true);
    try {
      const result = await postWaiterOpenTakeawayClient({
        restaurantSlug: restaurant.slug,
        tableId,
      });
      if (!result.ok) {
        if (result.alreadyOpen) {
          onStaleBoard();
          onClose();
        }
        return;
      }
      onStaleBoard();
      onClose();
    } finally {
      setTakeawaySubmitting(false);
    }
  }, [onClose, onStaleBoard, restaurant.slug, tableId]);

  const takeawaySimpleOpen = (
    <div className={openTableSheetLayout.stack}>
      <p className="text-sm text-brand-text-muted text-center py-2">
        {t.takeawayHeadcountLockedHint}
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
          {t.takeawayOpenConfirm}
        </WaiterTablePrimaryButton>
      </div>
    </div>
  );

  const sheetBody = (() => {
    if (isTakeawayTable && !sheetModel) {
      return takeawaySimpleOpen;
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
      if (isTakeawayTable) return takeawaySimpleOpen;
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
        headcountLocked={isTakeawayTable}
        takeawaySubmitting={takeawaySubmitting}
        onTakeawayOpen={openTakeaway}
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
