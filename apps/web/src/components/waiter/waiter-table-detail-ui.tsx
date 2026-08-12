'use client';

import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { Button, ButtonLink, buttonIcon, type ButtonVariant } from '@/components/ui/Button';
import { waiterUi } from '@/components/waiter/waiter-ui';
import { waiterStaffStickyChrome } from '@/lib/waiter-staff-sticky-chrome';

/**
 * Floor typography roles — one tier for dish names and buffet package names.
 * Controls use Button size="action"; prices/guest labels stay brand-text (not muted).
 */
export const waiterFloorType = {
  /** Ordered dish name, buffet package name, section entity titles. */
  listBody: 'text-lg font-semibold text-brand-text leading-snug',
  listBodyTruncate: 'min-w-0 truncate text-lg font-semibold text-brand-text',
  /** Ordered dish item code — same tier as listBody, gold for scanability. */
  listCode: 'text-lg font-semibold text-brand-gold tabular-nums leading-snug',
  listQty: 'shrink-0 text-lg font-semibold text-brand-text tabular-nums',
  /** Adult/child rate lines under a buffet package. */
  priceLine: 'mt-1 text-[15px] font-medium leading-snug text-brand-text tabular-nums',
  priceLineLoading: 'mt-1 text-sm font-medium text-brand-text',
  guestLabel: 'text-[15px] font-medium text-brand-text min-w-[2rem]',
  estimatedTotal: 'text-lg font-semibold text-brand-gold-dark tabular-nums',
} as const;

/** Shared horizontal gutter for buffet / toolbar / ordered-items cards. */
export const WAITER_DETAIL_GUTTER_PX = 'px-4';

/** Table-detail buffet rows: package name | adult stepper | child stepper. */
export const buffetDetailPackageGrid =
  'grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,0.8fr))] sm:items-center';

/** Card surface for one buffet package row on table detail. */
export const buffetDetailPackageRow =
  'rounded-xl border border-brand-border/70 bg-brand-bg/40 p-3';

/**
 * Layout tokens for the occupied-table detail flow:
 * page identity → buffet guest counts → session toolbar → ordered items list.
 */
export const waiterDetailLayout = {
  cardBody: `${WAITER_DETAIL_GUTTER_PX} py-4`,
  /** Ordered dish rows — list title sits at top of this block, flush above first row. */
  sectionBody: `space-y-2 ${WAITER_DETAIL_GUTTER_PX} pt-2 pb-3`,
  /** Save guests, continue ordering, close table — same action footprint. */
  primaryAction: 'w-full justify-center sm:w-auto whitespace-nowrap sm:max-w-none xl:w-auto',
  /** Transfer, merge, call bill. */
  secondaryAction: 'w-full justify-center sm:w-auto',
  buffetStrip:
    'grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5 xl:items-stretch xl:gap-0',
  /** Save guests — aligns under guest stepper columns on the package grid. */
  buffetDetailSummaryRow: `mt-4 ${buffetDetailPackageGrid}`,
  buffetDetailSummaryActions: 'flex flex-wrap items-center justify-end gap-3 sm:col-span-2',
  /** Occupied-table actions — one centered row; buttons wrap on narrow viewports. */
  occupiedToolbarRow: 'flex flex-wrap items-center justify-center gap-2',
  /** Page exit — filled by footer slot (`pageFooterSlot`). */
  pageFooter: 'flex justify-center',
  /**
   * Single detail shell slots — stable height so cold→chrome→ready does not jump the page.
   * Body min-height ≈ buffet card + ordered header block (not full order list).
   */
  pageBodySlot: 'min-h-[18rem]',
  pageFooterSlot: 'mt-4 flex min-h-12 justify-center',
  pageFooterPlaceholder: 'invisible h-11 w-full max-w-xs',
  /**
   * Page identity chrome — sticks under staff top bars.
   * Opaque page bg; fixed `h-14` so ordered-items offset stays aligned (`belowPageHeading`).
   */
  pageHeading: `sticky ${waiterStaffStickyChrome.belowStaffTopBar} z-[25] mb-6 flex h-14 items-center bg-brand-bg`,
  pageHeadingRow:
    'flex w-full min-w-0 items-center justify-between gap-x-3',
  pageHeadingTitle:
    'min-w-0 truncate font-heading text-2xl leading-none text-brand-gold sm:text-3xl',
  pageHeadingMeta:
    'inline-flex shrink-0 items-center gap-1.5 text-[13px] text-brand-text-muted tabular-nums',
  /**
   * Session money chrome — sticky under page identity; total + pre_bill only (not the list title).
   * Opaque card bg so list rows never show through while scrolling.
   */
  orderedItemsMoneyChrome: `sticky ${waiterStaffStickyChrome.belowPageHeading} z-20 flex items-center justify-end gap-2 border-b border-brand-border/40 bg-brand-card ${WAITER_DETAIL_GUTTER_PX} py-3`,
  orderedItemsTitleRow: 'flex shrink-0 items-center gap-2',
  orderedItemsTitle: `${waiterFloorType.listBody} whitespace-nowrap`,
  orderedItemsTotal: 'text-lg font-semibold text-brand-gold-dark tabular-nums shrink-0',
  /**
   * One dish = one horizontal left-cluster row (unique shape):
   * [code · name · status] —gap-8— [qty · serve/minus].
   * Name, code, and qty share `waiterFloorType.listBody` (text-lg); code keeps gold color.
   * Status follows the dish name (not the far-right qty). Label is not flex-1 —
   * restores original name↔qty breath; wide viewports may leave empty space on the right.
   * Chargeable hint is the only allowed secondary line (rare limited-dish note).
   */
  orderedItemRow: 'flex max-w-full min-w-0 items-center gap-8',
  orderedItemIdentity: 'flex min-w-0 items-center gap-2.5',
  orderedItemCode: `shrink-0 min-w-[2rem] text-left ${waiterFloorType.listCode}`,
  orderedItemLabel: waiterFloorType.listBodyTruncate,
  orderedItemStatus:
    'shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[13px] font-medium text-amber-950',
  orderedItemChargeableHint: 'mt-0.5 text-sm text-brand-text-muted',
  orderedItemQty: waiterFloorType.listQty,
  orderedItemActions: 'flex shrink-0 items-center gap-2',
} as const;

