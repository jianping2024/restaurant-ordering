import type { MenuCategory, MenuItem, PrintStation } from '@/types';
import type { UILanguage } from '@/lib/i18n';

export function getPrintStationDisplayName(station: PrintStation, lang: UILanguage): string {
  if (lang === 'zh') return station.name_zh?.trim() || station.name_pt;
  if (lang === 'pt') return station.name_pt;
  // en / es / fr / de
  return station.name_en?.trim() || station.name_pt;
}

export function countPrintStationBindings(
  stationId: string,
  categories: Pick<MenuCategory, 'print_station_id'>[],
  items: Pick<MenuItem, 'print_station_id'>[],
): { categories: number; dishes: number } {
  return {
    categories: categories.filter((c) => c.print_station_id === stationId).length,
    dishes: items.filter((i) => i.print_station_id === stationId).length,
  };
}

/** Sole menu-binding label: always `模板` with counts (including zeros). */
export function formatPrintStationMenuBindings(
  categories: number,
  dishes: number,
  template: string,
): string {
  return template
    .replace('{categories}', String(categories))
    .replace('{dishes}', String(dishes));
}

export type PrintStationAltNamePart = { code: 'EN' | 'PT'; text: string };

/**
 * Sole alt-name line parts: EN/PT when empty or different from title.
 * Empty stored name → missingLabel；same as title → omit.
 */
export function printStationAltNameParts(
  station: Pick<PrintStation, 'name_en' | 'name_pt'>,
  title: string,
  missingLabel: string,
): PrintStationAltNamePart[] {
  const titleNorm = title.trim();
  const parts: PrintStationAltNamePart[] = [];
  for (const [code, raw] of [
    ['EN', station.name_en],
    ['PT', station.name_pt],
  ] as const) {
    const value = (raw ?? '').trim();
    if (value && value === titleNorm) continue;
    parts.push({ code, text: value || missingLabel });
  }
  return parts;
}

/** Sole join for EN/PT alt names on the station card. */
export function formatPrintStationAltNamesLine(parts: PrintStationAltNamePart[]): string {
  return parts.map((p) => `${p.code} ${p.text}`).join(' · ');
}
