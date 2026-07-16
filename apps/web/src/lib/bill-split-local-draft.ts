import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { BillSplit, SplitMode } from '@/types';

const KEY_PREFIX = 'mesa:bill-split-draft:';
const DRAFT_VERSION = 1 as const;

export type BillSplitLocalDraftPerson = {
  id: string;
  name: string;
};

export type BillSplitLocalDraftAmount = {
  name: string;
  amount: number;
};

export type BillSplitLocalDraft = {
  v: typeof DRAFT_VERSION;
  splitMode: SplitMode | null;
  personCount: number;
  splitPeople: BillSplitLocalDraftPerson[];
  customAmounts: BillSplitLocalDraftAmount[];
  byItemAllocations: Record<string, ByItemConsumerRow[]>;
  updatedAt: number;
};

export function billSplitLocalDraftStorageKey(restaurantId: string, sessionId: string): string {
  return `${KEY_PREFIX}${restaurantId}:${sessionId}`;
}

function isSplitMode(value: unknown): value is SplitMode | null {
  return value === null || value === 'even' || value === 'by_item' || value === 'custom';
}

function isConsumerRow(value: unknown): value is ByItemConsumerRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.qtyWhole === 'string' &&
    typeof row.qtyNum === 'string' &&
    typeof row.qtyDen === 'string' &&
    (row.adultQty === undefined || typeof row.adultQty === 'string') &&
    (row.childQty === undefined || typeof row.childQty === 'string')
  );
}

export function parseBillSplitLocalDraft(raw: string): BillSplitLocalDraft | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const draft = parsed as Record<string, unknown>;
    if (draft.v !== DRAFT_VERSION) return null;
    if (!isSplitMode(draft.splitMode)) return null;
    if (typeof draft.personCount !== 'number' || !Number.isFinite(draft.personCount)) return null;
    if (!Array.isArray(draft.splitPeople) || !Array.isArray(draft.customAmounts)) return null;
    if (!draft.byItemAllocations || typeof draft.byItemAllocations !== 'object') return null;
    if (typeof draft.updatedAt !== 'number' || !Number.isFinite(draft.updatedAt)) return null;

    const splitPeople: BillSplitLocalDraftPerson[] = [];
    for (const person of draft.splitPeople) {
      if (!person || typeof person !== 'object') return null;
      const row = person as Record<string, unknown>;
      if (typeof row.id !== 'string' || typeof row.name !== 'string') return null;
      splitPeople.push({ id: row.id, name: row.name });
    }

    const customAmounts: BillSplitLocalDraftAmount[] = [];
    for (const person of draft.customAmounts) {
      if (!person || typeof person !== 'object') return null;
      const row = person as Record<string, unknown>;
      if (typeof row.name !== 'string' || typeof row.amount !== 'number' || !Number.isFinite(row.amount)) {
        return null;
      }
      customAmounts.push({ name: row.name, amount: row.amount });
    }

    const byItemAllocations: Record<string, ByItemConsumerRow[]> = {};
    for (const [key, rows] of Object.entries(draft.byItemAllocations as Record<string, unknown>)) {
      if (!Array.isArray(rows) || !rows.every(isConsumerRow)) return null;
      byItemAllocations[key] = rows;
    }

    const personCount = Math.min(20, Math.max(2, Math.round(draft.personCount)));
    return {
      v: DRAFT_VERSION,
      splitMode: draft.splitMode,
      personCount,
      splitPeople,
      customAmounts,
      byItemAllocations,
      updatedAt: draft.updatedAt,
    };
  } catch {
    return null;
  }
}

export function loadBillSplitLocalDraft(
  restaurantId: string,
  sessionId: string,
): BillSplitLocalDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(billSplitLocalDraftStorageKey(restaurantId, sessionId));
    if (!raw) return null;
    return parseBillSplitLocalDraft(raw);
  } catch {
    return null;
  }
}

export function saveBillSplitLocalDraft(
  restaurantId: string,
  sessionId: string,
  draft: Omit<BillSplitLocalDraft, 'v' | 'updatedAt'>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: BillSplitLocalDraft = {
      v: DRAFT_VERSION,
      ...draft,
      updatedAt: Date.now(),
    };
    localStorage.setItem(billSplitLocalDraftStorageKey(restaurantId, sessionId), JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearBillSplitLocalDraft(restaurantId: string, sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(billSplitLocalDraftStorageKey(restaurantId, sessionId));
  } catch {
    /* ignore */
  }
}

/**
 * Local draft restores only when the page is still in an editable customer draft phase.
 * Requested / paid / submitted / partially collected splits stay server-owned.
 */
export function shouldRestoreBillSplitLocalDraft(params: {
  existingSplit: BillSplit | null;
  submitted: boolean;
  collectedPaymentCount: number;
}): boolean {
  const { existingSplit, submitted, collectedPaymentCount } = params;
  if (submitted) return false;
  if (collectedPaymentCount > 0) return false;
  if (!existingSplit) return true;
  if (existingSplit.status === 'requested' || existingSplit.status === 'paid') return false;
  return true;
}
