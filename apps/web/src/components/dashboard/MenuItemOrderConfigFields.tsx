'use client';

import { useState } from 'react';
import type { Language, MenuCategory, MenuItem } from '@/types';
import {
  menuChoiceLocalizedName,
  type MenuChoiceBinding,
  type MenuChoiceGroup,
} from '@/lib/menu-choice-options';
import type { MenuToppingBinding } from '@/lib/menu-topping-binding';
import { mesaSelectionChipShellClass, mesaSelectionChipSoftClass } from '@/lib/mesa-selection-chip';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { FORM_CONTROL_PLACEHOLDER_CLASS } from '@/lib/form-control-text';

type Props = {
  lang: Language;
  groups: MenuChoiceGroup[];
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
    toppingAdd: string;
    toppingAddSearch: string;
    toppingAddEmpty: string;
    toppingNoItems: string;
  };
};

/**
 * Dish form: 口味只选分组 + 关联菜品（先选类别；子集只展示已选，添加从剩余挑）。
 */
export function MenuItemOrderConfigFields({
  lang,
  groups,
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
  const [toppingAddOpen, setToppingAddOpen] = useState(false);
  const [toppingAddQuery, setToppingAddQuery] = useState('');

  const activeGroups = groups.filter((g) => g.active);
  const boundGroupIds = new Set(choiceBindings.map((b) => b.group_id));
  const toppingEnabled = toppingBinding != null;
  const toppingCategoryId = toppingBinding?.category_id ?? '';
  const toppingAll =
    toppingBinding != null && toppingBinding.item_ids.length === 0;
  const toppingItemIds = toppingBinding?.item_ids ?? [];
  const toppingItemIdSet = new Set(toppingItemIds);

  const toppingCandidates = toppingCategoryId
    ? items.filter(
        (d) =>
          d.category_id === toppingCategoryId &&
          d.id !== editingItemId &&
          d.available,
      )
    : [];

  const selectedToppings = toppingItemIds
    .map((id) => toppingCandidates.find((d) => d.id === id))
    .filter((d): d is MenuItem => d != null);

  const addQueryNorm = toppingAddQuery.trim().toLowerCase();
  const unselectedToppings = toppingCandidates.filter((d) => {
    if (toppingItemIdSet.has(d.id)) return false;
    if (!addQueryNorm) return true;
    const name = resolveMenuItemLocalizedName(d, lang).toLowerCase();
    const code = (d.item_code ?? '').toLowerCase();
    return name.includes(addQueryNorm) || (code.length > 0 && code.includes(addQueryNorm));
  });

  function toggleChoiceGroup(groupId: string) {
    if (boundGroupIds.has(groupId)) {
      onChoiceBindingsChange(choiceBindings.filter((b) => b.group_id !== groupId));
      return;
    }
    onChoiceBindingsChange([...choiceBindings, { group_id: groupId, option_ids: [] }]);
  }

  function setToppingIds(nextIds: string[]) {
    if (!toppingBinding) return;
    // Subset mode must keep ≥1 id — empty item_ids means「该类全部」.
    if (nextIds.length === 0) return;
    onToppingBindingChange({ ...toppingBinding, item_ids: nextIds });
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
          <div className="flex flex-wrap gap-2">
            {activeGroups.map((g) => {
              const checked = boundGroupIds.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleChoiceGroup(g.id)}
                  className={`text-[13px] px-2.5 py-1 ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(checked)}`}
                >
                  {menuChoiceLocalizedName(g, lang)}
                </button>
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
                setToppingAddOpen(false);
                setToppingAddQuery('');
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
                  setToppingAddOpen(false);
                  setToppingAddQuery('');
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
                  setToppingAddOpen(false);
                  setToppingAddQuery('');
                  onToppingBindingChange({
                    ...toppingBinding,
                    item_ids: e.target.checked
                      ? []
                      : toppingCandidates.slice(0, 1).map((d) => d.id),
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
              <div className="space-y-2">
                <p className="text-[13px] text-brand-text-muted">{labels.toppingPickItems}</p>
                {toppingCandidates.length === 0 ? (
                  <p className="text-[13px] text-brand-text-muted">{labels.toppingNoItems}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {selectedToppings.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            if (selectedToppings.length <= 1) return;
                            setToppingIds(toppingItemIds.filter((id) => id !== d.id));
                          }}
                          className={`text-[13px] px-2.5 py-1 ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(true)}`}
                        >
                          {d.emoji} {resolveMenuItemLocalizedName(d, lang)}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-brand-gold underline-offset-2 hover:underline sm:text-sm"
                      onClick={() => {
                        setToppingAddOpen((open) => !open);
                        if (toppingAddOpen) setToppingAddQuery('');
                      }}
                    >
                      {labels.toppingAdd}
                    </button>
                    {toppingAddOpen ? (
                      <div className="rounded-lg border border-brand-border bg-brand-card p-3 space-y-2">
                        <input
                          type="search"
                          value={toppingAddQuery}
                          onChange={(e) => setToppingAddQuery(e.target.value)}
                          placeholder={labels.toppingAddSearch}
                          className={`h-10 w-full rounded-lg border border-brand-border bg-brand-bg px-3 text-sm text-brand-text ${FORM_CONTROL_PLACEHOLDER_CLASS}`}
                        />
                        {unselectedToppings.length === 0 ? (
                          <p className="text-[13px] text-brand-text-muted">{labels.toppingAddEmpty}</p>
                        ) : (
                          <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                            {unselectedToppings.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setToppingIds([...toppingItemIds, d.id]);
                                }}
                                className={`text-[13px] px-2.5 py-1 ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(false)}`}
                              >
                                {d.emoji} {resolveMenuItemLocalizedName(d, lang)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
