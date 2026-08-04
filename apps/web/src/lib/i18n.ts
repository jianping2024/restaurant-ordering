export type UILanguage = 'zh' | 'en' | 'pt' | 'es' | 'fr' | 'de';

export const UI_LANG_COOKIE = 'mesa-ui-lang';
/** @deprecated Migrated to {@link UI_LANG_COOKIE}; read once then removed. */
const LEGACY_UI_LANG_STORAGE_KEY = 'mesa-lang';
export const DEFAULT_UI_LANG: UILanguage = 'pt';

/**
 * Single catalog of UI languages. Labels are always native names (not translated
 * per current UI lang) so the picker stays one representation everywhere.
 */
export const UI_LANGUAGE_OPTIONS: readonly {
  id: UILanguage;
  /** Compact pill / flag-adjacent code. */
  shortLabel: string;
  /** Native endonym shown in pickers (Español, Français, …). */
  nativeName: string;
  flag: string;
}[] = [
  { id: 'zh', shortLabel: '中', nativeName: '简体中文', flag: '🇨🇳' },
  { id: 'en', shortLabel: 'EN', nativeName: 'English', flag: '🇬🇧' },
  { id: 'pt', shortLabel: 'PT', nativeName: 'Português', flag: '🇵🇹' },
  { id: 'es', shortLabel: 'ES', nativeName: 'Español', flag: '🇪🇸' },
  { id: 'fr', shortLabel: 'FR', nativeName: 'Français', flag: '🇫🇷' },
  { id: 'de', shortLabel: 'DE', nativeName: 'Deutsch', flag: '🇩🇪' },
] as const;

export const SUPPORTED_UI_LANGS: UILanguage[] = UI_LANGUAGE_OPTIONS.map((o) => o.id);

export const HTML_LANG_BY_UI: Record<UILanguage, string> = {
  zh: 'zh-Hans',
  en: 'en',
  pt: 'pt',
  es: 'es',
  fr: 'fr',
  de: 'de',
};

export function uiLanguageOption(id: UILanguage) {
  return UI_LANGUAGE_OPTIONS.find((o) => o.id === id) ?? UI_LANGUAGE_OPTIONS[2];
}

export function isUILanguage(value: string | null | undefined): value is UILanguage {
  return !!value && SUPPORTED_UI_LANGS.includes(value as UILanguage);
}

export function getClientLanguage(): UILanguage {
  if (typeof window === 'undefined') return DEFAULT_UI_LANG;
  const saved = localStorage.getItem(UI_LANG_COOKIE);
  if (isUILanguage(saved)) return saved;
  const legacy = localStorage.getItem(LEGACY_UI_LANG_STORAGE_KEY);
  if (isUILanguage(legacy)) {
    setClientLanguage(legacy);
    return legacy;
  }
  return DEFAULT_UI_LANG;
}

export function setClientLanguage(lang: UILanguage) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(UI_LANG_COOKIE, lang);
  localStorage.removeItem(LEGACY_UI_LANG_STORAGE_KEY);
  document.cookie = `${UI_LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}
