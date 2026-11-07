import type { MenuChoiceBinding, MenuChoiceCatalog } from '@/lib/menu-choice-options';
import {
  choicePicksSatisfied,
  resolveDishChoiceSections,
} from '@/lib/menu-choice-options';
import type { MenuToppingBinding, MenuToppingPick } from '@/lib/menu-topping-binding';
import { toppingsSatisfied } from '@/lib/menu-topping-binding';
import type { UILanguage } from '@/lib/i18n';

/** Whether guest list + must open detail instead of silent add. */
export function dishNeedsOrderConfig(params: {
  choiceBindings: readonly MenuChoiceBinding[] | null | undefined;
  toppingBinding: MenuToppingBinding | null | undefined;
  choiceCatalog?: MenuChoiceCatalog;
}): boolean {
  const bindings = params.choiceBindings ?? [];
  if (params.choiceCatalog) {
    if (resolveDishChoiceSections(bindings, params.choiceCatalog).length > 0) return true;
  } else if (bindings.length > 0) {
    return true;
  }
  return params.toppingBinding != null;
}

/**
 * Sole draft gate before upserting a configured dish into the cart.
 * Returns warn copy when choice/topping rules fail; null when ok to add.
 */
export function configuredDishDraftWarn(params: {
  lang: UILanguage;
  choiceBindings: readonly MenuChoiceBinding[] | null | undefined;
  choiceCatalog: MenuChoiceCatalog;
  choicePicks: Readonly<Record<string, string>>;
  toppingBinding: MenuToppingBinding | null | undefined;
  toppingPicks: readonly { menuItemId: string; qty: number }[];
}): string | null {
  if (
    !choicePicksSatisfied(
      params.choiceBindings ?? [],
      params.choiceCatalog,
      params.choicePicks,
    )
  ) {
    if (params.lang === 'zh') return '请为每个口味分组选一项。';
    if (params.lang === 'pt') return 'Escolha uma opção em cada grupo.';
    return 'Pick one option in each choice group.';
  }
  const wireTops: MenuToppingPick[] = params.toppingPicks.map((p) => ({
    menu_item_id: p.menuItemId,
    qty: p.qty,
  }));
  if (!toppingsSatisfied(params.toppingBinding, wireTops)) {
    if (params.lang === 'zh') return '此菜加料为必选：请至少选一种并设置数量。';
    if (params.lang === 'pt') return 'Extra obrigatório: escolha pelo menos um.';
    return 'Add-on required: pick at least one.';
  }
  return null;
}

/** Cart line identity for merge: choices + toppings + notes. */
export function cartConfigIdentityKey(input: {
  menuItemId: string;
  choicePicks: Readonly<Record<string, string>>;
  toppingPicks: readonly MenuToppingPick[];
  note: string;
  selectedNotePresetIds: readonly string[];
}): string {
  const choices = Object.keys(input.choicePicks)
    .sort()
    .map((g) => `${g}:${input.choicePicks[g]}`)
    .join('|');
  const tops = [...input.toppingPicks]
    .filter((t) => t.qty > 0)
    .sort((a, b) => a.menu_item_id.localeCompare(b.menu_item_id))
    .map((t) => `${t.menu_item_id}x${t.qty}`)
    .join('|');
  const presets = [...input.selectedNotePresetIds].sort().join('|');
  return [input.menuItemId, choices, tops, presets, input.note.trim()].join('::');
}
