'use client';

import type { SplitSettlementRow } from '@/lib/checkout-split-settlement';
import { localizeSplitPersonName } from '@/lib/split-person-label';
import type { UILanguage } from '@/lib/i18n';

type Props = {
  rows: SplitSettlementRow[];
  lang: UILanguage;
  /** Scroll/focus the pending collect card for this person. */
  onSelectPerson: (index: number) => void;
};

/**
 * Sole settle-phase person progress rail: chips + ✓ when payment complete
 * (`settlementStatus === 'settled'`). Invoice stays on ledger actions after collect.
 */
export function CheckoutSettlePersonRail({ rows, lang, onSelectPerson }: Props) {
  if (rows.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="list"
      aria-label="Settlement people"
    >
      {rows.map((row) => {
        const settled = row.settlementStatus === 'settled';
        const partial = row.settlementStatus === 'partial';
        return (
          <button
            key={row.index}
            type="button"
            role="listitem"
            onClick={() => onSelectPerson(row.index)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              settled
                ? 'border-emerald-500/50 bg-emerald-50 text-emerald-800'
                : partial
                  ? 'border-brand-gold/50 bg-brand-gold/10 text-brand-text'
                  : 'border-brand-border bg-brand-card text-brand-text hover:border-brand-gold/50'
            }`}
          >
            {localizeSplitPersonName(row.name, lang)}
            {settled ? ' ✓' : ''}
          </button>
        );
      })}
    </div>
  );
}

export function settlePersonCardDomId(personIndex: number): string {
  return `checkout-settle-person-${personIndex}`;
}
