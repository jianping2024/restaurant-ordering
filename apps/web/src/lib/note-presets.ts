import type { Language } from '@/types';

export type NotePresetGroup =
  | 'taste'
  | 'doneness'
  | 'allergy'
  | 'ingredients'
  | 'service';

export interface NotePresetDefinition {
  key: string;
  group: NotePresetGroup;
  labels: Record<Language, string>;
}

export const NOTE_PRESET_GROUP_LABELS: Record<NotePresetGroup, Record<Language, string>> = {
  taste: { zh: '口味偏好', en: 'Taste', pt: 'Sabor', es: 'Sabor', fr: 'Goût', de: 'Geschmack' },
  doneness: {
    zh: '火候熟度',
    en: 'Doneness',
    pt: 'Ponto da carne',
    es: 'Punto de la carne',
    fr: 'Cuisson',
    de: 'Garstufe',
  },
  allergy: { zh: '过敏忌口', en: 'Allergy', pt: 'Alergia', es: 'Alergias', fr: 'Allergies', de: 'Allergien' },
  ingredients: {
    zh: '配料去留',
    en: 'Ingredients',
    pt: 'Ingredientes',
    es: 'Ingredientes',
    fr: 'Ingrédients',
    de: 'Zutaten',
  },
  service: { zh: '出餐方式', en: 'Service', pt: 'Servico', es: 'Servicio', fr: 'Service', de: 'Service' },
};

