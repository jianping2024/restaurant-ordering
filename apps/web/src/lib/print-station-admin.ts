import type { MenuCategory, MenuItem, PrintStation } from '@/types';
import type { UILanguage } from '@/lib/i18n';

export function getPrintStationDisplayName(station: PrintStation, lang: UILanguage): string {
  if (lang === 'en') return station.name_en?.trim() || station.name_pt;
  if (lang === 'zh') return station.name_zh?.trim() || station.name_pt;
  return station.name_pt;
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
