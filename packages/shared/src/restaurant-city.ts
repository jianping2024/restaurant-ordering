/**
 * Sole city parser + search match for store lists (multi-store plan §6.2b: city comes from
 * the store address). Used by the ops link screen (city select-all) and the web store list.
 */

const POSTAL_CODE = /\b\d{4}-\d{3}\b/g;
const COUNTRY_SUFFIX = /^(portugal|pt)$/i;

/**
 * City from a free-text store address: last comma segment that is not the country, with
 * the PT postal code stripped («Rua Augusta 100, 1100-053 Lisboa» → «Lisboa»). Empty when
 * unknown.
 */
export function restaurantCityFromAddress(address: string | null | undefined): string {
  if (!address) return '';
  const segments = address
    .split(/[,\n]/)
    .map((s) => s.replace(POSTAL_CODE, '').replace(/\s+/g, ' ').trim())
    .filter((s) => s && !COUNTRY_SUFFIX.test(s));
  return segments[segments.length - 1] ?? '';
}

function foldSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Instant store-list filter on name / city / slug (case- and accent-insensitive). */
export function storeMatchesSearch(
  store: { name: string; city: string; slug: string },
  query: string,
): boolean {
  const q = foldSearchText(query.trim());
  if (!q) return true;
  return foldSearchText(`${store.name} ${store.city} ${store.slug}`).includes(q);
}
