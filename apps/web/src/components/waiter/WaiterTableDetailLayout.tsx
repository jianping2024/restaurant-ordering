'use client';

import { useState } from 'react';
import type { Buffet } from '@/types';
import {
  WaiterBuffetPackagesEditor,
  isBuffetPackagesEditorReady,
} from '@/components/waiter/WaiterBuffetPackagesEditor';
import {
  formatBuffetPriceTemplate,
  type BuffetGuestSnapshot,
  type BuffetOpenPricePreview,
  type ResolvedBuffetPriceRow,
} from '@/lib/buffet-order';
import type { UILanguage } from '@/lib/i18n';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { CloseTableSessionAction } from '@/components/dashboard/CloseTableSessionAction';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { getMessages } from '@/lib/i18n/messages';
import {
  runWaiterTableCheckoutClose,
} from '@/lib/waiter-table-checkout-close';
import type { FloorBoardCapabilities } from '@/lib/floor-board-capabilities';
import {
  WaiterBillIcon,
  WaiterClocheIcon,
  WaiterMergeIcon,
  WaiterPlusIcon,
  WaiterPowerIcon,
  WaiterTableIcon,
  WaiterTransferIcon,
} from '@/components/waiter/waiter-table-detail-icons';
import { WaiterOrderQtyMinus } from '@/components/waiter/WaiterOrderQtyMinus';
import { chargeableShareOf } from '@/lib/billable-session-lines';
import type { WaiterOrderLine } from '@/components/waiter/waiter-table-card';
import type { WaiterOrderedItemsSessionAmount } from '@/lib/waiter-table-detail-display';
import type { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  buttonIcon,
  WaiterDetailCard,
  waiterDetailLayout,
  waiterFloorType,
  WaiterTablePrimaryButton,
  WaiterTableSecondaryButton,
} from '@/components/waiter/waiter-table-detail-ui';

type WaiterCopy = (typeof WAITER_TEXT)[keyof typeof WAITER_TEXT];

export function WaiterCheckoutPendingBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-500/45 bg-amber-500/12 px-3 py-2.5"
    >
      <p className="text-[13px] font-medium text-amber-950/95 dark:text-amber-100/95 leading-snug">
        {message}
      </p>
    </div>
  );
}

type BuffetPanelProps = {
  lang: UILanguage;
  activeBuffets: Buffet[];
  guestSnapshot: BuffetGuestSnapshot;
  onSetGuestCount: (buffetId: string, which: 'adults' | 'children', value: number) => void;
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
  buffetPriceLoading: boolean;
  buffetActionLabel: string;
  buffetSubmitting: boolean;
  onSave: () => void;
};

export function BuffetGuestCounter({
  label,
  qty,
  onQtyChange,
  onDecrement,
  onIncrement,
  layout = 'detail',
}: {
  label: string;
  qty: number;
  onQtyChange: (value: number) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  layout?: 'detail' | 'sheet';
}) {
  const rowClass =
    layout === 'sheet'
      ? 'flex items-center justify-between gap-3'
      : 'flex items-center justify-start gap-3 xl:justify-center';

  return (
    <div className={rowClass}>
      <span className={waiterFloorType.guestLabel}>{label}</span>
      <CartQtyStepper
        qty={qty}
        onQtyChange={onQtyChange}
        qtyInputAriaLabel={label}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
      />
    </div>
  );
}

export function BuffetPriceMeta({
  t,
  buffetPriceLoading,
  buffetPriceDisplay,
}: {
  t: WaiterCopy;
  buffetPriceLoading: boolean;
  buffetPriceDisplay: BuffetOpenPricePreview;
}) {
  if (buffetPriceLoading) {
    return <p className={waiterFloorType.priceLineLoading}>{t.buffetPriceLoading}</p>;
  }
  if (buffetPriceDisplay.ok) {
    return (
      <p className={waiterFloorType.priceLine}>
        {formatBuffetPriceTemplate(t.buffetPriceRatesLine, {
          adultPrice: buffetPriceDisplay.adultPrice,
          childPrice: buffetPriceDisplay.childPrice,
        })}
      </p>
    );
  }
  return <p className="mt-1 text-[15px] font-medium mesa-text-warning">{t.buffetNoRule}</p>;
}

