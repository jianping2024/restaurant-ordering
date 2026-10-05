'use client';

import { AppearanceChromeGroup } from '@/components/ui/AppearanceChromeGroup';
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
    <header
      className={
        sticky ? 'shrink-0' : 'shrink-0 border-b border-brand-border'
      }
    >
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
          </div>
          {isStaffAssisted ? (
            tableBadge
          ) : (
            <AppearanceChromeGroup />
          )}
        </div>
      </div>
    </header>
  );
}
