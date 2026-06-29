export type UILanguage = 'zh' | 'en' | 'pt';

export const UI_LANG_COOKIE = 'mesa-ui-lang';
/** @deprecated Migrated to {@link UI_LANG_COOKIE}; read once then removed. */
const LEGACY_UI_LANG_STORAGE_KEY = 'mesa-lang';
export const DEFAULT_UI_LANG: UILanguage = 'zh';

export const SUPPORTED_UI_LANGS: UILanguage[] = ['zh', 'en', 'pt'];

export const HTML_LANG_BY_UI: Record<UILanguage, string> = {
  zh: 'zh-Hans',
  en: 'en',
  pt: 'pt',
};

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