export function WaiterTableBuffetPanel({
  lang,
  activeBuffets,
  guestSnapshot,
  onSetGuestCount,
  resolvedByBuffetId,
  buffetPriceLoading,
  buffetActionLabel,
  buffetSubmitting,
  onSave,
}: BuffetPanelProps) {
  const saveDisabled =
    buffetSubmitting
    || !isBuffetPackagesEditorReady(guestSnapshot, resolvedByBuffetId, buffetPriceLoading);

  return (
    <WaiterDetailCard>
      <div className={waiterDetailLayout.cardBody}>
        <WaiterBuffetPackagesEditor
          lang={lang}
          activeBuffets={activeBuffets}
          guestSnapshot={guestSnapshot}
          onSetGuestCount={onSetGuestCount}
          resolvedByBuffetId={resolvedByBuffetId}
          priceLoading={buffetPriceLoading}
          layout="detail"
        />
        <div className={waiterDetailLayout.buffetDetailSummaryRow}>
          <div aria-hidden className="hidden sm:block" />
          <div className={waiterDetailLayout.buffetDetailSummaryActions}>
            <WaiterTablePrimaryButton onClick={onSave} disabled={saveDisabled} icon={<WaiterTableIcon className={buttonIcon.sm} />}>
              {buffetSubmitting ? '…' : buffetActionLabel}
            </WaiterTablePrimaryButton>
          </div>
        </div>
      </div>
    </WaiterDetailCard>
  );
}

function ContinueOrderingControl({
  label,
  checkoutLocked,
  onCheckoutLocked,
  onContinueOrdering,
}: {
  label: string;
  checkoutLocked: boolean;
  onCheckoutLocked: () => void;
  onContinueOrdering: () => void;
}) {
  const icon = <WaiterPlusIcon className={buttonIcon.sm} />;

  if (checkoutLocked) {
    return (
      <WaiterTablePrimaryButton type="button" onClick={onCheckoutLocked} icon={icon}>
        {label}
      </WaiterTablePrimaryButton>
    );
  }

  return (
    <WaiterTablePrimaryButton type="button" onClick={onContinueOrdering} icon={icon}>
      {label}
    </WaiterTablePrimaryButton>
  );
}

function ToolbarCloseTableControl({
  tableId,
  isCheckoutPending,
  showForceClose,
  isDemo,
  closingDemoTable,
  closeLabel,
  onDemoCloseClick,
  onTableClosed,
}: {
  tableId: string;
  isCheckoutPending: boolean;
  showForceClose: boolean;
  isDemo: boolean;
  closingDemoTable: boolean;
  closeLabel: string;
  onDemoCloseClick: () => void;
  onTableClosed: () => void;
}) {
  if (!showForceClose) return null;

  const closeIcon = <WaiterPowerIcon className={buttonIcon.sm} />;

  if (isDemo) {
    return (
      <WaiterTablePrimaryButton
        type="button"
        variant="close"
        onClick={onDemoCloseClick}
        loading={closingDemoTable}
        aria-label={closeLabel}
        icon={closeIcon}
      >
        {closeLabel}
      </WaiterTablePrimaryButton>
    );
  }

  return (
    <CloseTableSessionAction
      tableId={tableId}
      isCheckoutPending={isCheckoutPending}
      showSuccessToast={false}
      onClosed={onTableClosed}
      variant="close"
      size="action"
      className={waiterDetailLayout.primaryAction}
      leadingIcon={closeIcon}
    />
  );
}

