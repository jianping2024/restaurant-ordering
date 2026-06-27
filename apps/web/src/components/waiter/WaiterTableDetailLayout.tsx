'use client';

import type { ReactNode } from 'react';
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

const buffetGridClass =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-center xl:gap-0';
const buffetCellClass =
  'min-w-0 xl:border-l xl:border-brand-border/50 xl:px-4 xl:first:border-l-0 xl:first:pl-0 xl:last:pr-0';

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

function BuffetGuestCounter({
  label,
  qty,
  onDecrement,
  onIncrement,
}: {
  label: string;
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 sm:justify-start xl:justify-center">
      <span className="text-[13px] text-brand-text min-w-[2rem]">{label}</span>
      <CartQtyStepper variant="drawer" qty={qty} onDecrement={onDecrement} onIncrement={onIncrement} />
    </div>
  );
}

function BuffetPriceMeta({
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
  const saveDisabled = buffetSubmitting || buffetPriceLoading || !buffetPriceDisplay.ok;

  return (
    <div className={`${waiterUi.cardSurface} p-4`}>
      <div className={buffetGridClass}>
        <div className={`${buffetCellClass} sm:col-span-2 xl:col-span-1`}>
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
          <BuffetPriceMeta t={t} buffetPriceLoading={buffetPriceLoading} buffetPriceDisplay={buffetPriceDisplay} />
        </div>

        <div className={buffetCellClass}>
          <BuffetGuestCounter
            label={t.buffetAdults}
            qty={buffetAdults}
            onDecrement={() => onBumpCount('adults', -1)}
            onIncrement={() => onBumpCount('adults', 1)}
          />
        </div>

        <div className={buffetCellClass}>
          <BuffetGuestCounter
            label={t.buffetChildren}
            qty={buffetChildren}
            onDecrement={() => onBumpCount('children', -1)}
            onIncrement={() => onBumpCount('children', 1)}
          />
        </div>

        <div className={`${buffetCellClass} flex items-center justify-center xl:justify-center`}>
          {buffetPriceDisplay.ok ? (
            <p className="text-[15px] font-semibold text-brand-gold-dark tabular-nums text-center">
              {formatBuffetPriceTemplate(t.buffetEstimatedTotal, {
                total: buffetPriceDisplay.subtotal,
              })}
            </p>
          ) : null}
        </div>

        <div className={`${buffetCellClass} sm:col-span-2 xl:col-span-1`}>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className={`${waiterUi.btnActionPrimary} w-full justify-center whitespace-nowrap disabled:opacity-50 xl:w-auto xl:ml-auto`}
          >
            <WaiterTableIcon className={waiterUi.iconPanel} />
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
  const icon = <WaiterPlusIcon className={waiterUi.iconAction} />;

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

function ToolbarSecondaryButton({
  onClick,
  label,
  icon,
  locked = false,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
  locked?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${waiterUi.btnActionSecondary}${locked || disabled ? ' opacity-50 cursor-not-allowed' : ''}`}
    >
      {icon}
      {label}
    </button>
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
  const closeClassName = `${waiterUi.btnCloseOutline} w-full sm:w-auto sm:ml-auto disabled:opacity-50`;
  const closeIcon = <WaiterPowerIcon className={waiterUi.iconCloseTable} />;

  return (
    <div className={`${waiterUi.cardSurface} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <ContinueOrderingControl
          menuHref={menuHref}
          label={t.continueOrdering}
          checkoutLocked={checkoutLocked}
          onCheckoutLocked={onCheckoutLocked}
        />
        <ToolbarSecondaryButton
          onClick={onTransfer}
          label={t.transfer}
          icon={<WaiterTransferIcon className={waiterUi.iconAction} />}
          locked={checkoutLocked}
        />
        <ToolbarSecondaryButton
          onClick={onMerge}
          label={t.merge}
          icon={<WaiterMergeIcon className={waiterUi.iconAction} />}
          locked={checkoutLocked}
        />
        {showCallBill ? (
          <ToolbarSecondaryButton
            onClick={onCallBill}
            label={callingBill ? t.callBillOperating : t.callBill}
            icon={<WaiterBillIcon className={waiterUi.iconAction} />}
            disabled={callingBill}
          />
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
        <WaiterClocheIcon className={`${waiterUi.iconPanel} text-brand-gold`} />
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
