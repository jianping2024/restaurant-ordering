'use client';

import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { Button, ButtonLink, buttonIcon, type ButtonVariant } from '@/components/ui/Button';
import { waiterUi } from '@/components/waiter/waiter-ui';

/** Shared horizontal gutter for buffet / toolbar / ordered-items cards. */
export const WAITER_DETAIL_GUTTER_PX = 'px-4';

/**
 * Layout tokens for the occupied-table detail flow:
 * buffet guest counts → session toolbar → ordered items list.
 */
export const waiterDetailLayout = {
  cardBody: `${WAITER_DETAIL_GUTTER_PX} py-4`,
  sectionHeader: `flex items-center gap-2 border-b border-brand-border/40 ${WAITER_DETAIL_GUTTER_PX} py-3`,
  sectionBody: `space-y-2 ${WAITER_DETAIL_GUTTER_PX} py-3`,
  /** Save guests, continue ordering, close table — same action footprint. */
  primaryAction: 'w-full justify-center sm:w-auto whitespace-nowrap sm:max-w-none xl:w-auto',
  /** Transfer, merge, call bill. */
  secondaryAction: 'w-full justify-center sm:w-auto',
  buffetStrip:
    'grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5 xl:items-stretch xl:gap-0',
  occupiedToolbarRow: 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
  occupiedToolbarCluster: 'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2',
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

export { buttonIcon };
