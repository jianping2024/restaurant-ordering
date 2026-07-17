'use client';

import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { Button, ButtonLink, buttonIcon, type ButtonVariant } from '@/components/ui/Button';
import { waiterUi } from '@/components/waiter/waiter-ui';

/**
 * Floor typography roles — one tier for dish names and buffet package names.
 * Controls use Button size="action"; prices/guest labels stay brand-text (not muted).
 */
export const waiterFloorType = {
  /** Ordered dish name, buffet package name, section entity titles. */
  listBody: 'text-lg font-semibold text-brand-text leading-snug',
  listBodyTruncate: 'min-w-0 truncate text-lg font-semibold text-brand-text',
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
 * buffet guest counts → session toolbar → ordered items list.
 */
export const waiterDetailLayout = {
  cardBody: `${WAITER_DETAIL_GUTTER_PX} py-4`,
  sectionBody: `space-y-2 ${WAITER_DETAIL_GUTTER_PX} py-3`,
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
  /** Page exit — below ordered items, above modals. */
  pageFooter: 'mt-4 flex justify-center',
  /**
   * Ordered-items chrome — sticks under Dashboard / Waiter top bars (`h-14`).
   * Opaque card bg so list rows never show through while scrolling.
   */
  orderedItemsHeader: `sticky top-14 z-20 flex items-center justify-between gap-3 border-b border-brand-border/40 bg-brand-card ${WAITER_DETAIL_GUTTER_PX} py-3`,
  orderedItemsTitle: waiterFloorType.listBody,
  orderedItemsTotal: 'text-lg font-semibold text-brand-gold-dark tabular-nums shrink-0',
  /**
   * Name + qty + minus left-aligned (not justify-between).
   * `gap-8` is the name↔qty breath (~eight spaces / prior gap-3 + five); qty↔minus stays tight via orderedItemActions.
   */
  orderedItemRow: 'flex max-w-full min-w-0 items-center gap-8',
  orderedItemLabel: waiterFloorType.listBodyTruncate,
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

export { buttonIcon };
