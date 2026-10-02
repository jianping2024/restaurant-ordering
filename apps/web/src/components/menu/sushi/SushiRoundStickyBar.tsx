'use client';

import { useEffect, useState } from 'react';
import type { RoundSnapshot } from '@/lib/table-order-round/types';
import { isCooldownActive } from '@/lib/table-order-round/status';
import type { SUSHI_ROUND_MESSAGES } from '@/lib/i18n/sushi-round-messages';
import type { Language } from '@/types';
import type { AllergenCode } from '@/lib/allergens';
import { ALLERGENS, allergenLabel } from '@/lib/allergens';
import type { CustomerMenuDietaryFilterPrefs } from '@/lib/customer-menu-dietary-filter';
import { mesaSelectionChipShellClass, mesaSelectionChipSoftClass } from '@/lib/mesa-selection-chip';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { Button } from '@/components/ui/Button';
import { CustomerMenuTableGuestsLabel } from '@/components/menu/CustomerMenuTableGuestsChrome';

type Copy = (typeof SUSHI_ROUND_MESSAGES)[Language];

function secondsUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

type DietaryFilterProps = {
  vegetarianFilterEnabled: boolean;
  allergenFilterEnabled: boolean;
  prefs: CustomerMenuDietaryFilterPrefs;
  onVegetarianOnlyChange: (next: boolean) => void;
  onExcludeAllergenCodesChange: (codes: readonly AllergenCode[]) => void;
};

export function SushiRoundStickyBar({
  snapshot,
  labels,
  lang,
  dietaryFilter,
}: {
  snapshot: RoundSnapshot;
  labels: Copy;
  lang: Language;
  dietaryFilter?: DietaryFilterProps | null;
}) {
  const [, setTick] = useState(0);
  const [allergenSheetOpen, setAllergenSheetOpen] = useState(false);
  const [draftExclude, setDraftExclude] = useState<AllergenCode[]>([]);
  const round = snapshot.round;
  const needsTick =
    round?.status === 'pending_confirm' ||
    (round?.status === 'cooldown' && isCooldownActive(round.status, round.cooldown_until));

  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  const guests = snapshot.live_guest_count;
  const cap = snapshot.round_cap_total;
  const qty = snapshot.lines_qty_total;
  const menuT = MENU_PAGE_MESSAGES[lang];

  let statusLine: string | null = null;
  if (round?.status === 'pending_confirm') {
    statusLine = labels.stickyPending.replace(
      '{seconds}',
      String(secondsUntil(round.submit_deadline_at)),
    );
  } else if (round?.status === 'cooldown' && isCooldownActive(round.status, round.cooldown_until)) {
    statusLine = labels.stickyCooldown.replace(
      '{seconds}',
      String(secondsUntil(round.cooldown_until)),
    );
  }

  const showProgress = qty > 0 && !statusLine;
  const vegOn = Boolean(dietaryFilter?.vegetarianFilterEnabled);
  const allergenOn = Boolean(dietaryFilter?.allergenFilterEnabled);
  const showFilters = vegOn || allergenOn;
  const excludeCount = dietaryFilter?.prefs.excludeAllergenCodes.length ?? 0;
  const vegetarianOnly = dietaryFilter?.prefs.vegetarianOnly ?? false;

  const openAllergenSheet = () => {
    if (!dietaryFilter) return;
    setDraftExclude([...dietaryFilter.prefs.excludeAllergenCodes]);
    setAllergenSheetOpen(true);
  };

  return (
    <div className="border-b border-brand-border bg-brand-card/95 px-4 py-2">
      <div className="flex min-h-8 items-center justify-between gap-2.5">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-brand-text">
          <CustomerMenuTableGuestsLabel guestCount={guests} lang={lang} />
          {showProgress ? (
            <>
              <span aria-hidden className="mx-1.5 text-brand-text-muted">
                ·
              </span>
              <span className="whitespace-nowrap text-[12px] tabular-nums text-brand-text-muted">
                {labels.stickyRoundProgress
                  .replace('{qty}', String(qty))
                  .replace('{cap}', String(cap))}
              </span>
            </>
          ) : null}
        </p>
        {showFilters && dietaryFilter ? (
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
            {vegOn ? (
              <button
                type="button"
                aria-pressed={vegetarianOnly}
                onClick={() => dietaryFilter.onVegetarianOnlyChange(!vegetarianOnly)}
                className={`${mesaSelectionChipShellClass} inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] ${
                  vegetarianOnly
                    ? 'border-[rgba(52,199,89,0.55)] bg-[rgba(52,199,89,0.14)] font-semibold text-[rgb(22,140,55)] shadow-[0_0_0_1px_rgba(52,199,89,0.12),0_0_12px_rgba(52,199,89,0.22)]'
                    : 'border-brand-border bg-brand-card text-brand-text-muted'
                }`}
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    vegetarianOnly
                      ? 'bg-[rgb(52,199,89)] shadow-[0_0_0_2px_rgba(52,199,89,0.28),0_0_10px_rgba(52,199,89,0.85)]'
                      : 'bg-brand-border'
                  }`}
                />
                {menuT.dietaryFilterVegetarian}
              </button>
            ) : null}
            {allergenOn ? (
              <button
                type="button"
                onClick={openAllergenSheet}
                className={`${mesaSelectionChipShellClass} px-2.5 py-1 text-[12px] ${mesaSelectionChipSoftClass(excludeCount > 0)}`}
              >
                {excludeCount > 0
                  ? menuT.dietaryFilterAllergenCount.replace('{n}', String(excludeCount))
                  : menuT.dietaryFilterAllergen}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {statusLine ? (
        <p
          className={`mt-1 text-[12px] tabular-nums ${
            round?.status === 'pending_confirm' ? 'font-semibold text-brand-gold' : 'text-brand-text-muted'
          }`}
        >
          {statusLine}
        </p>
      ) : null}

      {allergenSheetOpen && dietaryFilter ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label={menuT.itemDetailClose}
            onClick={() => setAllergenSheetOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sushi-allergen-filter-title"
            className="relative z-10 w-full max-w-mobile rounded-t-2xl border border-brand-border bg-brand-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4 lg:max-w-[68rem]"
          >
            <h2 id="sushi-allergen-filter-title" className="text-base font-semibold text-brand-text">
              {menuT.dietaryFilterAllergenTitle}
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-brand-text-muted">
              {menuT.dietaryFilterAllergenHint}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ALLERGENS.map((entry) => {
                const on = draftExclude.includes(entry.code);
                return (
                  <button
                    key={entry.code}
                    type="button"
                    onClick={() =>
                      setDraftExclude((prev) =>
                        on ? prev.filter((c) => c !== entry.code) : [...prev, entry.code],
                      )
                    }
                    className={`${mesaSelectionChipShellClass} px-2.5 py-1 text-[13px] ${mesaSelectionChipSoftClass(on)}`}
                  >
                    {allergenLabel(entry.code, lang)}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDraftExclude([])}
              >
                {menuT.dietaryFilterAllergenClear}
              </Button>
              <Button
                type="button"
                variant="gold"
                className="flex-1"
                onClick={() => {
                  dietaryFilter.onExcludeAllergenCodesChange(draftExclude);
                  setAllergenSheetOpen(false);
                }}
              >
                {menuT.dietaryFilterAllergenDone}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
