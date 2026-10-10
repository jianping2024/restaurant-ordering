import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import { splitDraftPersonCount } from '@/lib/checkout-split-continuation';
import type { BillSplit, SplitMode } from '@/types';

const KEY_PREFIX = 'mesa:bill-split-draft:';
const DRAFT_VERSION = 2 as const;

export type BillSplitLocalDraftPerson = {
  id: string;
  name: string;
};

export type BillSplitLocalDraft = {
  v: typeof DRAFT_VERSION;
  splitMode: SplitMode | null;
  personCount: number;
  splitPeople: BillSplitLocalDraftPerson[];
  byItemAllocations: Record<string, ByItemConsumerRow[]>;
  updatedAt: number;
};

export function billSplitLocalDraftStorageKey(restaurantId: string, sessionId: string): string {
  return `${KEY_PREFIX}${restaurantId}:${sessionId}`;
}

/** Sole in-memory owner id for hydrate/persist — one restaurant + one open session. */
export function billSplitLocalDraftOwnerKey(restaurantId: string, sessionId: string): string {
  return `${restaurantId}:${sessionId}`;
}

/**
 * Persist only after this exact session was hydrated.
 * Prevents writing the previous session's roster into a newly opened session key.
 */
export function mayPersistBillSplitLocalDraft(params: {
  hydratedOwnerKey: string | null;
  restaurantId: string;
  sessionId: string | null;
}): boolean {
  if (!params.sessionId) return false;
  if (!params.hydratedOwnerKey) return false;
  return (
    params.hydratedOwnerKey ===
    billSplitLocalDraftOwnerKey(params.restaurantId, params.sessionId)
  );
}

function isSplitMode(value: unknown): value is SplitMode | null {
  return value === null || value === 'even' || value === 'by_item';
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
    if (!Array.isArray(draft.splitPeople)) return null;
    if (!draft.byItemAllocations || typeof draft.byItemAllocations !== 'object') return null;
    if (typeof draft.updatedAt !== 'number' || !Number.isFinite(draft.updatedAt)) return null;

    const splitPeople: BillSplitLocalDraftPerson[] = [];
    for (const person of draft.splitPeople) {
      if (!person || typeof person !== 'object') return null;
      const row = person as Record<string, unknown>;
      if (typeof row.id !== 'string' || typeof row.name !== 'string') return null;
      splitPeople.push({ id: row.id, name: row.name });
    }

    const byItemAllocations: Record<string, ByItemConsumerRow[]> = {};
    for (const [key, rows] of Object.entries(draft.byItemAllocations as Record<string, unknown>)) {
      if (!Array.isArray(rows) || !rows.every(isConsumerRow)) return null;
      byItemAllocations[key] = rows;
    }

    const personCount =
      draft.splitMode === 'even'
        ? splitDraftPersonCount(draft.personCount)
        : Math.min(20, Math.max(1, Math.round(draft.personCount)));
    return {
      v: DRAFT_VERSION,
      splitMode: draft.splitMode,
      personCount,
      splitPeople,
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
 * Requested / paid / partially collected splits stay server-owned.
 */
export function shouldRestoreBillSplitLocalDraft(params: {
  existingSplit: BillSplit | null;
  collectedPaymentCount: number;
}): boolean {
  const { existingSplit, collectedPaymentCount } = params;
  if (collectedPaymentCount > 0) return false;
  if (!existingSplit) return true;
  if (existingSplit.status === 'requested' || existingSplit.status === 'paid') return false;
  return true;
}

/**
 * Sole fingerprint of server-owned bill-split truth that guest/staff draft memory
 * must match. When this key changes, hydrate must re-seed (never keep a stale
 * whole-table / null-mode draft over a continuation plan).
 */
export function billSplitDraftAuthorityKey(params: {
  existingSplit: BillSplit | null;
  collectedPaymentCount: number;
}): string {
  const { existingSplit, collectedPaymentCount } = params;
  if (!existingSplit) {
    return `none|pay:${collectedPaymentCount}`;
  }
  const resultSig = (existingSplit.result ?? [])
    .map((row) =>
      [
        row.party_id ?? '',
        row.name.trim().toLowerCase(),
        Number(row.amount) || 0,
        row.paid ? 1 : 0,
      ].join(':'),
    )
    .join(',');
  const personsSig = (existingSplit.persons ?? [])
    .map((person) => {
      const shares = (person.item_shares ?? [])
        .map(
          (share) =>
            `${share.key}:${share.qty_num}/${share.qty_den}:${share.qty_unit_den ?? ''}:${share.guest_type ?? ''}:${share.locked_amount ?? ''}`,
        )
        .join(';');
      return `${person.party_id ?? ''}:${person.name.trim().toLowerCase()}:${shares}`;
    })
    .join(',');
  return [
    existingSplit.id,
    existingSplit.status,
    existingSplit.split_mode,
    `pay:${collectedPaymentCount}`,
    `r:${resultSig}`,
    `p:${personsSig}`,
  ].join('|');
}

export type BillSplitDraftHydrateAction =
  | 'reset_no_session'
  | 'noop'
  | 'apply_server'
  | 'apply_local_or_server';

/**
 * Sole hydrate decision for bill-split draft memory.
 * `noop` = memory already aligned to this authority key (keep in-progress edits).
 * Authority change → reseed from server (or local only while canRestore).
 */
export function resolveBillSplitDraftHydrateAction(params: {
  sessionId: string | null;
  appliedAuthorityKey: string | null;
  authorityKey: string;
  canRestore: boolean;
}): BillSplitDraftHydrateAction {
  if (!params.sessionId) return 'reset_no_session';
  if (params.appliedAuthorityKey === params.authorityKey) return 'noop';
  if (!params.canRestore) return 'apply_server';
  return 'apply_local_or_server';
}

/** True when server persons already carry by-item shares (continuation / paid floors). */
export function billSplitHasServerItemShares(
  existingSplit: BillSplit | null | undefined,
): boolean {
  return Boolean(
    existingSplit?.persons?.some((person) => (person.item_shares?.length ?? 0) > 0),
  );
}

/**
 * Sole by-item *localStorage* draft apply decision (guest restore path).
 * Non-restorable / no local by_item draft → leave staff reconcile alone (never clear
 * via setByItemAllocations here). Staff unpaid vs server plan is sole
 * `useByItemSplitState` + `authorityKey` wipe — not this helper.
 */
export type ByItemLocalDraftApplyAction = 'leave_reconcile' | 'apply_local';

export function resolveByItemLocalDraftApplyAction(params: {
  canRestore: boolean;
  hasServerItemShares: boolean;
  hasByItemLocalDraft: boolean;
}): ByItemLocalDraftApplyAction {
  if (!params.canRestore || !params.hasByItemLocalDraft) return 'leave_reconcile';
  if (params.hasServerItemShares) return 'leave_reconcile';
  return 'apply_local';
}
