import type { Language } from '@/types';

export const STOREFRONT_INTRO_MAX = 500;

export type StorefrontIntroI18n = {
  pt: string;
  en: string;
  zh: string;
};

const EMPTY: StorefrontIntroI18n = { pt: '', en: '', zh: '' };

function sanitize(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, STOREFRONT_INTRO_MAX);
}

export function emptyStorefrontIntro(): StorefrontIntroI18n {
  return { ...EMPTY };
}

export function normalizeStorefrontIntro(value: unknown): StorefrontIntroI18n {
  if (!value || typeof value !== 'object') return emptyStorefrontIntro();
  const row = value as Record<string, unknown>;
  return {
    pt: sanitize(row.pt),
    en: sanitize(row.en),
    zh: sanitize(row.zh),
  };
}

/** UI lang → text; missing langs fall back pt → en → zh. */
export function resolveStorefrontIntroText(
  intro: StorefrontIntroI18n,
  lang: Language,
): string {
  if (lang === 'zh') return (intro.zh || intro.en || intro.pt).trim();
  if (lang === 'en') return (intro.en || intro.pt || intro.zh).trim();
  if (lang === 'pt') return (intro.pt || intro.en || intro.zh).trim();
  return (intro.en || intro.pt || intro.zh).trim();
}

export function storefrontIntroHasAny(intro: StorefrontIntroI18n): boolean {
  return Boolean(intro.pt.trim() || intro.en.trim() || intro.zh.trim());
}
