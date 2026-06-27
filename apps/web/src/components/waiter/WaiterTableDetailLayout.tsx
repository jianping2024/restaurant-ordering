'use client';

import type { ReactNode } from 'react';
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
import type { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  buffetStripSectionClass,
  buttonIcon,
  WaiterDetailCard,
  waiterDetailLayout,
  WaiterTablePrimaryButton,
  WaiterTablePrimaryLink,
  WaiterTableSecondaryButton,
} from '@/components/waiter/waiter-table-detail-ui';

type WaiterCopy = (typeof WAITER_TEXT)[keyof typeof WAITER_TEXT];

function BuffetPanelSection({
  children,
  edge,
  className = '',
  wideOnSm = false,
}: {
  children: ReactNode;
  edge: 'start' | 'mid' | 'end';
  className?: string;
  wideOnSm?: boolean;
}) {
  return (
    <div
      className={`${buffetStripSectionClass(edge, className)}${wideOnSm ? ' sm:col-span-2 xl:col-span-1' : ''}`}
    >
      {children}
    </div>
  );
}

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
    <div className="flex items-center justify-start gap-3 xl:justify-center">
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
    <WaiterDetailCard>
      <div className={waiterDetailLayout.cardBody}>
        <div className={waiterDetailLayout.buffetStrip}>
          <BuffetPanelSection edge="start" wideOnSm>
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
          </BuffetPanelSection>

          <BuffetPanelSection edge="mid">
            <BuffetGuestCounter
              label={t.buffetAdults}
              qty={buffetAdults}
              onDecrement={() => onBumpCount('adults', -1)}
              onIncrement={() => onBumpCount('adults', 1)}
            />
          </BuffetPanelSection>

          <BuffetPanelSection edge="mid">
            <BuffetGuestCounter
              label={t.buffetChildren}
              qty={buffetChildren}
              onDecrement={() => onBumpCount('children', -1)}
              onIncrement={() => onBumpCount('children', 1)}
            />
          </BuffetPanelSection>

          <BuffetPanelSection edge="mid" className="items-center">
            {buffetPriceDisplay.ok ? (
              <p className="text-[15px] font-semibold text-brand-gold-dark tabular-nums text-center">
                {formatBuffetPriceTemplate(t.buffetEstimatedTotal, {
                  total: buffetPriceDisplay.subtotal,
                })}
              </p>
            ) : null}
          </BuffetPanelSection>

          <BuffetPanelSection edge="end" wideOnSm>
            <WaiterTablePrimaryButton onClick={onSave} disabled={saveDisabled} icon={<WaiterTableIcon className={buttonIcon.sm} />}>
              {buffetSubmitting ? '…' : buffetActionLabel}
            </WaiterTablePrimaryButton>
          </BuffetPanelSection>
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
      onClosed={onTableClosed}
      variant="close"
      size="action"
      className={waiterDetailLayout.primaryAction}
      leadingIcon={closeIcon}
    />
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
  return (
    <WaiterDetailCard>
      <div className={waiterDetailLayout.cardBody}>
        <div className={waiterDetailLayout.occupiedToolbarRow}>
          <div className={waiterDetailLayout.occupiedToolbarCluster}>
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
            {showCallBill ? (
              <WaiterTableSecondaryButton
                type="button"
                onClick={onCallBill}
                disabled={callingBill}
                icon={<WaiterBillIcon className={buttonIcon.sm} />}
              >
                {callingBill ? t.callBillOperating : t.callBill}
              </WaiterTableSecondaryButton>
            ) : null}
          </div>
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
