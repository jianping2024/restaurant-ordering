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
  type CheckoutCloseFloorRole,
} from '@/lib/waiter-table-checkout-close';
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
import type { WaiterOrderLine } from '@/components/waiter/waiter-table-card';
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
        variant="drawer"
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
  showCloseTable,
  isDemo,
  closingDemoTable,
  closeLabel,
  onDemoCloseClick,
  onTableClosed,
}: {
  tableId: string;
  isCheckoutPending: boolean;
  showCloseTable: boolean;
  isDemo: boolean;
  closingDemoTable: boolean;
  closeLabel: string;
  onDemoCloseClick: () => void;
  onTableClosed: () => void;
}) {
  if (!showCloseTable) return null;

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
      closeConfirmEntry="reason"
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
  restaurantSlug,
  tableId,
  sessionId,
  label,
  floorStaffRole,
  checkoutLocked,
  onCheckoutLocked,
  onClosed,
}: {
  lang: UILanguage;
  t: WaiterCopy;
  restaurantSlug: string;
  tableId: string;
  sessionId: string | null;
  label: string;
  floorStaffRole: CheckoutCloseFloorRole;
  checkoutLocked: boolean;
  onCheckoutLocked: () => void;
  onClosed: () => void;
}) {
  const orderHistory = getMessages(lang).orderHistory;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const icon = <WaiterBillIcon className={buttonIcon.sm} />;
  const confirmTitle =
    floorStaffRole === 'cashier' ? t.checkoutCloseConfirmTitleCashier : t.checkoutCloseConfirmTitle;

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
        slug: restaurantSlug,
        tableId,
        sessionId,
        floorStaffRole,
      });
      if (!outcome.ok) {
        if (outcome.stage === 'print') {
          showToast(t.checkoutClosePrintFailed, 'error');
          return;
        }
        if (outcome.code === 'session_billing' || outcome.code === 'checkout_in_progress') {
          showToast(t.checkoutLockedHint, 'info');
          return;
        }
        if (outcome.code === 'partial_payment_ledger') {
          showToast(t.checkoutLockedHint, 'info');
          return;
        }
        if (outcome.code === 'unfinished_kitchen_orders') {
          showToast(orderHistory.closeTableBlocked, 'error');
          return;
        }
        if (outcome.code === 'no_session') {
          showToast(t.checkoutCloseNoSession, 'error');
          return;
        }
        showToast(t.checkoutCloseFailed, 'error');
        return;
      }
      setConfirmOpen(false);
      showToast(orderHistory.closeTableSuccess, 'success');
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
  restaurantSlug: string;
  tableId: string;
  sessionId: string | null;
  onContinueOrdering: () => void;
  isCheckoutPending: boolean;
  /** Together-group member — transfer/merge disabled. */
  inTableParty: boolean;
  onCheckoutLocked: () => void;
  onTransfer: () => void;
  onMerge: () => void;
  showCheckoutClose: boolean;
  showCloseTable: boolean;
  /** Required when showCheckoutClose — frontdesk prints; cashier skips print. */
  floorStaffRole?: CheckoutCloseFloorRole;
  isDemo: boolean;
  closingDemoTable: boolean;
  onDemoCloseClick: () => void;
  onTableClosed: () => void;
};

export function WaiterTableOccupiedToolbar({
  t,
  lang,
  restaurantSlug,
  tableId,
  sessionId,
  onContinueOrdering,
  isCheckoutPending,
  inTableParty,
  onCheckoutLocked,
  onTransfer,
  onMerge,
  showCheckoutClose,
  showCloseTable,
  floorStaffRole = 'frontdesk',
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
          <WaiterTableSecondaryButton
            type="button"
            onClick={onTransfer}
            disabled={transferMergeDisabled}
            icon={<WaiterTransferIcon className={buttonIcon.sm} />}
          >
            {t.transfer}
          </WaiterTableSecondaryButton>
          <WaiterTableSecondaryButton
            type="button"
            onClick={onMerge}
            disabled={transferMergeDisabled}
            icon={<WaiterMergeIcon className={buttonIcon.sm} />}
          >
            {t.merge}
          </WaiterTableSecondaryButton>
          {showCheckoutClose ? (
            <WaiterTableCheckoutCloseControl
              lang={lang}
              t={t}
              restaurantSlug={restaurantSlug}
              tableId={tableId}
              sessionId={sessionId}
              label={t.goToBill}
              floorStaffRole={floorStaffRole}
              checkoutLocked={isCheckoutPending}
              onCheckoutLocked={onCheckoutLocked}
              onClosed={onTableClosed}
            />
          ) : null}
          <ToolbarCloseTableControl
            tableId={tableId}
            isCheckoutPending={isCheckoutPending}
            showCloseTable={showCloseTable}
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
  /** Preformatted session total for sticky chrome; null hides the amount. */
  sessionTotalText: string | null;
  /** Frontdesk manual pre_bill — presentational only; null hides the control. */
  preBillPrint: {
    label: string;
    busy: boolean;
    onPrint: () => void;
  } | null;
  lines: WaiterOrderLine[];
  isCheckoutPending: boolean;
  decrementingKey: string | null;
  orderLineKey: (orderId: string, itemIdx: number) => string;
  onDecrement: (orderId: string, itemIdx: number) => void;
};

export function WaiterTableOrderedItemsPanel({
  title,
  sessionTotalText,
  preBillPrint,
  lines,
  isCheckoutPending,
  decrementingKey,
  orderLineKey,
  onDecrement,
}: OrderedItemsProps) {
  if (lines.length === 0) return null;

  return (
    <WaiterDetailCard>
      <div className={waiterDetailLayout.orderedItemsHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <WaiterClocheIcon className={`${buttonIcon.md} shrink-0 text-brand-gold`} />
          <h2 className={waiterDetailLayout.orderedItemsTitle}>{title}</h2>
        </div>
        {sessionTotalText || preBillPrint ? (
          <div className={waiterDetailLayout.orderedItemsHeaderActions}>
            {sessionTotalText ? (
              <p className={waiterDetailLayout.orderedItemsTotal}>{sessionTotalText}</p>
            ) : null}
            {preBillPrint ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={preBillPrint.busy}
                onClick={preBillPrint.onPrint}
              >
                {preBillPrint.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={waiterDetailLayout.sectionBody}>
        {lines.map((line) => (
          <div key={`${line.orderId}-${line.itemIdx}`} className={waiterDetailLayout.orderedItemRow}>
            <p className={waiterDetailLayout.orderedItemLabel}>
              {line.label}
            </p>
            {(line.quantityLabel || line.canDecrement) ? (
              <div className={waiterDetailLayout.orderedItemActions}>
                {line.quantityLabel ? (
                  <span className={waiterDetailLayout.orderedItemQty}>{line.quantityLabel}</span>
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
        ))}
      </div>
    </WaiterDetailCard>
  );
}
