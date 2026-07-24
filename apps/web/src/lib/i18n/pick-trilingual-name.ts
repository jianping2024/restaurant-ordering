import type { UILanguage } from '@/lib/i18n';

/** CamelCase trilingual label (analytics / dashboard view models). */
export type TrilingualName = {
  namePt: string;
  nameEn?: string | null;
  nameZh?: string | null;
};

/** Pick display string for UI language; cascade pt/en/zh fallbacks. */
export function pickTrilingualName(row: TrilingualName, lang: UILanguage): string {
  if (lang === 'zh') {
    return (row.nameZh || row.nameEn || row.namePt || '').trim();
  }
  if (lang === 'pt') {
    return (row.namePt || row.nameEn || row.nameZh || '').trim();
  }
  return (row.nameEn || row.namePt || row.nameZh || '').trim();
}
