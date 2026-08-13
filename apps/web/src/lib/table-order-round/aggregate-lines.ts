import { clampAppendCartNote } from '@/types';

export type RoundLineAppendInput = {
  menu_item_id: string;
  qty: number;
  note?: string | null;
};

export type RoundLineAppendItem = {
  menu_item_id: string;
  qty: number;
  note: string;
};

/** Sole kitchen merge for a round: one append row per (menu_item_id, note). */
export function aggregateRoundLinesForAppend(
  lines: RoundLineAppendInput[],
): RoundLineAppendItem[] {
  const order: string[] = [];
  const merged = new Map<string, RoundLineAppendItem>();
  for (const line of lines) {
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) continue;
    const menu_item_id = line.menu_item_id;
    if (!menu_item_id) continue;
    const note = clampAppendCartNote((line.note ?? '').trim());
    const key = `${menu_item_id}\0${note}`;
    const existing = merged.get(key);
    if (existing) {
      existing.qty += qty;
      continue;
    }
    merged.set(key, { menu_item_id, qty, note });
    order.push(key);
  }
  return order.map((key) => merged.get(key)!);
}
