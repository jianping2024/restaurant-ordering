'use client';

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
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { getMessages } from '@/lib/i18n/messages';
import { requestEnsureStaffCheckoutEntry } from '@/lib/request-ensure-staff-checkout-entry';
import { messageForCheckoutRequestError } from '@/lib/checkout-request-error-message';
import { useRouter } from 'next/navigation';
import type { WaiterDetailSessionBusyKind } from '@/lib/use-waiter-detail-session-busy';
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
  /** Session-write mutex — freeze headcount while another write is in flight. */
  sessionBusy?: boolean;
  /**
   * Cold open only (`intent=open`). Occupied tables autosave headcount — no confirm row.
   */
  confirmOpen: {
    label: string;
    submitting: boolean;
    onConfirm: () => void;
  } | null;
};

export function BuffetGuestCounter({
  label,
  qty,
  onQtyChange,
  onDecrement,
  onIncrement,
  layout = 'detail',
  disabled = false,
}: {
  label: string;
  qty: number;
  onQtyChange: (value: number) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  layout?: 'detail' | 'sheet';
  disabled?: boolean;
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
        disabled={disabled}
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
  sessionBusy = false,
  confirmOpen,
}: BuffetPanelProps) {
  const confirmDisabled =
    !confirmOpen
    || confirmOpen.submitting
    || sessionBusy
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
          disabled={sessionBusy}
        />
        {confirmOpen ? (
          <div className={waiterDetailLayout.buffetDetailSummaryRow}>
            <div aria-hidden className="hidden sm:block" />
            <div className={waiterDetailLayout.buffetDetailSummaryActions}>
              <WaiterTablePrimaryButton
                onClick={confirmOpen.onConfirm}
                disabled={confirmDisabled}
                icon={<WaiterTableIcon className={buttonIcon.sm} />}
              >
                {confirmOpen.submitting ? '…' : confirmOpen.label}
              </WaiterTablePrimaryButton>
            </div>
          </div>
        ) : null}
      </div>
    </WaiterDetailCard>
  );
}

function ContinueOrderingControl({
  label,
  checkoutLocked,
  sessionBusy,
  onCheckoutLocked,
  onContinueOrdering,
}: {
  label: string;
  checkoutLocked: boolean;
  sessionBusy: boolean;
  onCheckoutLocked: () => void;
  onContinueOrdering: () => void;
}) {
  const icon = <WaiterPlusIcon className={buttonIcon.sm} />;

  if (checkoutLocked) {
    return (
      <WaiterTablePrimaryButton
        type="button"
        onClick={onCheckoutLocked}
        disabled={sessionBusy}
        icon={icon}
      >
        {label}
      </WaiterTablePrimaryButton>
    );
  }

  return (
    <WaiterTablePrimaryButton
      type="button"
      onClick={onContinueOrdering}
      disabled={sessionBusy}
      icon={icon}
    >
      {label}
    </WaiterTablePrimaryButton>
  );
}

