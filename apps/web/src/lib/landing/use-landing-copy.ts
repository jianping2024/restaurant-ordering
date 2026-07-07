'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getLandingCopy } from '@/lib/landing/copy';

export function useLandingCopy() {
  const { lang } = useLanguage();
  return getLandingCopy(lang);
}
