import type { MenuChoiceBinding, MenuChoiceCatalog } from '@/lib/menu-choice-options';
import { resolveDishChoiceSections } from '@/lib/menu-choice-options';
import type { MenuToppingBinding, MenuToppingPick } from '@/lib/menu-topping-binding';

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
