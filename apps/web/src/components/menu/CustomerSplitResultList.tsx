import type { CustomerSplitRowDisplay } from '@/lib/customer-bill-split-display';
import { localizeSplitPersonName } from '@/lib/split-person-label';
import type { UILanguage } from '@/lib/i18n';
import { SplitPersonAvatar } from '@/components/menu/SplitPersonAvatar';

export type CustomerSplitResultListCopy = {
  splitResult: string;
  splitPaid: string;
  splitPartialPaid: string;
  splitAmountBreakdown: string;
};

type Props = {
  rows: CustomerSplitRowDisplay[];
  lang: UILanguage;
  copy: CustomerSplitResultListCopy;
};

/** Read-only split rows for customer checkout success screen. */
export function CustomerSplitResultList({ rows, lang, copy }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
      <p className="px-4 py-2.5 text-[13px] text-brand-text-muted border-b border-brand-border">
        {copy.splitResult}
      </p>
      {rows.map((row, i) => (
        <div key={i} className="px-4 py-3 border-b border-brand-border last:border-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <SplitPersonAvatar />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-brand-text text-sm">{localizeSplitPersonName(row.name, lang)}</span>
                  {row.settlementStatus === 'settled' ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full mesa-badge-success">{copy.splitPaid}</span>
                  ) : null}
                  {row.settlementStatus === 'partial' ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-brand-gold/40 text-brand-gold">
                      {copy.splitPartialPaid}
                    </span>
                  ) : null}
                </div>
                {row.settlementStatus === 'partial' ? (
                  <p className="mt-1 text-[12px] text-brand-text-muted">
                    {copy.splitAmountBreakdown
                      .replace('{obligation}', row.obligationAmount.toFixed(2))
                      .replace('{collected}', row.collectedAmount.toFixed(2))}
                  </p>
                ) : null}
              </div>
            </div>
            <span className="font-heading text-brand-gold font-medium shrink-0">
              €{(row.settlementStatus === 'partial' ? row.outstandingAmount : row.obligationAmount).toFixed(2)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