function ToolbarCloseTableControl({
  tableId,
  isCheckoutPending,
  showForceClose,
  isDemo,
  sessionBusy,
  closeBusy,
  closeLabel,
  onDemoCloseClick,
  onTableClosed,
  onBeginForceCloseBusy,
  onEndSessionBusy,
}: {
  tableId: string;
  isCheckoutPending: boolean;
  showForceClose: boolean;
  isDemo: boolean;
  sessionBusy: boolean;
  closeBusy: boolean;
  closeLabel: string;
  onDemoCloseClick: () => void;
  onTableClosed: () => void;
  onBeginForceCloseBusy: () => boolean;
  onEndSessionBusy: () => void;
}) {
  if (!showForceClose) return null;

  const closeIcon = <WaiterPowerIcon className={buttonIcon.sm} />;

  if (isDemo) {
    return (
      <WaiterTablePrimaryButton
        type="button"
        variant="close"
        onClick={onDemoCloseClick}
        disabled={sessionBusy && !closeBusy}
        loading={closeBusy}
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
      disabled={sessionBusy && !closeBusy}
      onBeginSessionBusy={onBeginForceCloseBusy}
      onEndSessionBusy={onEndSessionBusy}
    />
  );
}

/** Floor「呼叫结账」: ensure checkout entry → dashboard checkout. */
function WaiterTableCallCheckoutControl({
  lang,
  t,
  restaurantSlug,
  tableId,
  sessionId,
  checkoutLocked,
  sessionBusy,
  callCheckoutBusy,
  onCheckoutLocked,
  tryBeginSessionBusy,
  endSessionBusy,
}: {
  lang: UILanguage;
  t: WaiterCopy;
  restaurantSlug: string;
  tableId: string;
  sessionId: string | null;
  checkoutLocked: boolean;
  sessionBusy: boolean;
  callCheckoutBusy: boolean;
  onCheckoutLocked: () => void;
  tryBeginSessionBusy: (kind: WaiterDetailSessionBusyKind) => boolean;
  endSessionBusy: () => void;
}) {
  const router = useRouter();
  const messages = getMessages(lang);
  const checkout = messages.checkout;
  const bill = messages.bill;

  const handleClick = async () => {
    if (checkoutLocked) {
      onCheckoutLocked();
      return;
    }
    if (!sessionId) {
      showToast(t.callCheckoutNoSession, 'error');
      return;
    }
    if (!tryBeginSessionBusy('call_checkout')) return;
    let keepBusy = false;
    try {
      const outcome = await requestEnsureStaffCheckoutEntry({
        slug: restaurantSlug,
        tableId,
      });
      if (!outcome.ok) {
        showToast(
          messageForCheckoutRequestError(outcome.error, {
            guestCountRequired: checkout.callCheckoutGuestCountRequired,
            partyMergeRequired: checkout.callCheckoutPartyMergeRequired,
            emptySession: checkout.callCheckoutEmptySession,
            noActiveSession: checkout.callCheckoutNoActiveSession,
            tableNotAvailable: checkout.callCheckoutTableNotAvailable,
            invalidNif: bill.nifInvalid,
            splitPlanLocked: bill.splitPlanLocked,
            fallback: checkout.callCheckoutFailed,
          }),
          'error',
        );
        return;
      }
      keepBusy = true;
      router.push(
        `/dashboard/checkout?table_id=${encodeURIComponent(tableId)}&request_id=${encodeURIComponent(outcome.bill_split_id)}`,
      );
    } catch {
      showToast(checkout.callCheckoutFailed, 'error');
    } finally {
      if (!keepBusy) endSessionBusy();
    }
  };

  return (
    <WaiterTableSecondaryButton
      type="button"
      onClick={() => void handleClick()}
      disabled={sessionBusy && !callCheckoutBusy}
      loading={callCheckoutBusy}
      aria-label={checkout.callCheckout}
      icon={<WaiterBillIcon className={buttonIcon.sm} />}
    >
      {callCheckoutBusy ? checkout.callCheckoutOperating : checkout.callCheckout}
    </WaiterTableSecondaryButton>
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
  showTransfer: boolean;
  showMerge: boolean;
  showCallCheckout: boolean;
  showForceClose: boolean;
  isDemo: boolean;
  sessionBusy: boolean;
  sessionBusyKind: WaiterDetailSessionBusyKind | null;
  tryBeginSessionBusy: (kind: WaiterDetailSessionBusyKind) => boolean;
  endSessionBusy: () => void;
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
  showTransfer,
  showMerge,
  showCallCheckout,
  showForceClose,
  isDemo,
  sessionBusy,
  sessionBusyKind,
  tryBeginSessionBusy,
  endSessionBusy,
  onDemoCloseClick,
  onTableClosed,
}: OccupiedToolbarProps) {
  const transferMergeDisabled = isCheckoutPending || inTableParty || sessionBusy;
  const callCheckoutBusy = sessionBusyKind === 'call_checkout';
  const closeBusy =
    sessionBusyKind === 'force_close' || sessionBusyKind === 'demo_close';
  return (
    <WaiterDetailCard>
      <div className={waiterDetailLayout.cardBody}>
        <div className={waiterDetailLayout.occupiedToolbarRow}>
          <ContinueOrderingControl
            label={t.continueOrdering}
            checkoutLocked={isCheckoutPending}
            sessionBusy={sessionBusy}
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
          {showCallCheckout ? (
            <WaiterTableCallCheckoutControl
              lang={lang}
              t={t}
              restaurantSlug={restaurantSlug}
              tableId={tableId}
              sessionId={sessionId}
              checkoutLocked={isCheckoutPending}
              sessionBusy={sessionBusy}
              callCheckoutBusy={callCheckoutBusy}
              onCheckoutLocked={onCheckoutLocked}
              tryBeginSessionBusy={tryBeginSessionBusy}
              endSessionBusy={endSessionBusy}
            />
          ) : null}
          <ToolbarCloseTableControl
            tableId={tableId}
            isCheckoutPending={isCheckoutPending}
            showForceClose={showForceClose}
            isDemo={isDemo}
            sessionBusy={sessionBusy}
            closeBusy={closeBusy}
            closeLabel={t.closeTable}
            onDemoCloseClick={onDemoCloseClick}
            onTableClosed={onTableClosed}
            onBeginForceCloseBusy={() => tryBeginSessionBusy('force_close')}
            onEndSessionBusy={endSessionBusy}
          />
        </div>
      </div>
    </WaiterDetailCard>
  );
}

type OrderedItemsProps = {
  title: string;
  /**
   * Sole UI gate for sticky 饮食/合计, line unit €, and chargeable € hints
   * (host: floorCaps.canViewTableDetailAmounts).
   */
  showAmounts: boolean;
  /** Session amount lines for sticky chrome; null hides the amount block when showAmounts. */
  sessionAmount: WaiterOrderedItemsSessionAmount | null;
  /** Frontdesk manual pre_bill — presentational only; null hides the control. */
  preBillPrint: {
    label: string;
    busy: boolean;
    disabled?: boolean;
    onPrint: () => void;
  } | null;
  lines: WaiterOrderLine[];
  /** Optional: format chargeable qty hint; null/omit hides the hint. */
  formatChargeableHint?: (qty: number, unitPrice: number) => string;
  isCheckoutPending: boolean;
  sessionBusy: boolean;
  decrementingKey: string | null;
  servingKey: string | null;
  orderLineKey: (orderId: string, itemIdx: number) => string;
  onDecrement: (orderId: string, itemIdx: number) => void;
  onServe: (orderId: string, itemIdx: number) => void;
  serveLabel: string;
};

export function WaiterTableOrderedItemsPanel({
  title,
  showAmounts,
  sessionAmount,
  preBillPrint,
  lines,
  formatChargeableHint,
  isCheckoutPending,
  sessionBusy,
  decrementingKey,
  servingKey,
  orderLineKey,
  onDecrement,
  onServe,
  serveLabel,
}: OrderedItemsProps) {
  if (lines.length === 0) return null;

  const lineActionsLocked = isCheckoutPending || sessionBusy;
  const amountChrome = showAmounts ? sessionAmount : null;

  return (
    <WaiterDetailCard>
      {amountChrome || preBillPrint ? (
        <div className={waiterDetailLayout.orderedItemsMoneyChrome}>
          {amountChrome?.mealsLine ? (
            <p className={waiterDetailLayout.orderedItemsMoneyLine}>{amountChrome.mealsLine}</p>
          ) : null}
          {amountChrome?.totalLine ? (
            <p className={waiterDetailLayout.orderedItemsMoneyLine}>{amountChrome.totalLine}</p>
          ) : null}
          {preBillPrint ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={waiterDetailLayout.orderedItemsPreBillAction}
              loading={preBillPrint.busy}
              disabled={preBillPrint.disabled || (sessionBusy && !preBillPrint.busy)}
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
            showAmounts && formatChargeableHint && share
              ? formatChargeableHint(share.qty, share.unitPrice)
              : null;
          const serveKey =
            line.canServe && line.serveOrderId != null && line.serveItemIdx != null
              ? orderLineKey(line.serveOrderId, line.serveItemIdx)
              : null;
          const thisDecrementBusy =
            decrementingKey === orderLineKey(line.orderId, line.itemIdx);
          const thisServeBusy = serveKey != null && servingKey === serveKey;
          return (
            <div key={line.catalogKey} className="min-w-0">
              <div className={waiterDetailLayout.orderedItemRow}>
                <div className={waiterDetailLayout.orderedItemIdentity}>
                  {line.itemCode ? (
                    <span className={waiterDetailLayout.orderedItemCode}>{line.itemCode}</span>
                  ) : null}
                  <p className={waiterDetailLayout.orderedItemLabel}>{line.label}</p>
                  {showAmounts && line.unitPrice != null && Number.isFinite(line.unitPrice) ? (
                    <span className={waiterDetailLayout.orderedItemUnitPrice}>
                      €{line.unitPrice.toFixed(2)}
                    </span>
                  ) : null}
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
                        disabled={lineActionsLocked && !thisServeBusy}
                        loading={thisServeBusy}
                        onClick={() => onServe(line.serveOrderId!, line.serveItemIdx!)}
                      >
                        {serveLabel}
                      </Button>
                    ) : null}
                    {line.canDecrement ? (
                      <WaiterOrderQtyMinus
                        onDecrement={() => onDecrement(line.orderId, line.itemIdx)}
                        disabled={lineActionsLocked && !thisDecrementBusy}
                        busy={thisDecrementBusy}
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