/** Narrow modal layout for dashboard open-table sheet (viewport breakpoints not used). */
export const openTableSheetLayout = {
  stack: 'flex flex-col gap-4',
  buffetHeader: 'space-y-1',
  guestBlock:
    'space-y-3 rounded-xl border border-brand-border/50 bg-brand-bg/40 px-3 py-3',
  total: waiterFloorType.estimatedTotal,
  actionRow: 'flex flex-col-reverse gap-2 sm:flex-row',
  actionButton: 'w-full sm:flex-1 justify-center',
} as const;

export type BuffetStripEdge = 'start' | 'mid' | 'end';

export function buffetStripSectionClass(edge: BuffetStripEdge, extra = ''): string {
  const base = 'flex min-w-0 flex-col justify-center';
  const edgeClass =
    edge === 'start'
      ? 'xl:pr-4'
      : edge === 'end'
        ? 'xl:border-l xl:border-brand-border/50 xl:pl-4 xl:items-end'
        : 'xl:border-l xl:border-brand-border/50 xl:px-4';
  return [base, edgeClass, extra].filter(Boolean).join(' ');
}

export function WaiterDetailCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${waiterUi.cardSurface} ${className}`}>{children}</div>;
}

type PrimaryButtonProps = Omit<ComponentProps<typeof Button>, 'size' | 'variant'> & {
  variant?: Extract<ButtonVariant, 'gold' | 'close'>;
  icon?: ReactNode;
};

/** Primary session action (gold fill or close outline). */
export function WaiterTablePrimaryButton({
  variant = 'gold',
  icon,
  className = '',
  children,
  ...props
}: PrimaryButtonProps) {
  return (
    <Button
      variant={variant}
      size="action"
      className={`${waiterDetailLayout.primaryAction}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {icon}
      {children}
    </Button>
  );
}

type PrimaryLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
};

export function WaiterTablePrimaryLink({
  icon,
  className = '',
  disabled = false,
  children,
  ...props
}: PrimaryLinkProps) {
  return (
    <ButtonLink
      variant="gold"
      size="action"
      disabled={disabled}
      className={`${waiterDetailLayout.primaryAction}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {icon}
      {children}
    </ButtonLink>
  );
}

type SecondaryButtonProps = Omit<ComponentProps<typeof Button>, 'size' | 'variant'> & {
  icon?: ReactNode;
};

export function WaiterTableSecondaryButton({
  icon,
  className = '',
  children,
  ...props
}: SecondaryButtonProps) {
  return (
    <Button
      variant="soft"
      size="action"
      className={`${waiterDetailLayout.secondaryAction}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {icon}
      {children}
    </Button>
  );
}

type BackToBoardLinkProps = Omit<ComponentProps<typeof Link>, 'className' | 'children'> & {
  label: string;
  className?: string;
};

/** Leave table detail and return to the waiter board. */
export function WaiterTableBackToBoardLink({
  label,
  className = '',
  ...props
}: BackToBoardLinkProps) {
  return (
    <ButtonLink
      variant="soft"
      size="action"
      className={`${waiterDetailLayout.secondaryAction}${className ? ` ${className}` : ''}`}
      {...props}
    >
      ← {label}
    </ButtonLink>
  );
}

export function WaiterTableBackToBoardFooter({
  boardHref,
  label,
}: {
  boardHref: string;
  label: string;
}) {
  return (
    <div className={waiterDetailLayout.pageFooter}>
      <WaiterTableBackToBoardLink href={boardHref} label={label} />
    </div>
  );
}

/** Sole body placeholder — cold slot, chrome ordered wait, and route loading.tsx. */
export function WaiterTableDetailContentSkeleton({
  label,
  /** One card under chrome toolbar; full = two cards for cold / route loading. */
  density = 'full',
}: {
  label: string;
  density?: 'full' | 'ordered';
}) {
  const card = (titleW: string, bodyH: string) => (
    <div className={`${waiterUi.cardSurface} p-6 animate-pulse`}>
      <div className={`mb-4 h-5 ${titleW} rounded bg-brand-border/60`} />
      <div className={`${bodyH} rounded bg-brand-border/40`} />
    </div>
  );
  return (
    <div className="space-y-4" aria-busy="true" aria-label={label || undefined}>
      {card('w-48', 'h-24')}
      {density === 'full' ? card('w-40', 'h-16') : null}
      {label ? <p className="text-sm text-brand-text-muted">{label}</p> : null}
    </div>
  );
}

/** Footer slot filler — same footprint as WaiterTableBackToBoardFooter before ready. */
export function WaiterTableDetailFooterPlaceholder() {
  return <div className={waiterDetailLayout.pageFooterPlaceholder} aria-hidden />;
}

export { buttonIcon };
