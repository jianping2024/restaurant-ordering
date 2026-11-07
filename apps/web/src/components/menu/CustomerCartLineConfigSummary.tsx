'use client';

import type { Language, MenuItem } from '@/types';
import {
  composeChoicePickLabels,
  type MenuChoiceCatalog,
} from '@/lib/menu-choice-options';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { coerceCartPrice } from '@/lib/cart-totals';

type ToppingPick = { menuItemId: string; qty: number };

type Props = {
  lang: Language;
  choiceCatalog: MenuChoiceCatalog;
  choicePicks?: Readonly<Record<string, string>>;
  toppingPicks?: readonly ToppingPick[];
  /** Catalog used to resolve topping names + unit prices. */
  menuItems: readonly Pick<
    MenuItem,
    'id' | 'name_pt' | 'name_en' | 'name_zh' | 'price' | 'emoji'
  >[];
};

/**
 * Sole read-only cart-line order-config summary (口味 labels + 加料 rows).
 * Edit stays on dish detail — do not mount CustomerDishOrderConfigFields here.
 */
export function CustomerCartLineConfigSummary({
  lang,
  choiceCatalog,
  choicePicks,
  toppingPicks,
  menuItems,
}: Props) {
  const choiceLabels = composeChoicePickLabels({
    picks: choicePicks ?? {},
    catalog: choiceCatalog,
    lang,
  });
  const menuById = new Map(menuItems.map((row) => [row.id, row]));
  const toppings = (toppingPicks ?? [])
    .filter((p) => p.qty > 0)
    .map((p) => {
      const dish = menuById.get(p.menuItemId);
      if (!dish) return null;
      const unit = coerceCartPrice(dish.price);
      return {
        key: p.menuItemId,
        label: `${dish.emoji ? `${dish.emoji} ` : ''}${resolveMenuItemLocalizedName(dish, lang)}`,
        qty: p.qty,
        amount: unit * p.qty,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (choiceLabels.length === 0 && toppings.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {choiceLabels.length > 0 ? (
        <p className="text-[13px] leading-snug text-brand-text-muted">
          {choiceLabels.join(' · ')}
        </p>
      ) : null}
      {toppings.length > 0 ? (
        <ul className="space-y-1 rounded-lg bg-brand-border/20 px-3 py-2">
          {toppings.map((t) => (
            <li
              key={t.key}
              className="flex items-center justify-between gap-2 text-[13px] text-brand-text"
            >
              <span className="min-w-0 truncate">
                {t.label}
                <span className="text-brand-text-muted"> ×{t.qty}</span>
              </span>
              <span className="shrink-0 tabular-nums text-brand-text-muted">
                €{t.amount.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
