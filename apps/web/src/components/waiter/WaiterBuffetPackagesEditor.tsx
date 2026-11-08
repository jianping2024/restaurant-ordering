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
  /** Headcount only — the package choice is not offered (checkout entered / headcount adjust). */
  packageLocked?: boolean;
  /** Lock notice above the package (artboard ④「已进入结账，不能更换套餐」). */
  packageLockedHint?: string | null;
  /** Takeaway open sheet: hide “预计合计” (no buffet charge). */
  hideEstimatedTotal?: boolean;
  /** Shown under the headcount when it is locked (takeaway). */
  lockedHint?: string | null;
  /**
   * False until the open sheet may paint its final content (openable list + prices +
   * default draft). When false and the package is not locked, only a loading line —
   * never an empty package list, partial prices, or headcount.
   */
  openableLoaded?: boolean;
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
  packageLockedHint = null,
  hideEstimatedTotal = false,
  lockedHint = null,
  openableLoaded = true,
}: Props) {
  const t = WAITER_TEXT[lang];
  const adults = draft?.adults ?? 0;
  const children = draft?.children ?? 0;
  const shownOptions = packageLocked
    ? buffetOptions.filter((buffet) => buffet.id === draft?.buffetId)
    : buffetOptions;
  const counterLayout = layout === 'sheet' ? 'sheet' : 'detail';

  // Only two surfaces while picking a package: loading, or the full editor.
  // Never paint「选择套餐」+ empty options + headcount before openable ids arrive.
  if (!openableLoaded && !packageLocked) {
    return (
      <p
        className="text-sm text-brand-text-muted py-4 text-center"
        aria-busy="true"
      >
        {t.buffetOpenableLoading}
      </p>
    );
  }

  return (
    <div className={layout === 'sheet' ? openTableSheetLayout.stack : 'space-y-4'}>
      {packageLockedHint ? (
        <p
          role="status"
          className="rounded-xl border border-brand-gold/60 bg-brand-gold/10 px-3 py-2.5 text-[13px] leading-snug text-brand-text"
        >
          {packageLockedHint}
        </p>
      ) : null}
      <fieldset className="m-0 min-w-0 border-0 p-0 space-y-2" disabled={disabled || packageLocked}>
        <legend className={`${waiterFloorType.guestLabel} mb-2`}>{t.buffetPickPackage}</legend>
        {!packageLocked && shownOptions.length === 0 ? (
          <p className="text-[15px] font-medium mesa-text-warning">{t.buffetNoneOpenable}</p>
        ) : null}
        {shownOptions.map((buffet) => {
          const checked = draft?.buffetId === buffet.id;
          const pricePreview = resolveBuffetOpenPricePreview(
            resolvedByBuffetId[buffet.id] ?? null,
            1,
            0,
          );
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
                  buffetPriceDisplay={pricePreview}
                />
                {buffet.description ? (
                  <span className="mt-0.5 block text-[13px] leading-snug text-brand-text-muted line-clamp-2">
                    {buffet.description}
                  </span>
                ) : null}
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

/**
 * Submit-ready: a package is picked, prices settled, and the package (when it has guests)
 * has a price.
 */
export function isBuffetPackagesEditorReady(
  draft: TableBuffetSelection | null,
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
  priceLoading: boolean,
): boolean {
  if (priceLoading || !draft) return false;
  if (!effectiveTableBuffet(draft)) return true;
  return draftPricePreview(draft, resolvedByBuffetId).ok;
}
