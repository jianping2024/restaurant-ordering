'use client';

import { useCallback, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import {
  WaiterBoardOpenTableForm,
  type WaiterBoardOpenTableFooterActions,
} from '@/components/waiter/WaiterBoardOpenTableForm';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import type { WaiterBoardOpenTableDefaults } from '@/lib/waiter-board-open-table';
import {
  activeBuffetsFromModel,
  buildIdleOpenTablePageModel,
} from '@/lib/waiter-board-open-table';
import type { UILanguage } from '@/lib/i18n';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterOpenableState } from '@/components/waiter/useWaiterOpenableBuffetIds';
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
   * Takeaway desk: confirm only. No buffet list and no per-package price lookup.
   * Confirm calls open-takeaway (no buffet write).
   */
  isTakeawayTable?: boolean;
  /** Prefetched on the board; forwarded into the open form so the sheet does not cold-fetch. */
  boardOpenable?: WaiterOpenableState;
};

/**
 * Open-table Modal actions: pinned in `Modal.footer`, equal-width fill, confirm keeps table icon.
 * (Not `ModalConfirmActions` — that hug/end row is for ordinary dialogs.)
 */
function OpenTableSheetFooterActions({
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  busy,
  confirmDisabled = false,
}: {
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  confirmDisabled?: boolean;
}) {
  return (
    <div className={openTableSheetLayout.actionRow}>
      <WaiterTableSecondaryButton
        type="button"
        onClick={onCancel}
        disabled={busy}
        className={openTableSheetLayout.actionButton}
      >
        {cancelLabel}
      </WaiterTableSecondaryButton>
      <WaiterTablePrimaryButton
        type="button"
        onClick={onConfirm}
        disabled={busy || confirmDisabled}
        loading={busy}
        className={openTableSheetLayout.actionButton}
        icon={<WaiterTableIcon className={buttonIcon.sm} />}
      >
        {confirmLabel}
      </WaiterTablePrimaryButton>
    </div>
  );
}

function OpenTableSheetCancelFooter({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
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
  boardOpenable,
}: Props) {
  const t = WAITER_TEXT[lang];

  const hasSeed = open && table != null && openTableDefaults != null;
  const missingSeed = open && !hasSeed && !isTakeawayTable;

  const sheetModel = useMemo(() => {
    if (!hasSeed || !table || !openTableDefaults) return null;
    return buildIdleOpenTablePageModel(openTableDefaults, table);
  }, [hasSeed, openTableDefaults, table]);

  const hasPickableBuffets =
    sheetModel != null && activeBuffetsFromModel(sheetModel).length > 0;

  const [takeawaySubmitting, setTakeawaySubmitting] = useState(false);
  const [buffetFooter, setBuffetFooter] = useState<WaiterBoardOpenTableFooterActions | null>(
    null,
  );

  const onFooterActionsChange = useCallback(
    (actions: WaiterBoardOpenTableFooterActions | null) => {
      setBuffetFooter(actions);
    },
    [],
  );

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

  const sheetBody = (() => {
    if (isTakeawayTable) {
      return (
        <div className={openTableSheetLayout.stack}>
          <p className="text-sm text-brand-text-muted text-center py-2">
            {t.takeawayHeadcountLockedHint}
          </p>
        </div>
      );
    }

    if (missingSeed || !sheetModel) {
      return (
        <div className={openTableSheetLayout.stack}>
          <p className="text-sm text-brand-text-muted py-4 text-center">
            {missingSeed ? t.buffetNoRule : t.actionFailed}
          </p>
        </div>
      );
    }

    if (!hasPickableBuffets) {
      return (
        <div className={openTableSheetLayout.stack}>
          <p className="text-sm text-brand-text-muted py-4 text-center">{t.buffetNoRule}</p>
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
        onFooterActionsChange={onFooterActionsChange}
        boardOpenable={boardOpenable}
      />
    );
  })();

  const sheetFooter = (() => {
    if (isTakeawayTable) {
      return (
        <OpenTableSheetFooterActions
          cancelLabel={t.closeTableCancel}
          confirmLabel={t.takeawayOpenConfirm}
          onCancel={onClose}
          onConfirm={() => void openTakeaway()}
          busy={takeawaySubmitting}
        />
      );
    }

    if (missingSeed || !sheetModel || !hasPickableBuffets) {
      return <OpenTableSheetCancelFooter label={t.closeTableCancel} onClose={onClose} />;
    }

    return (
      <OpenTableSheetFooterActions
        cancelLabel={t.closeTableCancel}
        confirmLabel={t.buffetConfirm}
        onCancel={onClose}
        onConfirm={() => buffetFooter?.onConfirm()}
        busy={buffetFooter?.busy ?? false}
        confirmDisabled={buffetFooter == null || buffetFooter.confirmDisabled}
      />
    );
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t.table} ${displayName}`}
      size="lg"
      footer={sheetFooter}
    >
      {sheetBody}
    </Modal>
  );
}
