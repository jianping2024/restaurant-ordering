/**
 * Static catalog for /demo/dish-options — flavor groups + 浇头 bindings.
 * Not wired to DB; local UI only.
 */

import type { MenuNotePresetCatalog } from '@/lib/menu-note-presets';

export type DemoFlavorOption = { id: string; name: string };
export type DemoFlavorGroup = {
  id: string;
  name: string;
  options: DemoFlavorOption[];
};

export type DemoCategory = { id: string; name: string };

/**
 * 浇头最短路径：挑一个类别 → 勾该类下的菜（空 itemIds = 该类全部）+ 是否必选。
 */
export type DemoToppingBinding = {
  categoryId: string;
  /** 空数组 = 该类全部；有值 = 只这些（均须属于 categoryId） */
  itemIds: string[];
  required: boolean;
};

export type DemoDish = {
  id: string;
  name: string;
  price: number;
  emoji: string;
  categoryId: string;
  available: boolean;
  /** 挂哪些口味分组，以及每组勾给顾客的选项（空 = 不挂该组） */
  flavorBindings: { groupId: string; optionIds: string[] }[];
  /** null = 无浇头 */
  toppingBinding: DemoToppingBinding | null;
  /** 预选备注大类（与真实菜单 note_preset_group_ids 同形） */
  notePresetGroupIds: string[];
};

export type DemoToppingPick = { itemId: string; qty: number };

export type DemoCartLine = {
  lineId: string;
  dishId: string;
  /** groupId → optionId */
  flavorPicks: Record<string, string>;
  toppings: DemoToppingPick[];
  note: string;
  selectedNotePresetIds: string[];
  qty: number;
};

/** 与正式点餐页同一套预选备注 UI；demo 静态目录 */
export const DEMO_NOTE_PRESET_CATALOG: MenuNotePresetCatalog = {
  groups: [
    {
      id: 'demo-note-taste',
      name_en: 'Taste note',
      name_pt: 'Nota de sabor',
      name_zh: '口味备注',
      presets: [
        {
          id: 'demo-less-salt',
          name_en: 'Less salt',
          name_pt: 'Pouco sal',
          name_zh: '少盐',
        },
        {
          id: 'demo-no-onion',
          name_en: 'No onion',
          name_pt: 'Sem cebola',
          name_zh: '少葱',
        },
        {
          id: 'demo-extra-spicy',
          name_en: 'Extra spicy',
          name_pt: 'Mais picante',
          name_zh: '多辣',
        },
      ],
    },
  ],
};

export const DEMO_FLAVOR_GROUPS: DemoFlavorGroup[] = [
  {
    id: 'fg-taste',
    name: '口味',
    options: [
      { id: 'mild', name: '清淡' },
      { id: 'std', name: '标准' },
      { id: 'heavy', name: '重口' },
    ],
  },
  {
    id: 'fg-pot',
    name: '锅底',
    options: [
      { id: 'red', name: '红汤' },
      { id: 'clear', name: '清汤' },
      { id: 'yuan', name: '鸳鸯' },
    ],
  },
  {
    id: 'fg-spice',
    name: '辣度',
    options: [
      { id: 'spice-mild', name: '微辣' },
      { id: 'spice-med', name: '中辣' },
      { id: 'spice-hot', name: '特辣' },
    ],
  },
];

export const DEMO_CATEGORIES: DemoCategory[] = [
  { id: 'cat-noodle', name: '面食' },
  { id: 'cat-hotpot', name: '火锅' },
  { id: 'cat-topping', name: '浇头' },
  { id: 'cat-soup', name: '汤品' },
];

