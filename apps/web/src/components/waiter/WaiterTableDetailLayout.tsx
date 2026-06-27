'use client';

import Link from 'next/link';
import type { Buffet } from '@/types';
import { formatBuffetPriceTemplate, type BuffetOpenPricePreview } from '@/lib/buffet-order';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { CloseTableSessionAction } from '@/components/dashboard/CloseTableSessionAction';
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
import { waiterUi } from '@/components/waiter/waiter-ui';
import type { WAITER_TEXT } from '@/components/waiter/waiter-messages';

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
  t: WaiterCopy;
  activeBuffets: Buffet[];
  selectedBuffet: Buffet | null;
  buffetId: string;
  onBuffetIdChange: (id: string) => void;
  buffetAdults: number;
  buffetChildren: number;
  onBumpCount: (which: 'adults' | 'children', delta: number) => void;
  buffetPriceLoading: boolean;
  buffetPriceDisplay: BuffetOpenPricePreview;
  buffetActionLabel: string;
  buffetSubmitting: boolean;
  onSave: () => void;
};

export function WaiterTableBuffetPanel({
  t,
  activeBuffets,
  selectedBuffet,
  buffetId,
  onBuffetIdChange,
  buffetAdults,
  buffetChildren,
  onBumpCount,
  buffetPriceLoading,
  buffetPriceDisplay,
  buffetActionLabel,
  buffetSubmitting,
  onSave,
}: BuffetPanelProps) {
  return (
    <div className={`${waiterUi.cardSurface} p-4`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 xl:flex-1">
          {activeBuffets.length === 1 ? (
            <p className="text-[15px] font-semibold text-brand-text leading-snug">{selectedBuffet?.name}</p>
          ) : (
            <select
              value={buffetId}
              onChange={(e) => onBuffetIdChange(e.target.value)}
              aria-label={t.buffetBlock}
              className="block w-full rounded-lg bg-brand-bg border border-brand-border px-2.5 py-2 text-[15px] font-semibold text-brand-text"
            >
              {activeBuffets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {buffetPriceLoading ? (
            <p className="mt-1 text-[13px] text-brand-text-muted">{t.buffetPriceLoading}</p>
          ) : buffetPriceDisplay.ok ? (
            <p className="mt-1 text-[13px] leading-snug text-brand-text-muted">
              {formatBuffetPriceTemplate(t.buffetPriceRatesLine, {
                adultPrice: buffetPriceDisplay.adultPrice,
                childPrice: buffetPriceDisplay.childPrice,
              })}
            </p>
          ) : (
            <p className="mt-1 text-[13px] mesa-text-warning">{t.buffetNoRule}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 xl:border-l xl:border-brand-border/50 xl:pl-5">
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-brand-text min-w-[2rem]">{t.buffetAdults}</span>
            <CartQtyStepper
              variant="drawer"
              qty={buffetAdults}
              onDecrement={() => onBumpCount('adults', -1)}
              onIncrement={() => onBumpCount('adults', 1)}
            />
          </div>
          <div className="hidden h-8 w-px bg-brand-border/60 sm:block" aria-hidden />
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-brand-text min-w-[2rem]">{t.buffetChildren}</span>
            <CartQtyStepper
              variant="drawer"
              qty={buffetChildren}
              onDecrement={() => onBumpCount('children', -1)}
              onIncrement={() => onBumpCount('children', 1)}
            />
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4 xl:pl-2">
          {buffetPriceDisplay.ok ? (
            <p className="text-[15px] font-semibold text-brand-gold-dark tabular-nums sm:text-right">
              {formatBuffetPriceTemplate(t.buffetEstimatedTotal, {
                total: buffetPriceDisplay.subtotal,
              })}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={buffetSubmitting || buffetPriceLoading || !buffetPriceDisplay.ok}
            className={`${waiterUi.btnActionPrimary} justify-center whitespace-nowrap disabled:opacity-50`}
          >
            <WaiterTableIcon className="h-4 w-4 shrink-0" />
            {buffetSubmitting ? '…' : buffetActionLabel}
          </button>
        </div>
      </div>
    </div>
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
  const className = `${waiterUi.btnActionPrimary}${checkoutLocked ? ' opacity-50 cursor-not-allowed' : ''}`;
  const icon = <WaiterPlusIcon className="h-3.5 w-3.5 shrink-0" />;

  if (checkoutLocked) {
    return (
      <button type="button" onClick={onCheckoutLocked} className={className}>
        {icon}
        {label}
      </button>
    );
  }

  return (
    <Link href={menuHref} className={className}>
      {icon}
      {label}
    </Link>
  );
}

type OccupiedToolbarProps = {
  t: WaiterCopy;
  tableId: string;
  menuHref: string;
  isCheckoutPending: boolean;
  onCheckoutLocked: () => void;
  onTransfer: () => void;
  onMerge: () => void;
  showCallBill: boolean;
  callingBill: boolean;
  onCallBill: () => void;
  showCloseTable: boolean;
  isDemo: boolean;
  closingDemoTable: boolean;
  onDemoCloseClick: () => void;
  onTableClosed: () => void;
};

export function WaiterTableOccupiedToolbar({
  t,
  tableId,
  menuHref,
  isCheckoutPending,
  onCheckoutLocked,
  onTransfer,
  onMerge,
  showCallBill,
  callingBill,
  onCallBill,
  showCloseTable,
  isDemo,
  closingDemoTable,
  onDemoCloseClick,
  onTableClosed,
}: OccupiedToolbarProps) {
  const checkoutLocked = isCheckoutPending;
  const lockedClass = checkoutLocked ? 'opacity-50 cursor-not-allowed' : '';
  const closeClassName = `${waiterUi.btnCloseOutline} sm:ml-auto disabled:opacity-50`;
  const closeIcon = <WaiterPowerIcon className="h-3.5 w-3.5 shrink-0" />;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ContinueOrderingControl
        menuHref={menuHref}
        label={t.continueOrdering}
        checkoutLocked={checkoutLocked}
        onCheckoutLocked={onCheckoutLocked}
      />
      <button
        type="button"
        onClick={onTransfer}
        className={`${waiterUi.btnActionSecondary} ${lockedClass}`}
      >
        <WaiterTransferIcon className="h-3.5 w-3.5 shrink-0" />
        {t.transfer}
      </button>
      <button
        type="button"
        onClick={onMerge}
        className={`${waiterUi.btnActionSecondary} ${lockedClass}`}
      >
        <WaiterMergeIcon className="h-3.5 w-3.5 shrink-0" />
        {t.merge}
      </button>
      {showCallBill ? (
        <button
          type="button"
          onClick={onCallBill}
          disabled={callingBill}
          className={`${waiterUi.btnActionSecondary} disabled:opacity-50`}
        >
          <WaiterBillIcon className="h-3.5 w-3.5 shrink-0" />
          {callingBill ? t.callBillOperating : t.callBill}
        </button>
      ) : null}
      {showCloseTable ? (
        isDemo ? (
          <button
            type="button"
            onClick={onDemoCloseClick}
            disabled={closingDemoTable}
            className={closeClassName}
          >
            {closeIcon}
            {closingDemoTable ? t.closeTableOperating : t.closeTable}
          </button>
        ) : (
          <CloseTableSessionAction
            tableId={tableId}
            isCheckoutPending={isCheckoutPending}
            onClosed={onTableClosed}
            className={closeClassName}
            leadingIcon={closeIcon}
          />
        )
      ) : null}
    </div>
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
    <div className={`${waiterUi.cardSurface} overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-brand-border/40 px-4 py-3">
        <WaiterClocheIcon className="h-4 w-4 shrink-0 text-brand-gold" />
        <h2 className="text-[15px] font-semibold text-brand-text">{title}</h2>
      </div>
      <div className="space-y-2 p-3">
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
    </div>
  );
}
