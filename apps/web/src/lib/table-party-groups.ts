import { tableIdsEqual } from '@/lib/restaurant-tables';

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

export function defaultTablePartyName(existingCount: number): string {
  return `Together ${existingCount + 1}`;
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
