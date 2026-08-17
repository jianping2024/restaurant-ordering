'use client';

import type { ReactNode } from 'react';
import { LanguageSwitcherIconChrome } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { customerMenuHeaderTrailingSlotClass } from '@/lib/customer-menu-chrome-layout';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { StaffAssistedBackLink } from '@/components/staff/StaffAssistedBackLink';

type BackLink = {
  href: string;
  label: string;
};

interface Props {
  restaurantName: string;
  displayName: string;
  tableLabel: string;
  staffAssisted?: StaffAssistedFlow | null;
  /** Secondary line, e.g. bill settlement label — never a second table-number form. */
  subtitle?: string | null;
  /**
   * Sole header back control (guest or page-mode staff-assisted).
   * Overlay Continuar pedido uses StaffOrderingShell ✕ — pass null there.
   */
  backLink?: BackLink | null;
  sticky?: boolean;
  /** Bill page uses a larger restaurant title. */
  headingSize?: 'menu' | 'bill';
  children?: ReactNode;
}

/** Sole table-identity chip for guest and staff-assisted customer chrome. */
function CustomerTableIdentityBadge({
  tableLabel,
  displayName,
}: {
  tableLabel: string;
  displayName: string;
}) {
  return (
    <span className="shrink-0 rounded-full border border-brand-ink/25 px-2 py-0.5 text-xs font-medium text-brand-ink tabular-nums">
      {tableLabel} {displayName}
    </span>
  );
}

export function CustomerOrderingHeader({
  restaurantName,
  displayName,
  tableLabel,
  staffAssisted = null,
  subtitle = null,
  backLink = null,
  sticky = false,
  headingSize = 'menu',
  children,
}: Props) {
  const isStaffAssisted = staffAssisted !== null;

  const headingClass =
    headingSize === 'bill'
      ? 'font-heading text-xl text-brand-ink truncate'
      : 'font-heading text-lg text-brand-ink truncate';

  const tableBadge = (
    <CustomerTableIdentityBadge tableLabel={tableLabel} displayName={displayName} />
  );

  const identity = (
    <div
      className={
        sticky
          ? 'px-4 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top,0px))]'
          : 'px-4 py-3'
      }
    >
      {backLink ? (
        <div className="mb-2">
          <StaffAssistedBackLink href={backLink.href} label={backLink.label} />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className={headingClass}>{restaurantName}</h1>
            {!isStaffAssisted ? tableBadge : null}
          </div>
          {subtitle ? (
            <p className="mt-1 text-sm text-brand-text-muted">{subtitle}</p>
          ) : null}
        </div>
        {isStaffAssisted ? (
          tableBadge
        ) : (
          <div className={`${customerMenuHeaderTrailingSlotClass} flex items-center gap-1.5`}>
            <LanguageSwitcherIconChrome />
            <ThemeToggle />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <header className={sticky ? undefined : 'border-b border-brand-border'}>{identity}</header>
      {children ? (
        <div
          className={
            sticky
              ? 'sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-brand-border bg-brand-bg'
              : undefined
          }
        >
          {children}
        </div>
      ) : null}
    </>
  );
}