export const DEMO_DISHES: DemoDish[] = [
  {
    id: 'dish-rib-noodle',
    name: '排骨面',
    price: 8.5,
    emoji: '🍜',
    categoryId: 'cat-noodle',
    available: true,
    flavorBindings: [{ groupId: 'fg-taste', optionIds: ['mild', 'std', 'heavy'] }],
    toppingBinding: {
      categoryId: 'cat-topping',
      itemIds: ['dish-rib', 'dish-egg', 'dish-veg'],
      required: false,
    },
    notePresetGroupIds: ['demo-note-taste'],
  },
  {
    id: 'dish-hotpot',
    name: '双人火锅',
    price: 39.9,
    emoji: '🍲',
    categoryId: 'cat-hotpot',
    available: true,
    flavorBindings: [
      { groupId: 'fg-pot', optionIds: ['red', 'clear', 'yuan'] },
      { groupId: 'fg-spice', optionIds: ['spice-mild', 'spice-med', 'spice-hot'] },
    ],
    toppingBinding: {
      categoryId: 'cat-topping',
      itemIds: [], // 该类全部
      required: true,
    },
    notePresetGroupIds: ['demo-note-taste'],
  },
  {
    id: 'dish-tomato-soup',
    name: '番茄蛋汤',
    price: 4.5,
    emoji: '🥣',
    categoryId: 'cat-soup',
    available: true,
    flavorBindings: [],
    toppingBinding: null,
    notePresetGroupIds: ['demo-note-taste'],
  },
  {
    id: 'dish-rib',
    name: '排骨',
    price: 2.0,
    emoji: '🥩',
    categoryId: 'cat-topping',
    available: true,
    flavorBindings: [],
    toppingBinding: null,
    notePresetGroupIds: [],
  },
  {
    id: 'dish-egg',
    name: '卤蛋',
    price: 1.0,
    emoji: '🥚',
    categoryId: 'cat-topping',
    available: true,
    flavorBindings: [],
    toppingBinding: null,
    notePresetGroupIds: [],
  },
  {
    id: 'dish-veg',
    name: '青菜',
    price: 0.8,
    emoji: '🥬',
    categoryId: 'cat-topping',
    available: true,
    flavorBindings: [],
    toppingBinding: null,
    notePresetGroupIds: [],
  },
  {
    id: 'dish-tofu',
    name: '豆腐',
    price: 0.8,
    emoji: '🧈',
    categoryId: 'cat-topping',
    available: true,
    flavorBindings: [],
    toppingBinding: null,
    notePresetGroupIds: [],
  },
];

export function dishNeedsConfig(dish: DemoDish): boolean {
  return dish.flavorBindings.length > 0 || dish.toppingBinding != null;
}

export function resolveFlavorOptionsForDish(
  dish: DemoDish,
  groups: readonly DemoFlavorGroup[] = DEMO_FLAVOR_GROUPS,
): { group: DemoFlavorGroup; options: DemoFlavorOption[] }[] {
  const out: { group: DemoFlavorGroup; options: DemoFlavorOption[] }[] = [];
  for (const binding of dish.flavorBindings) {
    const group = groups.find((g) => g.id === binding.groupId);
    if (!group || binding.optionIds.length === 0) continue;
    const allow = new Set(binding.optionIds);
    const options = group.options.filter((o) => allow.has(o.id));
    if (options.length === 0) continue;
    out.push({ group, options });
  }
  return out;
}

export function resolveToppingDishesForDish(
  dish: DemoDish,
  allDishes: readonly DemoDish[] = DEMO_DISHES,
): DemoDish[] {
  const binding = dish.toppingBinding;
  if (!binding) return [];
  const inCat = allDishes.filter(
    (d) => d.categoryId === binding.categoryId && d.available && d.id !== dish.id,
  );
  if (binding.itemIds.length === 0) return inCat;
  const allow = new Set(binding.itemIds);
  return inCat.filter((d) => allow.has(d.id));
}

export function money(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function lineConfigKey(input: {
  dishId: string;
  flavorPicks: Record<string, string>;
  toppings: readonly DemoToppingPick[];
  note: string;
  selectedNotePresetIds?: readonly string[];
}): string {
  const flavors = Object.keys(input.flavorPicks)
    .sort()
    .map((g) => `${g}:${input.flavorPicks[g]}`)
    .join('|');
  const tops = [...input.toppings]
    .filter((t) => t.qty > 0)
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map((t) => `${t.itemId}x${t.qty}`)
    .join('|');
  const note = input.note.trim();
  const presets = [...(input.selectedNotePresetIds ?? [])].sort().join('|');
  return [input.dishId, flavors, tops, presets, note].join('::');
}

export function lineUnitPrice(
  dish: DemoDish,
  toppings: readonly DemoToppingPick[],
  allDishes: readonly DemoDish[] = DEMO_DISHES,
): number {
  let sum = dish.price;
  for (const t of toppings) {
    if (t.qty <= 0) continue;
    const item = allDishes.find((d) => d.id === t.itemId);
    if (item) sum += item.price * t.qty;
  }
  return sum;
}

export function flavorsSatisfied(
  dish: DemoDish,
  picks: Record<string, string>,
  groups: readonly DemoFlavorGroup[] = DEMO_FLAVOR_GROUPS,
): boolean {
  const resolved = resolveFlavorOptionsForDish(dish, groups);
  return resolved.every(({ group, options }) => {
    const pick = picks[group.id];
    return Boolean(pick && options.some((o) => o.id === pick));
  });
}

/** 浇头：仅当 binding.required 时，至少选一种且数量≥1 */
export function toppingsSatisfied(
  dish: DemoDish,
  toppings: readonly DemoToppingPick[],
): boolean {
  if (!dish.toppingBinding?.required) return true;
  return toppings.some((t) => t.qty > 0);
}

export function mintLineId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
