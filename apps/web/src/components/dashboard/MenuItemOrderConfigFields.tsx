'use client';

import type { Language, MenuCategory, MenuItem } from '@/types';
import {
  menuChoiceLocalizedName,
  type MenuChoiceBinding,
  type MenuChoiceGroup,
  type MenuChoiceOption,
} from '@/lib/menu-choice-options';
import type { MenuToppingBinding } from '@/lib/menu-topping-binding';
import { mesaSelectionChipShellClass, mesaSelectionChipSoftClass } from '@/lib/mesa-selection-chip';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { FORM_CONTROL_PLACEHOLDER_CLASS } from '@/lib/form-control-text';

type Props = {
  lang: Language;
  groups: MenuChoiceGroup[];
  options: MenuChoiceOption[];
  categories: MenuCategory[];
  items: MenuItem[];
  editingItemId: string | null;
  choiceBindings: MenuChoiceBinding[];
  toppingBinding: MenuToppingBinding | null;
  onChoiceBindingsChange: (next: MenuChoiceBinding[]) => void;
  onToppingBindingChange: (next: MenuToppingBinding | null) => void;
  onManageChoiceGroups: () => void;
  labels: {
    choiceTitle: string;
    choiceHint: string;
    choiceManageLink: string;
    choiceEmpty: string;
    toppingTitle: string;
    toppingHint: string;
    toppingEnable: string;
    toppingCategory: string;
    toppingCategoryPlaceholder: string;
    toppingAllInCategory: string;
    toppingRequired: string;
    toppingPickItems: string;
    toppingNoItems: string;
  };
};

/**
 * Dish form: 口味分组勾选 + 浇头（选一个类别再勾菜 / 全选本类）。
 */
