import type { Language } from '@/types';
import { parseTableIdParam } from '@/lib/restaurant-tables';

/** DB: menu_choice_groups */
export type MenuChoiceGroup = {
  id: string;
  restaurant_id: string;
  name_en: string;
  name_pt: string;
  name_zh: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
};

/** DB: menu_choice_options */
export type MenuChoiceOption = {
  id: string;
  restaurant_id: string;
  group_id: string;
  name_en: string;
  name_pt: string;
  name_zh: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
};

export type MenuChoiceNameFields = {
  name_en: string;
  name_pt: string;
  name_zh: string;
};

/** Guest/staff catalog: active groups with active options. */
export type MenuChoiceCatalogGroup = {
  id: string;
  name_en: string;
  name_pt: string;
  name_zh: string;
  options: Array<{
    id: string;
    name_en: string;
    name_pt: string;
    name_zh: string;
  }>;
};

export type MenuChoiceCatalog = {
  groups: MenuChoiceCatalogGroup[];
};

/** Dish binding: which options from a group are offered (guest picks one). */
export type MenuChoiceBinding = {
  group_id: string;
  option_ids: string[];
};

export function menuChoiceLocalizedName(
  row: MenuChoiceNameFields,
  lang: Language,
): string {
  if (lang === 'zh') {
    const zh = row.name_zh.trim();
    if (zh) return zh;
  }
  if (lang === 'en') {
    const en = row.name_en.trim();
    if (en) return en;
  }
  const pt = row.name_pt.trim();
  if (pt) return pt;
  return row.name_en.trim() || row.name_zh.trim() || '';
}

export function parseMenuChoiceNameFields(
  raw: Record<string, unknown>,
): MenuChoiceNameFields | { error: string; status: number } {
  if (typeof raw.name_en !== 'string' || typeof raw.name_pt !== 'string') {
    return { error: 'invalid_choice_names', status: 400 };
  }
  const name_en = raw.name_en.trim();
  const name_pt = raw.name_pt.trim();
  const name_zh = typeof raw.name_zh === 'string' ? raw.name_zh.trim() : '';
  if (!name_en || !name_pt) {
    return { error: 'invalid_choice_names', status: 400 };
  }
  return { name_en, name_pt, name_zh };
}

export function normalizeChoiceBindings(raw: unknown): MenuChoiceBinding[] {
  if (!Array.isArray(raw)) return [];
  const out: MenuChoiceBinding[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const groupId = parseTableIdParam(rec.group_id);
    if (!groupId) continue;
    const optionIdsRaw = rec.option_ids;
    if (!Array.isArray(optionIdsRaw)) continue;
    const option_ids: string[] = [];
    const seen = new Set<string>();
    for (const id of optionIdsRaw) {
      const oid = parseTableIdParam(id);
      if (!oid || seen.has(oid)) continue;
      seen.add(oid);
      option_ids.push(oid);
    }
    if (option_ids.length === 0) continue;
    out.push({ group_id: groupId, option_ids });
  }
  return out;
}

/** Resolve guest-facing sections for a dish from catalog + bindings. */
export function resolveDishChoiceSections(
  bindings: readonly MenuChoiceBinding[],
  catalog: MenuChoiceCatalog,
): { group: MenuChoiceCatalogGroup; options: MenuChoiceCatalogGroup['options'] }[] {
  const out: {
    group: MenuChoiceCatalogGroup;
    options: MenuChoiceCatalogGroup['options'];
  }[] = [];
  for (const binding of bindings) {
    const group = catalog.groups.find((g) => g.id === binding.group_id);
    if (!group) continue;
    const allow = new Set(binding.option_ids);
    const options = group.options.filter((o) => allow.has(o.id));
    if (options.length === 0) continue;
    out.push({ group, options });
  }
  return out;
}

export function choicePicksSatisfied(
  bindings: readonly MenuChoiceBinding[],
  catalog: MenuChoiceCatalog,
  picks: Readonly<Record<string, string>>,
): boolean {
  const sections = resolveDishChoiceSections(bindings, catalog);
  return sections.every(({ group, options }) => {
    const pick = picks[group.id];
    return Boolean(pick && options.some((o) => o.id === pick));
  });
}

/** Labels for wire note / kitchen (catalog order). */
export function composeChoicePickLabels(params: {
  picks: Readonly<Record<string, string>>;
  catalog: MenuChoiceCatalog;
  lang: Language;
}): string[] {
  const labels: string[] = [];
  const pickEntries = params.picks;
  for (const group of params.catalog.groups) {
    const optionId = pickEntries[group.id];
    if (!optionId) continue;
    const option = group.options.find((o) => o.id === optionId);
    if (!option) continue;
    const g = menuChoiceLocalizedName(group, params.lang);
    const o = menuChoiceLocalizedName(option, params.lang);
    if (g && o) labels.push(`${g}:${o}`);
    else if (o) labels.push(o);
  }
  return labels;
}

export function buildMenuChoiceCatalog(
  groups: readonly MenuChoiceGroup[],
  options: readonly MenuChoiceOption[],
): MenuChoiceCatalog {
  const activeGroups = [...groups]
    .filter((g) => g.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  return {
    groups: activeGroups.map((g) => ({
      id: g.id,
      name_en: g.name_en,
      name_pt: g.name_pt,
      name_zh: g.name_zh,
      options: options
        .filter((o) => o.group_id === g.id && o.active)
        .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
        .map((o) => ({
          id: o.id,
          name_en: o.name_en,
          name_pt: o.name_pt,
          name_zh: o.name_zh,
        })),
    })),
  };
}
