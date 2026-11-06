import {
  normalizeChoiceBindings,
  type MenuChoiceBinding,
  type MenuChoiceGroup,
  type MenuChoiceOption,
} from '@/lib/menu-choice-options';
import {
  normalizeToppingBinding,
  type MenuToppingBinding,
} from '@/lib/menu-topping-binding';
export type DishOrderConfigValidationError = {
  error: string;
  status: number;
};

/**
 * Validate dish choice_bindings against the restaurant dictionary.
 * Drops empty groups; rejects unknown group/option or option not in group.
 */
export function validateChoiceBindingsForRestaurant(
  raw: unknown,
  groups: readonly MenuChoiceGroup[],
  options: readonly MenuChoiceOption[],
): MenuChoiceBinding[] | DishOrderConfigValidationError {
  const bindings = normalizeChoiceBindings(raw);
  const groupIds = new Set(groups.map((g) => g.id));
  const optionById = new Map(options.map((o) => [o.id, o]));
  for (const binding of bindings) {
    if (!groupIds.has(binding.group_id)) {
      return { error: 'invalid_choice_bindings', status: 400 };
    }
    for (const optionId of binding.option_ids) {
      const option = optionById.get(optionId);
      if (!option || option.group_id !== binding.group_id) {
        return { error: 'invalid_choice_bindings', status: 400 };
      }
    }
  }
  return bindings;
}

/**
 * Validate topping_binding: category must exist; item_ids (if any) must be in that category
 * and not the main dish.
 */
export function validateToppingBindingForRestaurant(
  raw: unknown,
  params: {
    categoryIds: ReadonlySet<string>;
    items: readonly { id: string; category_id?: string | null }[];
    mainDishId?: string | null;
  },
): MenuToppingBinding | null | DishOrderConfigValidationError {
  if (raw === undefined) return null;
  const binding = normalizeToppingBinding(raw);
  if (raw != null && binding == null) {
    return { error: 'invalid_topping_binding', status: 400 };
  }
  if (!binding) return null;
  if (!params.categoryIds.has(binding.category_id)) {
    return { error: 'invalid_topping_binding', status: 400 };
  }
  if (binding.item_ids.length === 0) return binding;
  const byId = new Map(params.items.map((i) => [i.id, i]));
  for (const id of binding.item_ids) {
    if (params.mainDishId && id === params.mainDishId) {
      return { error: 'invalid_topping_binding', status: 400 };
    }
    const item = byId.get(id);
    if (!item || item.category_id !== binding.category_id) {
      return { error: 'invalid_topping_binding', status: 400 };
    }
  }
  return binding;
}
