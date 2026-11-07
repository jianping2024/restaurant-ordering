'use client';

import type { Buffet } from '@/types';
import {
  BuffetGuestCounter,
  BuffetPriceMeta,
} from '@/components/waiter/WaiterTableDetailLayout';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  effectiveTableBuffet,
  formatBuffetPriceTemplate,
  resolveBuffetOpenPricePreview,
  type BuffetOpenPricePreview,
  type ResolvedBuffetPriceRow,
  type TableBuffetSelection,
} from '@/lib/buffet-order';
import type { UILanguage } from '@/lib/i18n';
import {
  buffetPackageOptionClass,
  openTableSheetLayout,
  waiterFloorType,
} from '@/components/waiter/waiter-table-detail-ui';

type Props = {
  lang: UILanguage;
  /** Packages the waiter can pick (single choice). */
  buffetOptions: Buffet[];
  draft: TableBuffetSelection | null;
  onSelectBuffet: (buffetId: string) => void;
  onSetGuestCount: (which: 'adults' | 'children', value: number) => void;
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
  priceLoading: boolean;
  layout?: 'sheet' | 'detail';
  /** Freeze package choice + headcount steppers (session-write mutex or takeaway lock). */
  disabled?: boolean;
  /** Headcount only — the package choice is not offered (checkout headcount adjust). */
  packageLocked?: boolean;
  /** Takeaway open sheet: hide “预计合计” (no buffet charge). */
  hideEstimatedTotal?: boolean;
  /** Shown under the headcount when it is locked (takeaway). */
  lockedHint?: string | null;
};

function draftPricePreview(
  draft: TableBuffetSelection | null,
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
): BuffetOpenPricePreview {
  if (!draft) return { ok: false };
  return resolveBuffetOpenPricePreview(
    resolvedByBuffetId[draft.buffetId] ?? null,
    draft.adults,
    draft.children,
  );
}

/** Estimated-total line for the table's one buffet (open sheet / checkout adjust). */
export function BuffetPackagesEstimatedTotal({
  lang,
  draft,
  resolvedByBuffetId,
  className = '',
}: {
  lang: UILanguage;
  draft: TableBuffetSelection | null;
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
  className?: string;
}) {
  const t = WAITER_TEXT[lang];
  const preview = draftPricePreview(draft, resolvedByBuffetId);
  if (!preview.ok) return null;

  return (
    <p
      className={[
        waiterFloorType.estimatedTotal,
        className,
      ].filter(Boolean).join(' ')}
    >
      {formatBuffetPriceTemplate(t.buffetEstimatedTotal, { total: preview.subtotal })}
    </p>
  );
}

/** Sole floor buffet editor: pick one package (radio) + adults / children for it. */
export function WaiterBuffetPackagesEditor({
  lang,
  buffetOptions,
  draft,
  onSelectBuffet,
  onSetGuestCount,
  resolvedByBuffetId,
  priceLoading,
  layout = 'sheet',
  disabled = false,
  packageLocked = false,
  hideEstimatedTotal = false,
  lockedHint = null,
}: Props) {
  const t = WAITER_TEXT[lang];
  const adults = draft?.adults ?? 0;
  const children = draft?.children ?? 0;
  const shownOptions = packageLocked
    ? buffetOptions.filter((buffet) => buffet.id === draft?.buffetId)
    : buffetOptions;
  const counterLayout = layout === 'sheet' ? 'sheet' : 'detail';

  return (
    <div className={layout === 'sheet' ? openTableSheetLayout.stack : 'space-y-4'}>
      <fieldset className="m-0 min-w-0 border-0 p-0 space-y-2" disabled={disabled || packageLocked}>
        <legend className={`${waiterFloorType.guestLabel} mb-2`}>{t.buffetPickPackage}</legend>
        {shownOptions.map((buffet) => {
          const checked = draft?.buffetId === buffet.id;
          return (
            <label key={buffet.id} className={buffetPackageOptionClass(checked)}>
              <input
                type="radio"
                name="waiter-buffet-package"
                className="h-[18px] w-[18px] shrink-0 accent-brand-gold"
                checked={checked}
                onChange={() => onSelectBuffet(buffet.id)}
              />
              <span className="min-w-0 flex-1">
                <span className={`block ${waiterFloorType.listBody}`}>{buffet.name}</span>
                <BuffetPriceMeta
                  t={t}
                  buffetPriceLoading={priceLoading}
                  buffetPriceDisplay={resolveBuffetOpenPricePreview(
                    resolvedByBuffetId[buffet.id] ?? null,
                    1,
                    0,
                  )}
                />
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className={openTableSheetLayout.guestBlock}>
        <BuffetGuestCounter
          layout={counterLayout}
          label={t.buffetAdults}
          qty={adults}
          disabled={disabled || !draft}
          onDecrement={() => onSetGuestCount('adults', adults - 1)}
          onIncrement={() => onSetGuestCount('adults', adults + 1)}
        />
        <BuffetGuestCounter
          layout={counterLayout}
          label={t.buffetChildren}
          qty={children}
          disabled={disabled || !draft}
          onDecrement={() => onSetGuestCount('children', children - 1)}
          onIncrement={() => onSetGuestCount('children', children + 1)}
        />
      </div>

      {lockedHint ? (
        <p className="text-sm text-brand-text-muted text-center py-1">{lockedHint}</p>
      ) : null}

      {layout === 'sheet' && !hideEstimatedTotal ? (
        <BuffetPackagesEstimatedTotal
          lang={lang}
          draft={draft}
          resolvedByBuffetId={resolvedByBuffetId}
          className={openTableSheetLayout.total}
        />
      ) : null}
    </div>
  );
}

/** Submit-ready: prices settled and the picked package (when it has guests) has a price. */
export function isBuffetPackagesEditorReady(
  draft: TableBuffetSelection | null,
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
  priceLoading: boolean,
): boolean {
  if (priceLoading) return false;
  if (!effectiveTableBuffet(draft)) return true;
  return draftPricePreview(draft, resolvedByBuffetId).ok;
}
