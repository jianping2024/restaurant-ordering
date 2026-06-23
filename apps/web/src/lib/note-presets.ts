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
  taste: { zh: '口味偏好', en: 'Taste', pt: 'Sabor' },
  doneness: { zh: '火候熟度', en: 'Doneness', pt: 'Ponto da carne' },
  allergy: { zh: '过敏忌口', en: 'Allergy', pt: 'Alergia' },
  ingredients: { zh: '配料去留', en: 'Ingredients', pt: 'Ingredientes' },
  service: { zh: '出餐方式', en: 'Service', pt: 'Servico' },
};

export const NOTE_PRESETS: NotePresetDefinition[] = [
  { key: 'less_salt', group: 'taste', labels: { zh: '少盐', en: 'less salt', pt: 'sem sal' } },
  { key: 'less_oil', group: 'taste', labels: { zh: '少油', en: 'less oil', pt: 'pouco oleo' } },
  { key: 'no_spicy', group: 'taste', labels: { zh: '不要辣', en: 'not spicy', pt: 'sem picante' } },
  { key: 'medium_spicy', group: 'taste', labels: { zh: '中辣', en: 'medium spicy', pt: 'picante medio' } },
  { key: 'extra_spicy', group: 'taste', labels: { zh: '特辣', en: 'extra spicy', pt: 'picante extra' } },
  { key: 'less_sweet', group: 'taste', labels: { zh: '少糖', en: 'less sweet', pt: 'menos doce' } },

  { key: 'rare', group: 'doneness', labels: { zh: '三分熟', en: 'rare', pt: 'mal passado' } },
  { key: 'medium', group: 'doneness', labels: { zh: '五分熟', en: 'medium', pt: 'ao ponto' } },
  { key: 'medium_well', group: 'doneness', labels: { zh: '七分熟', en: 'medium well', pt: 'bem ao ponto' } },
  { key: 'well_done', group: 'doneness', labels: { zh: '全熟', en: 'well done', pt: 'bem passado' } },

  { key: 'no_gluten', group: 'allergy', labels: { zh: '无麸质', en: 'gluten free', pt: 'sem gluten' } },
  { key: 'no_dairy', group: 'allergy', labels: { zh: '无乳制品', en: 'no dairy', pt: 'sem lacteos' } },
  { key: 'no_peanut', group: 'allergy', labels: { zh: '无花生', en: 'no peanut', pt: 'sem amendoim' } },
  { key: 'no_shellfish', group: 'allergy', labels: { zh: '无贝类', en: 'no shellfish', pt: 'sem marisco' } },
  { key: 'no_egg', group: 'allergy', labels: { zh: '无蛋', en: 'no egg', pt: 'sem ovo' } },

  { key: 'no_onion', group: 'ingredients', labels: { zh: '不要洋葱', en: 'no onion', pt: 'sem cebola' } },
  { key: 'no_garlic', group: 'ingredients', labels: { zh: '不要蒜', en: 'no garlic', pt: 'sem alho' } },
  { key: 'no_coriander', group: 'ingredients', labels: { zh: '不要香菜', en: 'no coriander', pt: 'sem coentros' } },
  { key: 'no_scallion', group: 'ingredients', labels: { zh: '不要葱', en: 'no scallion', pt: 'sem cebolinha' } },
  { key: 'no_mushroom', group: 'ingredients', labels: { zh: '不要蘑菇', en: 'no mushroom', pt: 'sem cogumelos' } },

  { key: 'sauce_on_side', group: 'service', labels: { zh: '酱汁分开', en: 'sauce on side', pt: 'molho a parte' } },
  { key: 'pack_separately', group: 'service', labels: { zh: '分开打包', en: 'pack separately', pt: 'embalar separado' } },
  { key: 'utensils_needed', group: 'service', labels: { zh: '需要餐具', en: 'need utensils', pt: 'com talheres' } },
];

export const NOTE_PRESET_BY_KEY = new Map(NOTE_PRESETS.map((preset) => [preset.key, preset]));

export function getLabelByPresetKey(key: string, lang: Language): string {
  return NOTE_PRESET_BY_KEY.get(key)?.labels[lang] || key;
}
