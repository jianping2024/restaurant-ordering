'use client';

import type { Language, MenuItem } from '@/types';
import {
  menuChoiceLocalizedName,
  resolveDishChoiceSections,
  type MenuChoiceCatalog,
} from '@/lib/menu-choice-options';
import {
  resolveToppingMenuItems,
  type MenuToppingBinding,
} from '@/lib/menu-topping-binding';
import { mesaSelectionChipShellClass, mesaSelectionChipSoftClass } from '@/lib/mesa-selection-chip';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { formatCustomerMenuItemPrice } from '@/lib/menu-item-price-display';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { APPEND_CART_QTY_MAX } from '@/types';

type ToppingPick = { menuItemId: string; qty: number };

type Props = {
  lang: Language;
  item: MenuItem;
  choiceCatalog: MenuChoiceCatalog;
  choicePicks: Readonly<Record<string, string>>;
  toppingPicks: readonly ToppingPick[];
  allMenuItems: readonly MenuItem[];
  disabled?: boolean;
  warn?: string;
  labels: {
    choicesTitle: string;
    toppingsTitle: string;
    toppingsOptional: string;
    toppingsRequired: string;
  };
  onChoicePick: (groupId: string, optionId: string) => void;
  onToppingQty: (menuItemId: string, qty: number) => void;
};

/** Guest detail: 口味单选 + 浇头数量（与风味提示 / 预选备注分开）。 */
export function CustomerDishOrderConfigFields({
  lang,
  item,
  choiceCatalog,
  choicePicks,
  toppingPicks,
  allMenuItems,
  disabled,
  warn,
  labels,
  onChoicePick,
  onToppingQty,
}: Props) {
  const sections = resolveDishChoiceSections(item.choice_bindings ?? [], choiceCatalog);
  const toppingBinding = (item.topping_binding ?? null) as MenuToppingBinding | null;
  const toppingItems = resolveToppingMenuItems(toppingBinding, allMenuItems, item.id);
  const qtyById = new Map(toppingPicks.map((p) => [p.menuItemId, p.qty]));

  if (sections.length === 0 && !toppingBinding) return null;

  return (
    <div className="mt-5 space-y-5">
      {sections.map(({ group, options }) => (
        <div key={group.id}>
          <h2 className="text-sm font-semibold text-brand-text">
            {menuChoiceLocalizedName(group, lang)}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((o) => {
              const checked = choicePicks[group.id] === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChoicePick(group.id, o.id)}
                  className={`text-[13px] px-2.5 py-1 ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(checked)}`}
                >
                  {menuChoiceLocalizedName(o, lang)}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {toppingBinding && toppingItems.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-brand-text">{labels.toppingsTitle}</h2>
          <p className="mt-1 text-[13px] text-brand-text-muted">
            {toppingBinding.required ? labels.toppingsRequired : labels.toppingsOptional}
          </p>
          <ul className="mt-3 space-y-2">
            {toppingItems.map((d) => {
              const qty = qtyById.get(d.id) ?? 0;
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-brand-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-text">
                      {d.emoji} {resolveMenuItemLocalizedName(d, lang)}
                    </p>
                    <p className="text-[12px] text-brand-text-muted">
                      {formatCustomerMenuItemPrice(d.price, {
                        freeLabel: '€0.00',
                        treatZeroAsFree: false,
                      })}
                    </p>
                  </div>
                  <CartQtyStepper
                    qty={qty}
                    max={APPEND_CART_QTY_MAX}
                    density="compact"
                    disabled={disabled}
                    onDecrement={() => onToppingQty(d.id, Math.max(0, qty - 1))}
                    onIncrement={() => onToppingQty(d.id, Math.min(APPEND_CART_QTY_MAX, qty + 1))}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {warn ? <p className="text-sm text-red-500">{warn}</p> : null}
    </div>
  );
}