function WaiterTableCheckoutCloseControl({
  lang,
  t,
  tableId,
  sessionId,
  label,
  printBillOnClose,
  checkoutLocked,
  onCheckoutLocked,
  onClosed,
}: {
  lang: UILanguage;
  t: WaiterCopy;
  tableId: string;
  sessionId: string | null;
  label: string;
  printBillOnClose: boolean;
  checkoutLocked: boolean;
  onCheckoutLocked: () => void;
  onClosed: () => void;
}) {
  const orderHistory = getMessages(lang).orderHistory;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const icon = <WaiterBillIcon className={buttonIcon.sm} />;
  const confirmTitle = printBillOnClose
    ? t.checkoutCloseConfirmTitle
    : t.checkoutCloseConfirmTitleCashier;

  const handleClick = () => {
    if (checkoutLocked) {
      onCheckoutLocked();
      return;
    }
    if (!sessionId) {
      showToast(t.checkoutCloseNoSession, 'error');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (busy || !sessionId) return;
    setBusy(true);
    try {
      const outcome = await runWaiterTableCheckoutClose({
        tableId,
        printBill: printBillOnClose,
      });
      if (!outcome.ok) {
        if (outcome.code === 'no_session') {
          showToast(t.checkoutCloseNoSession, 'error');
          return;
        }
        showToast(t.checkoutCloseFailed, 'error');
        return;
      }
      setConfirmOpen(false);
      showToast(orderHistory.closeTableSuccess, 'success');
      if (outcome.printFailed) {
        showToast(t.checkoutClosePrintFailed, 'error');
      }
      onClosed();
    } catch {
      showToast(t.checkoutCloseFailed, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <WaiterTableSecondaryButton
        type="button"
        onClick={handleClick}
        loading={busy}
        aria-label={label}
        icon={icon}
      >
        {label}
      </WaiterTableSecondaryButton>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => {
          if (busy) return;
          setConfirmOpen(false);
        }}
        title={confirmTitle}
        message=""
        confirmLabel={orderHistory.closeTableConfirmButton}
        cancelLabel={orderHistory.closeTableCancel}
        confirming={busy}
        onConfirm={handleConfirm}
      />
    </>
  );
}

type OccupiedToolbarProps = {
  t: WaiterCopy;
  lang: UILanguage;
  tableId: string;
  sessionId: string | null;
  onContinueOrdering: () => void;
  isCheckoutPending: boolean;
  /** Together-group member — transfer/merge disabled. */
  inTableParty: boolean;
  onCheckoutLocked: () => void;
  onTransfer: () => void;
  onMerge: () => void;
  showTransfer: boolean;
  showMerge: boolean;
  showCheckoutClose: boolean;
  showForceClose: boolean;
  floorCapabilities: FloorBoardCapabilities;
  isDemo: boolean;
  closingDemoTable: boolean;
  onDemoCloseClick: () => void;
  onTableClosed: () => void;
};

export function WaiterTableOccupiedToolbar({
  t,
  lang,
  tableId,
  sessionId,
  onContinueOrdering,
  isCheckoutPending,
  inTableParty,
  onCheckoutLocked,
  onTransfer,
  onMerge,
  showTransfer,
  showMerge,
  showCheckoutClose,
  showForceClose,
  floorCapabilities,
  isDemo,
  closingDemoTable,
  onDemoCloseClick,
  onTableClosed,
}: OccupiedToolbarProps) {
  const transferMergeDisabled = isCheckoutPending || inTableParty;
  return (
    <WaiterDetailCard>
      <div className={waiterDetailLayout.cardBody}>
        <div className={waiterDetailLayout.occupiedToolbarRow}>
          <ContinueOrderingControl
            label={t.continueOrdering}
            checkoutLocked={isCheckoutPending}
            onCheckoutLocked={onCheckoutLocked}
            onContinueOrdering={onContinueOrdering}
          />
          {showTransfer ? (
            <WaiterTableSecondaryButton
              type="button"
              onClick={onTransfer}
              disabled={transferMergeDisabled}
              icon={<WaiterTransferIcon className={buttonIcon.sm} />}
            >
              {t.transfer}
            </WaiterTableSecondaryButton>
          ) : null}
          {showMerge ? (
            <WaiterTableSecondaryButton
              type="button"
              onClick={onMerge}
              disabled={transferMergeDisabled}
              icon={<WaiterMergeIcon className={buttonIcon.sm} />}
            >
              {t.merge}
            </WaiterTableSecondaryButton>
          ) : null}
          {showCheckoutClose ? (
            <WaiterTableCheckoutCloseControl
              lang={lang}
              t={t}
              tableId={tableId}
              sessionId={sessionId}
              label={t.goToBill}
              printBillOnClose={floorCapabilities.canPrintOnCheckoutClose}
              checkoutLocked={isCheckoutPending}
              onCheckoutLocked={onCheckoutLocked}
              onClosed={onTableClosed}
            />
          ) : null}
          <ToolbarCloseTableControl
            tableId={tableId}
            isCheckoutPending={isCheckoutPending}
            showForceClose={showForceClose}
            isDemo={isDemo}
            closingDemoTable={closingDemoTable}
            closeLabel={t.closeTable}
            onDemoCloseClick={onDemoCloseClick}
            onTableClosed={onTableClosed}
          />
        </div>
      </div>
    </WaiterDetailCard>
  );
}

type OrderedItemsProps = {
  title: string;
  /** Session amount lines for sticky chrome; null hides the amount block. */
  sessionAmount: WaiterOrderedItemsSessionAmount | null;
  /** Frontdesk manual pre_bill — presentational only; null hides the control. */
  preBillPrint: {
    label: string;
    busy: boolean;
    onPrint: () => void;
  } | null;
  lines: WaiterOrderLine[];
  /** Optional: format chargeable qty hint; null/omit hides the hint. */
  formatChargeableHint?: (qty: number, unitPrice: number) => string;
  isCheckoutPending: boolean;
  decrementingKey: string | null;
  servingKey: string | null;
  orderLineKey: (orderId: string, itemIdx: number) => string;
  onDecrement: (orderId: string, itemIdx: number) => void;
  onServe: (orderId: string, itemIdx: number) => void;
  serveLabel: string;
};

export function WaiterTableOrderedItemsPanel({
  title,
  sessionAmount,
  preBillPrint,
  lines,
  formatChargeableHint,
  isCheckoutPending,
  decrementingKey,
  servingKey,
  orderLineKey,
  onDecrement,
  onServe,
  serveLabel,
}: OrderedItemsProps) {
  if (lines.length === 0) return null;

  return (
    <WaiterDetailCard>
      {sessionAmount || preBillPrint ? (
        <div className={waiterDetailLayout.orderedItemsMoneyChrome}>
          {sessionAmount?.mealsLine ? (
            <p className={waiterDetailLayout.orderedItemsMoneyLine}>{sessionAmount.mealsLine}</p>
          ) : null}
          {sessionAmount?.totalLine ? (
            <p className={waiterDetailLayout.orderedItemsMoneyLine}>{sessionAmount.totalLine}</p>
          ) : null}
          {preBillPrint ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={waiterDetailLayout.orderedItemsPreBillAction}
              loading={preBillPrint.busy}
              onClick={preBillPrint.onPrint}
            >
              {preBillPrint.label}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className={waiterDetailLayout.sectionBody}>
        <div className={waiterDetailLayout.orderedItemsTitleRow}>
          <WaiterClocheIcon className={`${buttonIcon.md} shrink-0 text-brand-gold`} />
          <h2 className={waiterDetailLayout.orderedItemsTitle}>{title}</h2>
        </div>
        {lines.map((line) => {
          const share = chargeableShareOf({
            chargeableQty: line.chargeableQty ?? undefined,
            chargeableUnitPrice: line.chargeableUnitPrice ?? undefined,
          });
          const chargeableHint =
            formatChargeableHint && share
              ? formatChargeableHint(share.qty, share.unitPrice)
              : null;
          const serveKey =
            line.canServe && line.serveOrderId != null && line.serveItemIdx != null
              ? orderLineKey(line.serveOrderId, line.serveItemIdx)
              : null;
          return (
            <div key={line.catalogKey} className="min-w-0">
              <div className={waiterDetailLayout.orderedItemRow}>
                <div className={waiterDetailLayout.orderedItemIdentity}>
                  {line.itemCode ? (
                    <span className={waiterDetailLayout.orderedItemCode}>{line.itemCode}</span>
                  ) : null}
                  <p className={waiterDetailLayout.orderedItemLabel}>{line.label}</p>
                  {line.statusLabel ? (
                    <span className={waiterDetailLayout.orderedItemStatus}>{line.statusLabel}</span>
                  ) : null}
                </div>
                {(line.quantityLabel || line.canDecrement || line.canServe) ? (
                  <div className={waiterDetailLayout.orderedItemActions}>
                    {line.quantityLabel ? (
                      <span className={waiterDetailLayout.orderedItemQty}>{line.quantityLabel}</span>
                    ) : null}
                    {line.canServe && line.serveOrderId != null && line.serveItemIdx != null ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isCheckoutPending}
                        loading={servingKey === serveKey}
                        onClick={() => onServe(line.serveOrderId!, line.serveItemIdx!)}
                      >
                        {serveLabel}
                      </Button>
                    ) : null}
                    {line.canDecrement ? (
                      <WaiterOrderQtyMinus
                        onDecrement={() => onDecrement(line.orderId, line.itemIdx)}
                        disabled={isCheckoutPending}
                        busy={decrementingKey === orderLineKey(line.orderId, line.itemIdx)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              {chargeableHint ? (
                <p className={waiterDetailLayout.orderedItemChargeableHint}>{chargeableHint}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </WaiterDetailCard>
  );
}
