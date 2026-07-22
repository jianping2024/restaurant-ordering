'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getLandingPreviewCopy } from '@/lib/landing/preview-copy';

export function useLandingPreviewCopy() {
  const { lang } = useLanguage();
  return { lang, copy: getLandingPreviewCopy(lang) };
}
