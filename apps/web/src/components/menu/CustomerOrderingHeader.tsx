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
  /** Secondary line, e.g. bill settlement label. */
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
      ? 'font-heading text-2xl text-brand-ink truncate'
      : 'font-heading text-xl text-brand-ink truncate';

  const tableBadge = (
    <span className="shrink-0 rounded-full border border-brand-ink/40 bg-brand-ink/10 px-2.5 py-1 text-[13px] font-medium text-brand-ink tabular-nums">
      {tableLabel} {displayName}
    </span>
  );

  const guestTableLine = subtitle
    ? `${tableLabel} ${displayName} — ${subtitle}`
    : `${tableLabel} ${displayName}`;

  return (
    <header
      className={
        sticky
          ? 'sticky top-0 z-30 bg-brand-bg/95 backdrop-blur border-b border-brand-border'
          : 'border-b border-brand-border'
      }
    >
      <div className={`px-4 ${sticky ? 'py-3' : 'py-5'}`}>
        {backLink ? (
          <div className="mb-2">
            <StaffAssistedBackLink href={backLink.href} label={backLink.label} />
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className={headingClass}>{restaurantName}</h1>
            {!isStaffAssisted ? (
              <p className="text-brand-text-muted text-[13px] mt-0.5">{guestTableLine}</p>
            ) : subtitle ? (
              <p className="text-brand-text-muted text-sm mt-1">{subtitle}</p>
            ) : null}
          </div>
          {isStaffAssisted ? (
            tableBadge
          ) : (
            <div className={`${customerMenuHeaderTrailingSlotClass} flex items-center gap-2`}>
              <ThemeToggle />
              <LanguageSwitcherIconChrome />
            </div>
          )}
        </div>
      </div>

      {children}
    </header>
  );
}
