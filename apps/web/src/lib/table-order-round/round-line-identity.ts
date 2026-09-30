import { clampAppendCartNote } from '@/types';

/** Sole round-line identity: same dish + guest + note merges; different notes are separate rows. */
export function normalizeRoundLineNote(note: unknown): string {
  return clampAppendCartNote(typeof note === 'string' ? note.trim() : '');
}

export function roundLineIdentityKey(params: {
  menuItemId: string;
  guestClientId: string;
  note: unknown;
}): string {
  return `${params.menuItemId}\0${params.guestClientId}\0${normalizeRoundLineNote(params.note)}`;
}

export function roundLinesMatchIdentity(
  line: { menu_item_id: string; guest_client_id: string; note?: string | null },
  params: { menuItemId: string; guestClientId: string; note: unknown },
): boolean {
  return (
    roundLineIdentityKey({
      menuItemId: line.menu_item_id,
      guestClientId: line.guest_client_id,
      note: line.note,
    }) === roundLineIdentityKey(params)
  );
}

export type RoundLineQtyMode = 'set' | 'add';

/**
 * Absolute qty to write for an upsert, and which existing sibling lines count toward the round cap.
 * Cap excludes only the identity being written (not all lines for the same dish+guest).
 */
export function resolveRoundLineUpsertPlan(params: {
  existingLines: Array<{
    menu_item_id: string;
    guest_client_id: string;
    note?: string | null;
    qty: number;
  }>;
  menuItemId: string;
  guestClientId: string;
  note: unknown;
  qty: number;
  qtyMode: RoundLineQtyMode;
}): {
  note: string;
  nextQty: number;
  otherQty: number;
  existing: { menu_item_id: string; guest_client_id: string; note?: string | null; qty: number } | null;
} {
  const note = normalizeRoundLineNote(params.note);
  const identity = {
    menuItemId: params.menuItemId,
    guestClientId: params.guestClientId,
    note,
  };
  const existing =
    params.existingLines.find((l) => roundLinesMatchIdentity(l, identity)) ?? null;
  const base = existing ? Math.max(0, Math.floor(Number(existing.qty) || 0)) : 0;
  const request = Math.floor(Number(params.qty));
  const nextQty =
    params.qtyMode === 'add' ? base + request : request;
  let otherQty = 0;
  for (const line of params.existingLines) {
    if (roundLinesMatchIdentity(line, identity)) continue;
    const q = Math.floor(Number(line.qty));
    if (Number.isFinite(q) && q > 0) otherQty += q;
  }
  return { note, nextQty, otherQty, existing };
}
