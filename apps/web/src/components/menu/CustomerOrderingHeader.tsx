'use client';

import type { ReactNode } from 'react';
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
  /** When set, show next to the table chip (session channel takeaway). */
  takeawayBadgeLabel?: string | null;
  staffAssisted?: StaffAssistedFlow | null;
  /**
   * Sole header back control (guest or page-mode staff-assisted).
   * Overlay Continuar pedido uses StaffOrderingShell ✕ — pass null there.
   */
  backLink?: BackLink | null;
  sticky?: boolean;
  /** Bill page uses a larger restaurant title. */
  headingSize?: 'menu' | 'bill';
  /**
   * Guest menu: false — restaurant name lives in the storefront band only.
   * Bill / staff-assisted: true (default).
   */
  showRestaurantName?: boolean;
  /** Guest menu: restaurant notice capsule, left of language + theme. */
  notice?: ReactNode;
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
    <span className="min-w-0 truncate rounded-full border border-brand-ink/45 px-3 py-1 text-base font-semibold text-brand-ink tabular-nums leading-tight">
      {tableLabel} {displayName}
    </span>
  );
}

function CustomerTakeawayChannelBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full border border-brand-gold/50 bg-brand-gold/10 px-2.5 py-1 text-sm font-semibold text-brand-gold leading-tight">
      {label}
    </span>
  );
}

export function CustomerOrderingHeader({
  restaurantName,
  displayName,
  tableLabel,
  takeawayBadgeLabel = null,
  staffAssisted = null,
  backLink = null,
  sticky = false,
  headingSize = 'menu',
  showRestaurantName = true,
  notice = null,
}: Props) {
  const isStaffAssisted = staffAssisted !== null;

  const headingClass =
    headingSize === 'bill'
      ? 'font-heading text-xl text-brand-ink truncate'
      : 'font-heading text-lg text-brand-ink truncate';

  const tableBadges = (
    <span className="flex min-w-0 items-center gap-1.5">
      <CustomerTableIdentityBadge tableLabel={tableLabel} displayName={displayName} />
      {takeawayBadgeLabel ? (
        <CustomerTakeawayChannelBadge label={takeawayBadgeLabel} />
      ) : null}
    </span>
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
              {showRestaurantName ? (
                <h1 className={headingClass}>{restaurantName}</h1>
              ) : null}
              {!isStaffAssisted ? tableBadges : null}
            </div>
          </div>
          {isStaffAssisted ? (
            tableBadges
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              {notice}
              <AppearanceChromeGroup />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
