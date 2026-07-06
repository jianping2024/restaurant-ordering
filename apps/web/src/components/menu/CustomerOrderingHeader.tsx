'use client';

import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { staffAssistedReturnLabel } from '@/lib/i18n/staff-assisted-messages';
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
  /** Guest bill/menu back navigation (not used in staff-assisted; nav row comes from staffAssisted). */
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
  const { lang } = useLanguage();
  const assistedFlow = staffAssisted ?? null;
  const isStaffAssisted = assistedFlow !== null;

  const headingClass =
    headingSize === 'bill'
      ? 'font-heading text-2xl text-brand-gold truncate'
      : 'font-heading text-xl text-brand-gold truncate';

  const tableBadge = (
    <span className="shrink-0 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2.5 py-1 text-[13px] font-medium text-brand-gold tabular-nums">
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
        {isStaffAssisted ? (
          <div className="mb-2">
            <StaffAssistedBackLink
              href={assistedFlow.returnHref}
              label={staffAssistedReturnLabel(assistedFlow, lang)}
            />
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
          {isStaffAssisted ? tableBadge : <LanguageSwitcher compact showFlags />}
        </div>

        {!isStaffAssisted && backLink ? (
          <div className="mt-2">
            <StaffAssistedBackLink href={backLink.href} label={backLink.label} />
          </div>
        ) : null}
      </div>

      {children}
    </header>
  );
}
