export type UILanguage = 'zh' | 'en' | 'pt';

export const UI_LANG_COOKIE = 'mesa-ui-lang';
export const DEFAULT_UI_LANG: UILanguage = 'zh';

export const SUPPORTED_UI_LANGS: UILanguage[] = ['zh', 'en', 'pt'];

export function isUILanguage(value: string | null | undefined): value is UILanguage {
  return !!value && SUPPORTED_UI_LANGS.includes(value as UILanguage);
}

export function getClientLanguage(): UILanguage {
  if (typeof window === 'undefined') return DEFAULT_UI_LANG;
  const saved = localStorage.getItem(UI_LANG_COOKIE);
  return isUILanguage(saved) ? saved : DEFAULT_UI_LANG;
}

export function setClientLanguage(lang: UILanguage) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(UI_LANG_COOKIE, lang);
  document.cookie = `${UI_LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}
