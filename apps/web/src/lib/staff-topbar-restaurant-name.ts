/**
 * Staff top-bar restaurant name fit — when the brand row is short on width:
 * 1. Keep as many leading words as fit (drop words from the right).
 * 2. If only one word remains and still overflows, ellipsize that word (`…`).
 *
 * Word split is whitespace only. Names without spaces (e.g. Chinese) are one word
 * and go straight to character ellipsis when needed.
 */

export const STAFF_TOPBAR_NAME_ELLIPSIS = '…';

export type StaffTopBarRestaurantNameFitMode = 'full' | 'drop-words' | 'ellipsis';

export type StaffTopBarRestaurantNameFit = {
  display: string;
  mode: StaffTopBarRestaurantNameFitMode;
  /** Words kept before any character ellipsis (1 when ellipsizing a single word). */
  keptWordCount: number;
};

export type StaffTopBarRestaurantNameMeasure = (text: string) => number;

function ellipsizeToWidth(
  text: string,
  maxWidthPx: number,
  measure: StaffTopBarRestaurantNameMeasure,
  ellipsis: string = STAFF_TOPBAR_NAME_ELLIPSIS,
): string {
  if (maxWidthPx <= 0) return '';
  if (measure(text) <= maxWidthPx) return text;
  if (measure(ellipsis) > maxWidthPx) return '';

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid) + ellipsis) <= maxWidthPx) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo === 0 ? ellipsis : `${text.slice(0, lo)}${ellipsis}`;
}

/**
 * Fit a restaurant name into `maxWidthPx` using the measure callback (same font as UI).
 */
export function fitStaffTopBarRestaurantName(
  name: string,
  maxWidthPx: number,
  measure: StaffTopBarRestaurantNameMeasure,
): StaffTopBarRestaurantNameFit {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return { display: '', mode: 'full', keptWordCount: 0 };
  }
  if (maxWidthPx <= 0) {
    return { display: '', mode: 'ellipsis', keptWordCount: 0 };
  }
  if (measure(trimmed) <= maxWidthPx) {
    return {
      display: trimmed,
      mode: 'full',
      keptWordCount: trimmed.split(' ').length,
    };
  }

  const words = trimmed.split(' ');
  let kept = words;
  while (kept.length > 1) {
    kept = kept.slice(0, -1);
    const candidate = kept.join(' ');
    if (measure(candidate) <= maxWidthPx) {
      return {
        display: candidate,
        mode: 'drop-words',
        keptWordCount: kept.length,
      };
    }
  }

  const sole = kept[0] ?? '';
  const display = ellipsizeToWidth(sole, maxWidthPx, measure);
  return {
    display,
    mode: 'ellipsis',
    keptWordCount: sole ? 1 : 0,
  };
}
