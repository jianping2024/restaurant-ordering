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

/** Read UI lang cookie in the browser — same source as getServerLanguage() on SSR. */
export function readUiLangCookie(): UILanguage | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${UI_LANG_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]);
    return isUILanguage(value) ? value : null;
  } catch {
    return isUILanguage(match[1]) ? match[1] : null;
  }
}

export function getClientLanguage(): UILanguage {
  if (typeof window === 'undefined') return DEFAULT_UI_LANG;
  const fromCookie = readUiLangCookie();
  if (fromCookie) return fromCookie;
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
