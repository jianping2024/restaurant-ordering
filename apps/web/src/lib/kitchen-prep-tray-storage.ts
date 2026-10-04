/** Per-station prep tray selection survives a browser refresh (local only; never synced across screens). */
export type PrepTrayStored = { selected: string[]; skipped: string[] };

const STORAGE_PREFIX = 'mesa:kitchen-prep-tray:';

export function loadPrepTrayStored(stationId: string): PrepTrayStored | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + stationId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrepTrayStored>;
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    return { selected: strings(parsed.selected), skipped: strings(parsed.skipped) };
  } catch {
    return null;
  }
}

export function savePrepTrayStored(stationId: string, value: PrepTrayStored): void {
  try {
    if (value.selected.length === 0 && value.skipped.length === 0) {
      window.localStorage.removeItem(STORAGE_PREFIX + stationId);
      return;
    }
    window.localStorage.setItem(STORAGE_PREFIX + stationId, JSON.stringify(value));
  } catch {
    /* private mode / quota — selection just won't persist */
  }
}