export const NOTE_PRESETS: NotePresetDefinition[] = [
  {
    key: 'less_salt',
    group: 'taste',
    labels: { zh: '少盐', en: 'less salt', pt: 'sem sal', es: 'poca sal', fr: 'peu de sel', de: 'wenig Salz' },
  },
  {
    key: 'less_oil',
    group: 'taste',
    labels: {
      zh: '少油',
      en: 'less oil',
      pt: 'pouco oleo',
      es: 'poco aceite',
      fr: 'peu de matière grasse',
      de: 'wenig Öl',
    },
  },
  {
    key: 'no_spicy',
    group: 'taste',
    labels: {
      zh: '不要辣',
      en: 'not spicy',
      pt: 'sem picante',
      es: 'sin picante',
      fr: 'sans piment',
      de: 'nicht scharf',
    },
  },
  {
    key: 'medium_spicy',
    group: 'taste',
    labels: {
      zh: '中辣',
      en: 'medium spicy',
      pt: 'picante medio',
      es: 'picante medio',
      fr: 'moyennement épicé',
      de: 'mittelscharf',
    },
  },
  {
    key: 'extra_spicy',
    group: 'taste',
    labels: {
      zh: '特辣',
      en: 'extra spicy',
      pt: 'picante extra',
      es: 'muy picante',
      fr: 'très épicé',
      de: 'extra scharf',
    },
  },
  {
    key: 'less_sweet',
    group: 'taste',
    labels: {
      zh: '少糖',
      en: 'less sweet',
      pt: 'menos doce',
      es: 'poco dulce',
      fr: 'peu sucré',
      de: 'wenig Zucker',
    },
  },

  {
    key: 'rare',
    group: 'doneness',
    labels: { zh: '三分熟', en: 'rare', pt: 'mal passado', es: 'poco hecho', fr: 'saignant', de: 'englisch' },
  },
  {
    key: 'medium',
    group: 'doneness',
    labels: { zh: '五分熟', en: 'medium', pt: 'ao ponto', es: 'al punto', fr: 'à point', de: 'medium' },
  },
  {
    key: 'medium_well',
    group: 'doneness',
    labels: {
      zh: '七分熟',
      en: 'medium well',
      pt: 'bem ao ponto',
      es: 'tres cuartos',
      fr: 'cuit',
      de: 'halb durch',
    },
  },
  {
    key: 'well_done',
    group: 'doneness',
    labels: {
      zh: '全熟',
      en: 'well done',
      pt: 'bem passado',
      es: 'muy hecho',
      fr: 'bien cuit',
      de: 'durchgebraten',
    },
  },

  {
    key: 'no_gluten',
    group: 'allergy',
    labels: {
      zh: '无麸质',
      en: 'gluten free',
      pt: 'sem gluten',
      es: 'sin gluten',
      fr: 'sans gluten',
      de: 'glutenfrei',
    },
  },
  {
    key: 'no_dairy',
    group: 'allergy',
    labels: {
      zh: '无乳制品',
      en: 'no dairy',
      pt: 'sem lacteos',
      es: 'sin lácteos',
      fr: 'sans produits laitiers',
      de: 'ohne Milchprodukte',
    },
  },
  {
    key: 'no_peanut',
    group: 'allergy',
    labels: {
      zh: '无花生',
      en: 'no peanut',
      pt: 'sem amendoim',
      es: 'sin cacahuete',
      fr: 'sans cacahuète',
      de: 'ohne Erdnüsse',
    },
  },
  {
    key: 'no_shellfish',
    group: 'allergy',
    labels: {
      zh: '无贝类',
      en: 'no shellfish',
      pt: 'sem marisco',
      es: 'sin marisco',
      fr: 'sans fruits de mer',
      de: 'ohne Schalentiere',
    },
  },
  {
    key: 'no_egg',
    group: 'allergy',
    labels: { zh: '无蛋', en: 'no egg', pt: 'sem ovo', es: 'sin huevo', fr: 'sans œuf', de: 'ohne Ei' },
  },

  {
    key: 'no_onion',
    group: 'ingredients',
    labels: {
      zh: '不要洋葱',
      en: 'no onion',
      pt: 'sem cebola',
      es: 'sin cebolla',
      fr: 'sans oignon',
      de: 'ohne Zwiebeln',
    },
  },
  {
    key: 'no_garlic',
    group: 'ingredients',
    labels: {
      zh: '不要蒜',
      en: 'no garlic',
      pt: 'sem alho',
      es: 'sin ajo',
      fr: 'sans ail',
      de: 'ohne Knoblauch',
    },
  },
  {
    key: 'no_coriander',
    group: 'ingredients',
    labels: {
      zh: '不要香菜',
      en: 'no coriander',
      pt: 'sem coentros',
      es: 'sin cilantro',
      fr: 'sans coriandre',
      de: 'ohne Koriander',
    },
  },
  {
    key: 'no_scallion',
    group: 'ingredients',
    labels: {
      zh: '不要葱',
      en: 'no scallion',
      pt: 'sem cebolinha',
      es: 'sin cebolleta',
      fr: 'sans ciboule',
      de: 'ohne Frühlingszwiebeln',
    },
  },
  {
    key: 'no_mushroom',
    group: 'ingredients',
    labels: {
      zh: '不要蘑菇',
      en: 'no mushroom',
      pt: 'sem cogumelos',
      es: 'sin champiñones',
      fr: 'sans champignons',
      de: 'ohne Pilze',
    },
  },

  {
    key: 'sauce_on_side',
    group: 'service',
    labels: {
      zh: '酱汁分开',
      en: 'sauce on side',
      pt: 'molho a parte',
      es: 'salsa aparte',
      fr: 'sauce à part',
      de: 'Sauce separat',
    },
  },
  {
    key: 'pack_separately',
    group: 'service',
    labels: {
      zh: '分开打包',
      en: 'pack separately',
      pt: 'embalar separado',
      es: 'envasar por separado',
      fr: 'emballer séparément',
      de: 'getrennt verpacken',
    },
  },
  {
    key: 'utensils_needed',
    group: 'service',
    labels: {
      zh: '需要餐具',
      en: 'need utensils',
      pt: 'com talheres',
      es: 'con cubiertos',
      fr: 'avec couverts',
      de: 'mit Besteck',
    },
  },
];

export const NOTE_PRESET_BY_KEY = new Map(NOTE_PRESETS.map((preset) => [preset.key, preset]));

export function getLabelByPresetKey(key: string, lang: Language): string {
  return NOTE_PRESET_BY_KEY.get(key)?.labels[lang] || key;
}