export function MenuItemOrderConfigFields({
  lang,
  groups,
  options,
  categories,
  items,
  editingItemId,
  choiceBindings,
  toppingBinding,
  onChoiceBindingsChange,
  onToppingBindingChange,
  onManageChoiceGroups,
  labels,
}: Props) {
  const activeGroups = groups.filter((g) => g.active);
  const toppingEnabled = toppingBinding != null;
  const toppingCategoryId = toppingBinding?.category_id ?? '';
  const toppingAll =
    toppingBinding != null && toppingBinding.item_ids.length === 0;
  const toppingItemIds = new Set(toppingBinding?.item_ids ?? []);

  const toppingCandidates = toppingCategoryId
    ? items.filter(
        (d) =>
          d.category_id === toppingCategoryId &&
          d.id !== editingItemId &&
          d.available,
      )
    : [];

  function toggleChoiceOption(groupId: string, optionId: string) {
    const existing = choiceBindings.find((b) => b.group_id === groupId);
    if (!existing) {
      onChoiceBindingsChange([...choiceBindings, { group_id: groupId, option_ids: [optionId] }]);
      return;
    }
    const has = existing.option_ids.includes(optionId);
    const option_ids = has
      ? existing.option_ids.filter((id) => id !== optionId)
      : [...existing.option_ids, optionId];
    if (option_ids.length === 0) {
      onChoiceBindingsChange(choiceBindings.filter((b) => b.group_id !== groupId));
      return;
    }
    onChoiceBindingsChange(
      choiceBindings.map((b) => (b.group_id === groupId ? { ...b, option_ids } : b)),
    );
  }

  return (
    <>
      <div className="rounded-xl border border-brand-border bg-brand-bg/40 p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="text-sm font-medium text-brand-text">{labels.choiceTitle}</p>
          <button
            type="button"
            className="text-xs text-brand-gold underline-offset-2 hover:underline sm:text-sm"
            onClick={onManageChoiceGroups}
          >
            {labels.choiceManageLink}
          </button>
        </div>
        <p className="mb-3 mt-1 text-[13px] text-brand-text-muted">{labels.choiceHint}</p>
        {activeGroups.length === 0 ? (
          <p className="text-[13px] text-brand-text-muted">{labels.choiceEmpty}</p>
        ) : (
          <div className="space-y-3">
            {activeGroups.map((g) => {
              const opts = options.filter((o) => o.group_id === g.id && o.active);
              const bound = choiceBindings.find((b) => b.group_id === g.id);
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-brand-border bg-brand-card p-3"
                >
                  <p className="text-[13px] font-medium text-brand-text">
                    {menuChoiceLocalizedName(g, lang)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {opts.map((o) => {
                      const checked = bound?.option_ids.includes(o.id) === true;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggleChoiceOption(g.id, o.id)}
                          className={`text-[13px] px-2.5 py-1 ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(checked)}`}
                        >
                          {menuChoiceLocalizedName(o, lang)}
                        </button>
                      );
                    })}
                    {opts.length === 0 ? (
                      <span className="text-[12px] text-brand-text-muted">—</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-bg/40 p-4">
        <p className="text-sm font-medium text-brand-text">{labels.toppingTitle}</p>
        <p className="mb-3 mt-1 text-[13px] text-brand-text-muted">{labels.toppingHint}</p>
        <label className="mb-3 flex items-center gap-2 text-sm text-brand-text">
          <input
            type="checkbox"
            checked={toppingEnabled}
            onChange={(e) => {
              if (!e.target.checked) {
                onToppingBindingChange(null);
                return;
              }
              onToppingBindingChange({
                category_id: categories[0]?.id ?? '',
                item_ids: [],
                required: false,
              });
            }}
          />
          {labels.toppingEnable}
        </label>

        {toppingEnabled && toppingBinding ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[13px] text-brand-text-muted">
                {labels.toppingCategory}
              </label>
              <select
                className={`h-11 w-full rounded-lg border border-brand-border bg-brand-card px-3 text-base text-brand-text ${FORM_CONTROL_PLACEHOLDER_CLASS}`}
                value={toppingCategoryId}
                onChange={(e) => {
                  const category_id = e.target.value;
                  onToppingBindingChange({
                    category_id,
                    item_ids: [],
                    required: toppingBinding.required,
                  });
                }}
              >
                <option value="">{labels.toppingCategoryPlaceholder}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {resolveMenuItemLocalizedName(
                      { name_pt: c.name_pt, name_en: c.name_en ?? undefined, name_zh: c.name_zh ?? undefined },
                      lang,
                    )}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-brand-text">
              <input
                type="checkbox"
                checked={toppingAll}
                disabled={!toppingCategoryId}
                onChange={(e) => {
                  onToppingBindingChange({
                    ...toppingBinding,
                    item_ids: e.target.checked ? [] : toppingCandidates.slice(0, 1).map((d) => d.id),
                  });
                }}
              />
              {labels.toppingAllInCategory}
            </label>

            <label className="flex items-center gap-2 text-sm text-brand-text">
              <input
                type="checkbox"
                checked={toppingBinding.required}
                onChange={(e) => {
                  onToppingBindingChange({ ...toppingBinding, required: e.target.checked });
                }}
              />
              {labels.toppingRequired}
            </label>

            {!toppingAll && toppingCategoryId ? (
              <div>
                <p className="mb-2 text-[13px] text-brand-text-muted">{labels.toppingPickItems}</p>
                {toppingCandidates.length === 0 ? (
                  <p className="text-[13px] text-brand-text-muted">{labels.toppingNoItems}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {toppingCandidates.map((d) => {
                      const checked = toppingItemIds.has(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(toppingItemIds);
                            if (checked) next.delete(d.id);
                            else next.add(d.id);
                            onToppingBindingChange({
                              ...toppingBinding,
                              item_ids: Array.from(next),
                            });
                          }}
                          className={`text-[13px] px-2.5 py-1 ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(checked)}`}
                        >
                          {d.emoji} {resolveMenuItemLocalizedName(d, lang)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
