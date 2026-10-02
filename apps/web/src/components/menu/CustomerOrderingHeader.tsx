'use client';

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
}

/** Sole table-identity chip for guest and staff-assisted customer chrome (menu + bill). */
function CustomerTableIdentityBadge({
  tableLabel,
  displayName,
}: {
  tableLabel: string;
  displayName: string;
}) {
  return (
    <span className="shrink-0 rounded-full border border-brand-ink/45 px-3 py-1 text-base font-semibold text-brand-ink tabular-nums leading-tight">
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
}: Props) {
  const isStaffAssisted = staffAssisted !== null;

  const headingClass =
    headingSize === 'bill'
      ? 'font-heading text-xl text-brand-ink truncate'
      : 'font-heading text-lg text-brand-ink truncate';

  const tableBadge = (
    <CustomerTableIdentityBadge tableLabel={tableLabel} displayName={displayName} />
  );

  return (
    <header className={sticky ? undefined : 'border-b border-brand-border'}>
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
    </header>
  );
}
