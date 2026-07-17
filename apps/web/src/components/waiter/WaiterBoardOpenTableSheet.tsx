'use client';

import { useMemo } from 'react';
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
  WaiterTableSecondaryButton,
} from '@/components/waiter/waiter-table-detail-ui';

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
}: Props) {
  const t = WAITER_TEXT[lang];

  const hasSeed = open && table != null && openTableDefaults != null;
  const missingSeed = open && !hasSeed;

  const sheetModel = useMemo(() => {
    if (!hasSeed || !table || !openTableDefaults) return null;
    return buildIdleOpenTablePageModel(openTableDefaults, table);
  }, [hasSeed, openTableDefaults, table]);

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
