import type { Language } from '@/types';

/**
 * Sole menu-item flavor display codes (`menu_items.flavor_codes`).
 * Guest chips only — not note presets, allergens, vegetarian, or print.
 * UI gated by restaurant feature `menu_flavor_hints_enabled` (default off).
 */

export const FLAVOR_CODES = [
  'spice_mild',
  'spice_medium',
  'spice_extra',
  'numb_mild',
  'numb_medium',
  'numb_extra',
  'sour',
  'sweet',
  'sweet_sour',
  'light',
  'heavy',
  'umami',
  'aroma_garlic',
  'aroma_scallion',
  'aroma_cumin',
] as const;

export type FlavorCode = (typeof FLAVOR_CODES)[number];

const FLAVOR_CODE_SET: ReadonlySet<string> = new Set(FLAVOR_CODES);

/** Exclusive pick groups: at most one code per group after normalize. */
export type FlavorExclusiveGroup = 'spice' | 'numb' | 'body';

export type FlavorGroup = FlavorExclusiveGroup | 'taste' | 'aroma';

export function isFlavorCode(value: string): value is FlavorCode {
  return FLAVOR_CODE_SET.has(value);
}

export interface FlavorDefinition {
  code: FlavorCode;
  group: FlavorGroup;
  labels: Record<Language, string>;
}

export const FLAVORS: FlavorDefinition[] = [
  {
    code: 'spice_mild',
    group: 'spice',
    labels: {
      zh: '微辣',
      en: 'Mild',
      pt: 'Pouco picante',
      es: 'Poco picante',
      fr: 'Légèrement piquant',
      de: 'Leicht scharf',
    },
  },
  {
    code: 'spice_medium',
    group: 'spice',
    labels: {
      zh: '中辣',
      en: 'Medium spicy',
      pt: 'Picante médio',
      es: 'Picante medio',
      fr: 'Moyennement piquant',
      de: 'Mittel scharf',
    },
  },
  {
    code: 'spice_extra',
    group: 'spice',
    labels: {
      zh: '特辣',
      en: 'Extra spicy',
      pt: 'Muito picante',
      es: 'Muy picante',
      fr: 'Très piquant',
      de: 'Sehr scharf',
    },
  },
  {
    code: 'numb_mild',
    group: 'numb',
    labels: {
      zh: '微麻',
      en: 'Mild numb',
      pt: 'Leve formigueiro',
      es: 'Ligero hormigueo',
      fr: 'Léger engourdissement',
      de: 'Leicht taub',
    },
  },
  {
    code: 'numb_medium',
    group: 'numb',
    labels: {
      zh: '中麻',
      en: 'Medium numb',
      pt: 'Formigueiro médio',
      es: 'Hormigueo medio',
      fr: 'Engourdissement moyen',
      de: 'Mittel taub',
    },
  },
  {
    code: 'numb_extra',
    group: 'numb',
    labels: {
      zh: '特麻',
      en: 'Extra numb',
      pt: 'Muito formigueiro',
      es: 'Mucho hormigueo',
      fr: 'Fort engourdissement',
      de: 'Stark taub',
    },
  },
  {
    code: 'sour',
    group: 'taste',
    labels: { zh: '酸', en: 'Sour', pt: 'Ácido', es: 'Ácido', fr: 'Acide', de: 'Sauer' },
  },
  {
    code: 'sweet',
    group: 'taste',
    labels: { zh: '甜', en: 'Sweet', pt: 'Doce', es: 'Dulce', fr: 'Sucré', de: 'Süß' },
  },
  {
    code: 'sweet_sour',
    group: 'taste',
    labels: {
      zh: '酸甜',
      en: 'Sweet & sour',
      pt: 'Agridoce',
      es: 'Agridulce',
      fr: 'Aigre-doux',
      de: 'Süß-sauer',
    },
  },
  {
    code: 'light',
    group: 'body',
    labels: {
      zh: '清淡',
      en: 'Light',
      pt: 'Ligeiro',
      es: 'Ligero',
      fr: 'Léger',
      de: 'Leicht',
    },
  },
  {
    code: 'heavy',
    group: 'body',
    labels: {
      zh: '重口',
      en: 'Bold',
      pt: 'Intenso',
      es: 'Intenso',
      fr: 'Corsé',
      de: 'Kräftig',
    },
  },
  {
    code: 'umami',
    group: 'taste',
    labels: { zh: '鲜', en: 'Umami', pt: 'Umami', es: 'Umami', fr: 'Umami', de: 'Umami' },
  },
  {
    code: 'aroma_garlic',
    group: 'aroma',
    labels: {
      zh: '蒜香',
      en: 'Garlic',
      pt: 'Alho',
      es: 'Ajo',
      fr: 'Ail',
      de: 'Knoblauch',
    },
  },
  {
    code: 'aroma_scallion',
    group: 'aroma',
    labels: {
      zh: '葱香',
      en: 'Scallion',
      pt: 'Cebolinho',
      es: 'Cebolleta',
      fr: 'Ciboule',
      de: 'Frühlingszwiebel',
    },
  },
  {
    code: 'aroma_cumin',
    group: 'aroma',
    labels: {
      zh: '孜然香',
      en: 'Cumin',
      pt: 'Cominhos',
      es: 'Comino',
      fr: 'Cumin',
      de: 'Kreuzkümmel',
    },
  },
];

