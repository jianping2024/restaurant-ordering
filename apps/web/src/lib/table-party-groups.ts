import { tableIdsEqual } from '@/lib/restaurant-tables';
import {
  classifyWaiterTableBoardState,
  type WaiterBoardStateContext,
} from '@/lib/waiter-board-session';

export type TablePartyGroup = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type TablePartyGroupMember = {
  party_id: string;
  table_id: string;
  restaurant_id: string;
};

export function sortTablePartyGroups(groups: TablePartyGroup[]): TablePartyGroup[] {
  return [...groups].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Next sort_order so a new party appears above existing ones (ascending sort). */
export function nextPrependSortOrder(
  groups: readonly Pick<TablePartyGroup, 'sort_order'>[],
): number {
  if (groups.length === 0) return 0;
  return groups.reduce((min, p) => Math.min(min, p.sort_order), groups[0]!.sort_order) - 1;
}

export function tablePartyMemberTableIds(
  members: readonly TablePartyGroupMember[],
): Set<string> {
  return new Set(members.map((m) => m.table_id.toLowerCase()));
}

export function partyIdForTable(
  members: readonly TablePartyGroupMember[],
  tableId: string,
): string | null {
  const row = members.find((m) => tableIdsEqual(m.table_id, tableId));
  return row?.party_id ?? null;
}

export function membersForParty(
  members: readonly TablePartyGroupMember[],
  partyId: string,
): TablePartyGroupMember[] {
  return members.filter((m) => m.party_id === partyId);
}

/** Case-insensitive trimmed key for party display-name uniqueness. */
export function partyNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** True when another party already uses this name (case-insensitive). */
export function partyHasNameConflict(
  parties: readonly Pick<TablePartyGroup, 'id' | 'name'>[],
  name: string,
  excludePartyId?: string,
): boolean {
  const key = partyNameKey(name);
  if (!key) return false;
  return parties.some(
    (p) =>
      (!excludePartyId || p.id !== excludePartyId) && partyNameKey(p.name) === key,
  );
}

/** Fallback when the actor has no staff login_name (e.g. restaurant owner). */
export const PARTY_DEFAULT_LOGIN_FALLBACK = 'owner';

const PARTY_NAME_MAX_LEN = 32;
/** `-together-` plus up to 5 digits for N ≤ 10000. */
const PARTY_DEFAULT_SUFFIX_BUDGET = '-together-'.length + 5;

/**
 * Sanitize login for default party names and truncate so
 * `{prefix}-together-{N}` always fits in 32 characters.
 */
export function partyDefaultNameLoginPrefix(loginName: string): string {
  const cleaned = loginName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  const base = cleaned.length > 0 ? cleaned : PARTY_DEFAULT_LOGIN_FALLBACK;
  const maxPrefix = Math.max(1, PARTY_NAME_MAX_LEN - PARTY_DEFAULT_SUFFIX_BUDGET);
  return base.slice(0, maxPrefix);
}

/**
 * Next free default label `{login}-together-{N}` among existing names
 * (case-insensitive). Scoped per login prefix so concurrent creators rarely collide.
 */
export function nextAvailableTablePartyName(
  loginName: string,
  existingNames: readonly string[],
): string {
  const prefix = partyDefaultNameLoginPrefix(loginName);
  const taken = new Set(existingNames.map(partyNameKey));
  for (let n = 1; n <= 10_000; n += 1) {
    const candidate = `${prefix}-together-${n}`;
    if (candidate.length > PARTY_NAME_MAX_LEN) break;
    if (!taken.has(partyNameKey(candidate))) return candidate;
  }
  const fallback = `${prefix}-together-${Date.now()}`.slice(0, PARTY_NAME_MAX_LEN);
  return fallback.length >= 1 ? fallback : PARTY_DEFAULT_LOGIN_FALLBACK;
}

/** Tables already in another party (not `targetPartyId`). */
export function conflictingPartyMembers(
  members: readonly TablePartyGroupMember[],
  tableIds: readonly string[],
  targetPartyId: string,
): TablePartyGroupMember[] {
  return members.filter(
    (m) =>
      tableIds.some((id) => tableIdsEqual(id, m.table_id)) && m.party_id !== targetPartyId,
  );
}

export function countCheckoutTablesInParties(
  partyMemberIds: ReadonlySet<string>,
  checkoutTableIds: readonly string[],
): number {
  return checkoutTableIds.filter((id) => partyMemberIds.has(id.toLowerCase())).length;
}

/**
 * Checkout gate for together-groups: not in a party (0) or sole remaining
 * member (1) may call for the bill; two or more members must merge first.
 */
export function isPartyMemberCountAllowedForCheckout(partyMemberCount: number): boolean {
  return partyMemberCount <= 1;
}

/**
 * Candidate tables for "add to party": dining (open session) only; exclude current party members.
 * Idle / checkout are filtered out — open a table first.
 */
export function filterTablesEligibleForPartyAdd<T extends { id: string }>(
  tables: readonly T[],
  partyMembers: readonly TablePartyGroupMember[],
  targetPartyId: string,
  boardStateContext: WaiterBoardStateContext,
): T[] {
  return tables.filter(
    (table) =>
      partyIdForTable(partyMembers, table.id) !== targetPartyId &&
      classifyWaiterTableBoardState(table.id, boardStateContext) === 'dining',
  );
}

/** True when board state is dining (open session, not checkout pending). */
export function isTableEligibleForPartyAdd(
  tableId: string,
  boardStateContext: WaiterBoardStateContext,
): boolean {
  return classifyWaiterTableBoardState(tableId, boardStateContext) === 'dining';
}
