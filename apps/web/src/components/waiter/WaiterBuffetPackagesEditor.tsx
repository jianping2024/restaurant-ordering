'use client';

import type { Buffet } from '@/types';
import {
  BuffetGuestCounter,
  BuffetPriceMeta,
} from '@/components/waiter/WaiterTableDetailLayout';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  formatBuffetPriceTemplate,
  resolveBuffetOpenPricePreview,
  resolveBuffetPackagesPricePreview,
  type BuffetGuestSnapshot,
  type ResolvedBuffetPriceRow,
} from '@/lib/buffet-order';
import type { UILanguage } from '@/lib/i18n';
import {
  buffetDetailPackageGrid,
  buffetDetailPackageRow,
  openTableSheetLayout,
} from '@/components/waiter/waiter-table-detail-ui';

type Props = {
  lang: UILanguage;
  activeBuffets: Buffet[];
  guestSnapshot: BuffetGuestSnapshot;
  onSetGuestCount: (buffetId: string, which: 'adults' | 'children', value: number) => void;
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
  priceLoading: boolean;
  layout?: 'sheet' | 'detail';
};

/** Estimated-total line for open-table sheet footer. */
export function BuffetPackagesEstimatedTotal({
  lang,
  guestSnapshot,
  resolvedByBuffetId,
  className = '',
}: {
  lang: UILanguage;
  guestSnapshot: BuffetGuestSnapshot;
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
  className?: string;
}) {
  const t = WAITER_TEXT[lang];
  const totalPreview = resolveBuffetPackagesPricePreview(guestSnapshot, resolvedByBuffetId);
  if (!totalPreview.ok) return null;

  return (
    <p
      className={[
        'text-[15px] font-semibold text-brand-gold-dark tabular-nums',
        className,
      ].filter(Boolean).join(' ')}
    >
      {formatBuffetPriceTemplate(t.buffetEstimatedTotal, { total: totalPreview.subtotal })}
    </p>
  );
}

export function WaiterBuffetPackagesEditor({
  lang,
  activeBuffets,
  guestSnapshot,
  onSetGuestCount,
  resolvedByBuffetId,
  priceLoading,
  layout = 'sheet',
}: Props) {
  const t = WAITER_TEXT[lang];

  if (layout === 'sheet') {
    return (
      <div className={openTableSheetLayout.stack}>
        {activeBuffets.map((buffet) => {
          const counts = guestSnapshot[buffet.id] ?? { adults: 0, children: 0 };
          const rowPreview = resolveBuffetOpenPricePreview(
            resolvedByBuffetId[buffet.id] ?? null,
            counts.adults,
            counts.children,
          );
          return (
            <div key={buffet.id} className={openTableSheetLayout.guestBlock}>
              <p className="text-[15px] font-semibold text-brand-text leading-snug">{buffet.name}</p>
              <BuffetPriceMeta t={t} buffetPriceLoading={priceLoading} buffetPriceDisplay={rowPreview} />
              <BuffetGuestCounter
                layout="sheet"
                label={t.buffetAdults}
                qty={counts.adults}
                onQtyChange={(value) => onSetGuestCount(buffet.id, 'adults', value)}
                onDecrement={() => onSetGuestCount(buffet.id, 'adults', counts.adults - 1)}
                onIncrement={() => onSetGuestCount(buffet.id, 'adults', counts.adults + 1)}
              />
              <BuffetGuestCounter
                layout="sheet"
                label={t.buffetChildren}
                qty={counts.children}
                onQtyChange={(value) => onSetGuestCount(buffet.id, 'children', value)}
                onDecrement={() => onSetGuestCount(buffet.id, 'children', counts.children - 1)}
                onIncrement={() => onSetGuestCount(buffet.id, 'children', counts.children + 1)}
              />
            </div>
          );
        })}

        <BuffetPackagesEstimatedTotal
          lang={lang}
          guestSnapshot={guestSnapshot}
          resolvedByBuffetId={resolvedByBuffetId}
          className={openTableSheetLayout.total}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeBuffets.map((buffet) => {
        const counts = guestSnapshot[buffet.id] ?? { adults: 0, children: 0 };
        const rowPreview = resolveBuffetOpenPricePreview(
          resolvedByBuffetId[buffet.id] ?? null,
          counts.adults,
          counts.children,
        );
        return (
          <div
            key={buffet.id}
            className={`${buffetDetailPackageGrid} ${buffetDetailPackageRow}`}
          >
            <div>
              <p className="text-[15px] font-semibold text-brand-text leading-snug">{buffet.name}</p>
              <BuffetPriceMeta t={t} buffetPriceLoading={priceLoading} buffetPriceDisplay={rowPreview} />
            </div>
            <BuffetGuestCounter
              label={t.buffetAdults}
              qty={counts.adults}
              onQtyChange={(value) => onSetGuestCount(buffet.id, 'adults', value)}
              onDecrement={() => onSetGuestCount(buffet.id, 'adults', counts.adults - 1)}
              onIncrement={() => onSetGuestCount(buffet.id, 'adults', counts.adults + 1)}
            />
            <BuffetGuestCounter
              label={t.buffetChildren}
              qty={counts.children}
              onQtyChange={(value) => onSetGuestCount(buffet.id, 'children', value)}
              onDecrement={() => onSetGuestCount(buffet.id, 'children', counts.children - 1)}
              onIncrement={() => onSetGuestCount(buffet.id, 'children', counts.children + 1)}
            />
          </div>
        );
      })}
    </div>
  );
}

export function isBuffetPackagesEditorReady(
  guestSnapshot: BuffetGuestSnapshot,
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
  priceLoading: boolean,
): boolean {
  if (priceLoading) return false;
  return resolveBuffetPackagesPricePreview(guestSnapshot, resolvedByBuffetId).ok;
}