const FLAVOR_BY_CODE: ReadonlyMap<FlavorCode, FlavorDefinition> = new Map(
  FLAVORS.map((row) => [row.code, row]),
);

const EXCLUSIVE_GROUPS: ReadonlySet<FlavorGroup> = new Set(['spice', 'numb', 'body']);

export const FLAVOR_SECTION_UI: Record<Language, { title: string; hint: string }> = {
  zh: {
    title: '风味提示',
    hint: '可选。标在菜卡上给客人看（菜本身什么味）。不是点菜备注，也不是过敏原。不辣不标。辣度/麻/清淡·重口每组最多选一个。',
  },
  en: {
    title: 'Flavor hints',
    hint: 'Optional. Shown on the dish card. Not order notes or allergens. Leave spice unmarked when not spicy. At most one spice / numb / light-or-bold pick.',
  },
  pt: {
    title: 'Notas de sabor',
    hint: 'Opcional. Aparece no cartão do prato. Não é nota de pedido nem alergénio. Sem picante = não marcar. No máximo um em picante / formigueiro / ligeiro-intenso.',
  },
  es: {
    title: 'Notas de sabor',
    hint: 'Opcional. En la ficha del plato. No es nota de pedido ni alérgeno. Sin picante = no marcar. Como máximo uno en picante / hormigueo / ligero-intenso.',
  },
  fr: {
    title: 'Notes de goût',
    hint: 'Facultatif. Sur la fiche. Pas une note de commande ni un allergène. Pas piquant = ne pas cocher. Au plus un parmi piquant / engourdissant / léger-corsé.',
  },
  de: {
    title: 'Geschmackshinweise',
    hint: 'Optional. Auf der Gerichtskarte. Keine Bestellnotiz und kein Allergen. Nicht scharf = nicht markieren. Höchstens eines bei Schärfe / Taubheit / Leicht-kräftig.',
  },
};

/** Validate + dedupe; exclusive groups keep last pick. Null if shape/codes invalid. */
export function normalizeFlavorCodes(raw: unknown): FlavorCode[] | null {
  if (!Array.isArray(raw) || raw.some((code) => typeof code !== 'string')) {
    return null;
  }
  const exclusiveLast = new Map<FlavorExclusiveGroup, FlavorCode>();
  const seenMulti = new Set<FlavorCode>();

  for (const code of raw) {
    if (!isFlavorCode(code)) return null;
    const def = FLAVOR_BY_CODE.get(code)!;
    if (EXCLUSIVE_GROUPS.has(def.group)) {
      exclusiveLast.set(def.group as FlavorExclusiveGroup, code);
      continue;
    }
    if (seenMulti.has(code)) continue;
    seenMulti.add(code);
  }

  const out: FlavorCode[] = [];
  for (const def of FLAVORS) {
    if (EXCLUSIVE_GROUPS.has(def.group)) {
      if (exclusiveLast.get(def.group as FlavorExclusiveGroup) === def.code) {
        out.push(def.code);
      }
      continue;
    }
    if (seenMulti.has(def.code)) out.push(def.code);
  }
  return out;
}

export function flavorLabel(code: FlavorCode, lang: Language): string {
  return FLAVOR_BY_CODE.get(code)?.labels[lang] ?? code;
}

export type MenuItemFlavorChip = { code: FlavorCode; label: string };

/** Sole guest/dashboard-facing presentation of `flavor_codes`. Empty → no chips. All text. */
export function resolveMenuItemFlavorPresentation(
  flavorCodes: unknown,
  lang: Language,
): MenuItemFlavorChip[] {
  const codes = normalizeFlavorCodes(flavorCodes ?? []);
  if (!codes || codes.length === 0) return [];
  return codes.map((code) => ({ code, label: flavorLabel(code, lang) }));
}

/** Toggle a flavor code in staff editor; exclusive groups replace the prior pick. */
export function toggleFlavorCodeInDraft(
  current: readonly string[],
  code: FlavorCode,
): FlavorCode[] {
  const def = FLAVOR_BY_CODE.get(code);
  if (!def) return normalizeFlavorCodes(current) ?? [];
  const normalized = normalizeFlavorCodes(current) ?? [];
  const has = normalized.includes(code);
  if (EXCLUSIVE_GROUPS.has(def.group)) {
    const withoutGroup = normalized.filter((c) => FLAVOR_BY_CODE.get(c)?.group !== def.group);
    if (has) return withoutGroup;
    return normalizeFlavorCodes([...withoutGroup, code]) ?? withoutGroup;
  }
  if (has) return normalized.filter((c) => c !== code);
  return normalizeFlavorCodes([...normalized, code]) ?? normalized;
}
