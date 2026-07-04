'use client';

import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

interface Props {
  restaurantName: string;
  displayName: string;
  tableLabel: string;
}

/** Customer menu / bill success shell — restaurant, table, language. */
export function CustomerTableHeader({ restaurantName, displayName, tableLabel }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur border-b border-brand-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="font-heading text-xl text-brand-gold">{restaurantName}</h1>
          <p className="text-brand-text-muted text-[13px]">
            {tableLabel} {displayName}
          </p>
        </div>
        <LanguageSwitcher compact showFlags />
      </div>
    </header>
  );
}
