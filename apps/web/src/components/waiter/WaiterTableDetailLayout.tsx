'use client';

import { useMemo, useState } from 'react';
import type { Buffet } from '@/types';
import {
  BuffetPackagesEstimatedTotal,
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
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import { showToast } from '@/components/ui/Toast';
import { abnormalReasonOptions } from '@/lib/audit/reason-labels';
import { getMessages } from '@/lib/i18n/messages';
import { runWaiterTableCheckoutClose } from '@/lib/waiter-table-checkout-close';
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
  WaiterTablePrimaryButton,
  WaiterTablePrimaryLink,
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
      <span className="text-[13px] text-brand-text min-w-[2rem]">{label}</span>
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
    return <p className="mt-1 text-[13px] text-brand-text-muted">{t.buffetPriceLoading}</p>;
  }
  if (buffetPriceDisplay.ok) {
    return (
      <p className="mt-1 text-[13px] leading-snug text-brand-text-muted">
        {formatBuffetPriceTemplate(t.buffetPriceRatesLine, {
          adultPrice: buffetPriceDisplay.adultPrice,
          childPrice: buffetPriceDisplay.childPrice,
        })}
      </p>
    );
  }
  return <p className="mt-1 text-[13px] mesa-text-warning">{t.buffetNoRule}</p>;
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
            <BuffetPackagesEstimatedTotal
              lang={lang}
              guestSnapshot={guestSnapshot}
              resolvedByBuffetId={resolvedByBuffetId}
            />
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
  menuHref,
  label,
  checkoutLocked,
  onCheckoutLocked,
}: {
  menuHref: string;
  label: string;
  checkoutLocked: boolean;
  onCheckoutLocked: () => void;
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
    <WaiterTablePrimaryLink href={menuHref} icon={icon}>
      {label}
    </WaiterTablePrimaryLink>
  );
}

