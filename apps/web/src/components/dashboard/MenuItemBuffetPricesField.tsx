'use client';

import { RowRemoveIconButton } from '@/components/menu/RowRemoveIconButton';
import { normalizeDecimalInput } from '@/lib/number-input';
import type { Buffet } from '@/types';

/** Dish form draft row: price kept as typed text until save. */
export type MenuItemBuffetPriceDraftRow = { buffet_id: string; price: string };

type Labels = {
  title: string;
  hint: string;
  buffetLabel: string;
  add: string;
  remove: string;
  invalid: string;
  inactiveSuffix: string;
};

type Props = {
  buffets: Array<Pick<Buffet, 'id' | 'name' | 'is_active'>>;
  rows: MenuItemBuffetPriceDraftRow[];
  onChange: (rows: MenuItemBuffetPriceDraftRow[]) => void;
  /** Show the「价格须 ≥ 0」state on rows that fail {@link isValidBuffetPriceDraft}. */
  showErrors: boolean;
  labels: Labels;
};

/** Required, finite, ≥ 0 (0 = included in the buffet in sushi mode). */
export function isValidBuffetPriceDraft(price: string): boolean {
  if (!price.trim()) return false;
  const n = Number(price);
  return Number.isFinite(n) && n >= 0;
}

/**
 * Sole dish-form editor for「Buffet 价格」: one row per buffet (picker + € price + remove).
 * The picker offers only active buffets not yet configured; a disabled buffet keeps its row.
 */
export function MenuItemBuffetPricesField({ buffets, rows, onChange, showErrors, labels }: Props) {
  const configured = new Set(rows.map((row) => row.buffet_id));
  const addable = buffets.filter((b) => b.is_active && !configured.has(b.id));
  const nameOf = (buffetId: string) => {
    const buffet = buffets.find((b) => b.id === buffetId);
    if (!buffet) return buffetId;
    return buffet.is_active ? buffet.name : `${buffet.name}${labels.inactiveSuffix}`;
  };
  const anyInvalid = showErrors && rows.some((row) => !isValidBuffetPriceDraft(row.price));

  return (
    <div className="rounded-xl border border-brand-gold/60 bg-brand-bg/40 p-3 space-y-3">
      <p className="text-sm font-medium text-brand-text">{labels.title}</p>
      <p className="text-[12px] text-brand-text-muted leading-snug">{labels.hint}</p>
      {rows.map((row, index) => {
        const invalid = showErrors && !isValidBuffetPriceDraft(row.price);
        const options = buffets.filter(
          (b) => b.id === row.buffet_id || (b.is_active && !configured.has(b.id)),
        );
        return (
          <div
            key={row.buffet_id}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] items-center gap-2"
          >
            <select
              aria-label={labels.buffetLabel}
              value={row.buffet_id}
              onChange={(e) =>
                onChange(
                  rows.map((r, i) => (i === index ? { ...r, buffet_id: e.target.value } : r)),
                )
              }
              className="w-full min-w-0 bg-brand-card border border-brand-border rounded-lg px-3 py-2.5 text-base text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            >
              {options.map((b) => (
                <option key={b.id} value={b.id}>
                  {nameOf(b.id)}
                </option>
              ))}
            </select>
            <label
              className={`flex min-w-0 items-center gap-1.5 rounded-lg border bg-brand-card px-3 py-2.5 text-base text-brand-text ${
                invalid ? 'border-red-500' : 'border-brand-border'
              }`}
            >
              <span aria-hidden>€</span>
              <input
                aria-label={`${nameOf(row.buffet_id)} €`}
                aria-invalid={invalid || undefined}
                type="text"
                inputMode="decimal"
                lang="en"
                autoComplete="off"
                value={row.price}
                onChange={(e) =>
                  onChange(
                    rows.map((r, i) =>
                      i === index ? { ...r, price: normalizeDecimalInput(e.target.value) } : r,
                    ),
                  )
                }
                placeholder="0.00"
                className="w-full min-w-0 bg-transparent focus:outline-none"
              />
            </label>
            <RowRemoveIconButton
              removable
              ariaLabel={labels.remove.replace('{name}', nameOf(row.buffet_id))}
              onRemove={() => onChange(rows.filter((_, i) => i !== index))}
            />
          </div>
        );
      })}
      {anyInvalid ? <p className="text-[12px] text-red-500">{labels.invalid}</p> : null}
      {addable.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([...rows, { buffet_id: addable[0]!.id, price: '' }])}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-brand-gold/70 px-3 py-2.5 text-sm text-brand-gold hover:bg-brand-gold/10"
        >
          <span aria-hidden>+</span>
          {labels.add}
        </button>
      ) : null}
    </div>
  );
}
