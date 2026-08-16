import type { Language } from '@/types';

/**
 * EU Reg. 1169/2011 Annex II — sole menu-item allergen code list.
 * Dish "contains" declaration (`menu_items.allergen_codes`); not guest note presets.
 */
export const ALLERGEN_CODES = [
  'egg',
  'milk',
  'soy',
  'gluten',
  'peanut',
  'sulphites',
  'fish',
  'molluscs',
  'mustard',
  'tree_nuts',
  'sesame',
  'celery',
  'lupin',
  'crustaceans',
] as const;

export type AllergenCode = (typeof ALLERGEN_CODES)[number];

const ALLERGEN_CODE_SET: ReadonlySet<string> = new Set(ALLERGEN_CODES);

export function isAllergenCode(value: string): value is AllergenCode {
  return ALLERGEN_CODE_SET.has(value);
}

export interface AllergenDefinition {
  code: AllergenCode;
  labels: Record<Language, string>;
}

export const ALLERGENS: AllergenDefinition[] = [
  {
    code: 'egg',
    labels: { zh: '蛋', en: 'Egg', pt: 'Ovo', es: 'Huevo', fr: 'Œuf', de: 'Ei' },
  },
  {
    code: 'milk',
    labels: { zh: '乳', en: 'Milk', pt: 'Leite', es: 'Leche', fr: 'Lait', de: 'Milch' },
  },
  {
    code: 'soy',
    labels: { zh: '大豆', en: 'Soy', pt: 'Soja', es: 'Soja', fr: 'Soja', de: 'Soja' },
  },
  {
    code: 'gluten',
    labels: { zh: '麸质', en: 'Gluten', pt: 'Glúten', es: 'Gluten', fr: 'Gluten', de: 'Gluten' },
  },
  {
    code: 'peanut',
    labels: {
      zh: '花生',
      en: 'Peanut',
      pt: 'Amendoim',
      es: 'Cacahuete',
      fr: 'Arachide',
      de: 'Erdnuss',
    },
  },
  {
    code: 'sulphites',
    labels: {
      zh: '亚硫酸盐',
      en: 'Sulphites',
      pt: 'Sulfitos',
      es: 'Sulfitos',
      fr: 'Sulfites',
      de: 'Sulfite',
    },
  },
  {
    code: 'fish',
    labels: { zh: '鱼', en: 'Fish', pt: 'Peixe', es: 'Pescado', fr: 'Poisson', de: 'Fisch' },
  },
  {
    code: 'molluscs',
    labels: {
      zh: '软体动物',
      en: 'Molluscs',
      pt: 'Moluscos',
      es: 'Moluscos',
      fr: 'Mollusques',
      de: 'Weichtiere',
    },
  },
  {
    code: 'mustard',
    labels: {
      zh: '芥末',
      en: 'Mustard',
      pt: 'Mostarda',
      es: 'Mostaza',
      fr: 'Moutarde',
      de: 'Senf',
    },
  },
  {
    code: 'tree_nuts',
    labels: {
      zh: '坚果',
      en: 'Tree nuts',
      pt: 'Frutos secos',
      es: 'Frutos de cáscara',
      fr: 'Fruits à coque',
      de: 'Schalenfrüchte',
    },
  },
  {
    code: 'sesame',
    labels: {
      zh: '芝麻',
      en: 'Sesame',
      pt: 'Sésamo',
      es: 'Sésamo',
      fr: 'Sésame',
      de: 'Sesam',
    },
  },
  {
    code: 'celery',
    labels: { zh: '芹菜', en: 'Celery', pt: 'Aipo', es: 'Apio', fr: 'Céleri', de: 'Sellerie' },
  },
  {
    code: 'lupin',
    labels: {
      zh: '羽扇豆',
      en: 'Lupin',
      pt: 'Tremoço',
      es: 'Altramuces',
      fr: 'Lupin',
      de: 'Lupine',
    },
  },
  {
    code: 'crustaceans',
    labels: {
      zh: '甲壳类',
      en: 'Crustaceans',
      pt: 'Crustáceos',
      es: 'Crustáceos',
      fr: 'Crustacés',
      de: 'Krebstiere',
    },
  },
];

export const ALLERGEN_SECTION_UI: Record<
  Language,
  { title: string; hint: string }
> = {
  zh: {
    title: '含有过敏原',
    hint: '可选。勾选本菜已知含有的过敏原（欧盟 14 类）。未勾选表示未标注，不等于无过敏原。',
  },
  en: {
    title: 'Contains allergens',
    hint: 'Optional. Mark allergens this dish is known to contain (EU 14). Empty means unmarked, not allergen-free.',
  },
  pt: {
    title: 'Contém alergénios',
    hint: 'Opcional. Indique alergénios que o prato contém (UE 14). Vazio = não marcado, não significa sem alergénios.',
  },
  es: {
    title: 'Contiene alérgenos',
    hint: 'Opcional. Marque alérgenos que contiene el plato (UE 14). Vacío = sin marcar, no significa sin alérgenos.',
  },
  fr: {
    title: 'Contient des allergènes',
    hint: 'Facultatif. Cochez les allergènes connus (UE 14). Vide = non renseigné, pas « sans allergène ».',
  },
  de: {
    title: 'Enthält Allergene',
    hint: 'Optional. Bekannte Allergene markieren (EU 14). Leer = nicht gekennzeichnet, nicht allergenfrei.',
  },
};

/** Validate + dedupe; null if shape/codes invalid. Sole parse path for menu item allergen_codes. */
export function normalizeAllergenCodes(raw: unknown): AllergenCode[] | null {
  if (!Array.isArray(raw) || raw.some((code) => typeof code !== 'string')) {
    return null;
  }
  const seen = new Set<string>();
  const out: AllergenCode[] = [];
  for (const code of raw) {
    if (!isAllergenCode(code)) return null;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}