function ToolbarCloseTableControl({
  tableId,
  isCheckoutPending,
  showCloseTable,
  isDemo,
  closingDemoTable,
  closeLabel,
  closeOperatingLabel,
  onDemoCloseClick,
  onTableClosed,
}: {
  tableId: string;
  isCheckoutPending: boolean;
  showCloseTable: boolean;
  isDemo: boolean;
  closingDemoTable: boolean;
  closeLabel: string;
  closeOperatingLabel: string;
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
        disabled={closingDemoTable}
        icon={closeIcon}
      >
        {closingDemoTable ? closeOperatingLabel : closeLabel}
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
  checkoutLocked: boolean;
  onCheckoutLocked: () => void;
  onClosed: () => void;
}) {
  const orderHistory = getMessages(lang).orderHistory;
  const unpaidCloseReasonOptionsList = useMemo(
    () => abnormalReasonOptions(lang, 'unpaid_close'),
    [lang],
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const icon = <WaiterBillIcon className={buttonIcon.sm} />;

  const handleClick = () => {
    if (checkoutLocked) {
      onCheckoutLocked();
      return;
    }
    if (!sessionId) {
      showToast(t.checkoutCloseNoSession, 'error');
      return;
    }
    setReasonError(null);
    setConfirmOpen(true);
  };

  const handleConfirm = async (reason: string, detail: string) => {
    if (!sessionId) return;
    setBusy(true);
    setReasonError(null);
    try {
      const outcome = await runWaiterTableCheckoutClose({
        slug: restaurantSlug,
        tableId,
        sessionId,
        closeReason: reason,
        closeReasonDetail: detail || undefined,
      });
      if (!outcome.ok) {
        if (outcome.stage === 'print') {
          showToast(t.checkoutClosePrintFailed, 'error');
          return;
        }
        if (outcome.code === 'invalid_reason') {
          setReasonError(orderHistory.closeTableUnpaidReasonRequired);
          return;
        }
        if (outcome.code === 'reason_detail_required') {
          setReasonError(orderHistory.closeTableUnpaidReasonDetailRequired);
          return;
        }
        if (outcome.code === 'forbidden') {
          showToast(outcome.message ?? orderHistory.closeTableForbidden, 'error');
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
        disabled={busy}
        icon={icon}
      >
        {busy ? t.checkoutCloseOperating : label}
      </WaiterTableSecondaryButton>
      <ReasonConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (busy) return;
          setConfirmOpen(false);
          setReasonError(null);
        }}
        title={t.checkoutCloseConfirmTitle}
        message={t.checkoutCloseConfirmMessage}
        reasonLabel={orderHistory.closeTableUnpaidReasonLabel}
        detailLabel={orderHistory.closeTableUnpaidReasonDetailLabel}
        detailPlaceholder={orderHistory.closeTableUnpaidReasonDetailPlaceholder}
        confirmLabel={orderHistory.closeTableConfirmButton}
        cancelLabel={orderHistory.closeTableCancel}
        reasonRequiredError={orderHistory.closeTableUnpaidReasonRequired}
        detailRequiredError={orderHistory.closeTableUnpaidReasonDetailRequired}
        reasons={unpaidCloseReasonOptionsList}
        confirming={busy}
        externalError={reasonError}
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
  menuHref: string;
  isCheckoutPending: boolean;
  onCheckoutLocked: () => void;
  onTransfer: () => void;
  onMerge: () => void;
  showCheckoutClose: boolean;
  showCloseTable: boolean;
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
  menuHref,
  isCheckoutPending,
  onCheckoutLocked,
  onTransfer,
  onMerge,
  showCheckoutClose,
  showCloseTable,
  isDemo,
  closingDemoTable,
  onDemoCloseClick,
  onTableClosed,
}: OccupiedToolbarProps) {
  return (
    <WaiterDetailCard>
      <div className={waiterDetailLayout.cardBody}>
        <div className={waiterDetailLayout.occupiedToolbarRow}>
          <ContinueOrderingControl
            menuHref={menuHref}
            label={t.continueOrdering}
            checkoutLocked={isCheckoutPending}
            onCheckoutLocked={onCheckoutLocked}
          />
          <WaiterTableSecondaryButton
            type="button"
            onClick={onTransfer}
            disabled={isCheckoutPending}
            icon={<WaiterTransferIcon className={buttonIcon.sm} />}
          >
            {t.transfer}
          </WaiterTableSecondaryButton>
          <WaiterTableSecondaryButton
            type="button"
            onClick={onMerge}
            disabled={isCheckoutPending}
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
            closeOperatingLabel={t.closeTableOperating}
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
  lines: WaiterOrderLine[];
  isCheckoutPending: boolean;
  decrementingKey: string | null;
  orderLineKey: (orderId: string, itemIdx: number) => string;
  onDecrement: (orderId: string, itemIdx: number) => void;
};

export function WaiterTableOrderedItemsPanel({
  title,
  lines,
  isCheckoutPending,
  decrementingKey,
  orderLineKey,
  onDecrement,
}: OrderedItemsProps) {
  if (lines.length === 0) return null;

  return (
    <WaiterDetailCard className="overflow-hidden">
      <div className={waiterDetailLayout.sectionHeader}>
        <WaiterClocheIcon className={`${buttonIcon.md} text-brand-gold`} />
        <h2 className="text-[15px] font-semibold text-brand-text">{title}</h2>
      </div>
      <div className={waiterDetailLayout.sectionBody}>
        {lines.map((line) => (
          <div key={`${line.orderId}-${line.itemIdx}`} className="flex items-center justify-between gap-2">
            <p className="text-sm text-brand-text truncate min-w-0 flex-1">
              {line.itemCode ? (
                <span className="font-mono text-[11px] text-brand-gold tabular-nums mr-1">[{line.itemCode}]</span>
              ) : null}
              {line.label}
            </p>
            {(line.quantityLabel || line.canDecrement) ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                {line.quantityLabel ? (
                  <span className="text-sm text-brand-text tabular-nums">{line.quantityLabel}</span>
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
