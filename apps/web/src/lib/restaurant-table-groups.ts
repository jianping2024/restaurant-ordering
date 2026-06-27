import { isWaiterTableCardOccupied } from '@/lib/waiter-table-occupancy';
import {
  compareRestaurantTables,
  sortRestaurantTables,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';
import { isTableCheckoutRequested } from '@/lib/table-checkout-pending';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';

export const TABLE_GROUP_NAME_MAX_LEN = 32;
export const TABLE_GROUP_REMARKS_MAX_LEN = 200;

export const RESERVED_TABLE_GROUP_NAMES = new Set(
  [
    '未分组',
    '其他桌位',
    'ungrouped',
    'other tables',
    'sem grupo',
    'outras mesas',
  ].map((s) => s.toLowerCase()),
);

export type RestaurantTableGroup = {
  id: string;
  restaurant_id: string;
  name: string;
  remarks: string | null;
  sort_order: number;
  created_at: string;
};

export type RestaurantTableGroupMember = {
  group_id: string;
  table_id: string;
  restaurant_id: string;
};

export type TableGroupAssignment = {
  groupId: string;
  groupName: string;
};

export type WaiterTableCardSortInput = {
  tableId: string;
  displayName: string;
  orderLines: unknown[];
  hasBuffet: boolean;
};

export type WaiterBoardSection = {
  id: string;
  title: string;
  tableIds: string[];
};

export function normalizeTableGroupName(raw: string): string {
  return raw.trim();
}

export function isValidTableGroupName(value: string): boolean {
  const name = normalizeTableGroupName(value);
  return (
    name.length >= 1
    && name.length <= TABLE_GROUP_NAME_MAX_LEN
    && !RESERVED_TABLE_GROUP_NAMES.has(name.toLowerCase())
  );
}

export function compareTableGroups(
  a: Pick<RestaurantTableGroup, 'sort_order' | 'created_at'>,
  b: Pick<RestaurantTableGroup, 'sort_order' | 'created_at'>,
): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.created_at.localeCompare(b.created_at);
}

export function sortTableGroups<T extends RestaurantTableGroup>(rows: T[]): T[] {
  return [...rows].sort(compareTableGroups);
}

export function buildTableGroupNameByTableId(
  groups: RestaurantTableGroup[],
  members: RestaurantTableGroupMember[],
): Record<string, string> {
  const nameByGroupId = new Map(groups.map((g) => [g.id, g.name]));
  const out: Record<string, string> = {};
  for (const member of members) {
    const name = nameByGroupId.get(member.group_id);
    if (name) out[member.table_id] = name;
  }
  return out;
}

export function buildTableGroupIdByTableId(
  members: RestaurantTableGroupMember[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const member of members) {
    out[member.table_id] = member.group_id;
  }
  return out;
}

/** Assign-picker order: ungrouped → current group → other groups (by group name, then table sort). */
export function sortTablesForGroupAssignPicker(
  tables: RestaurantTableRow[],
  groups: RestaurantTableGroup[],
  members: RestaurantTableGroupMember[],
  editingGroupId: string | null,
): RestaurantTableRow[] {
  const groupIdByTable = buildTableGroupIdByTableId(members);
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  const bucket = (tableId: string): number => {
    const gid = groupIdByTable[tableId];
    if (!gid) return 0;
    if (editingGroupId && gid === editingGroupId) return 1;
    return 2;
  };

  return [...tables].sort((a, b) => {
    const ba = bucket(a.id);
    const bb = bucket(b.id);
    if (ba !== bb) return ba - bb;
    if (ba === 2) {
      const ga = groupNameById.get(groupIdByTable[a.id]!) ?? '';
      const gb = groupNameById.get(groupIdByTable[b.id]!) ?? '';
      const nameCmp = ga.localeCompare(gb, undefined, { sensitivity: 'base' });
      if (nameCmp !== 0) return nameCmp;
    }
    return compareRestaurantTables(a, b);
  });
}

export function groupTableIdsByGroupId(
  members: RestaurantTableGroupMember[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const member of members) {
    if (!out[member.group_id]) out[member.group_id] = [];
    out[member.group_id].push(member.table_id);
  }
  return out;
}

export function isWaiterTableCheckoutPending(
  tableId: string,
  checkoutRequestedTableIds: readonly string[],
  session: WaiterTableSessionMeta | undefined,
): boolean {
  return (
    isTableCheckoutRequested(tableId, checkoutRequestedTableIds) || session?.status === 'billing'
  );
}

export function sortWaiterTableCards<T extends WaiterTableCardSortInput>(
  cards: T[],
  tables: RestaurantTableRow[],
  checkoutRequestedTableIds: readonly string[],
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
): T[] {
  const tableById = new Map(tables.map((t) => [t.id, t]));
  return [...cards].sort((a, b) => {
    const aCheckout = isWaiterTableCheckoutPending(
      a.tableId,
      checkoutRequestedTableIds,
      sessionMetaByTableId[a.tableId],
    )
      ? 1
      : 0;
    const bCheckout = isWaiterTableCheckoutPending(
      b.tableId,
      checkoutRequestedTableIds,
      sessionMetaByTableId[b.tableId],
    )
      ? 1
      : 0;
    if (aCheckout !== bCheckout) return bCheckout - aCheckout;

    const aActive = isWaiterTableCardOccupied(a) ? 1 : 0;
    const bActive = isWaiterTableCardOccupied(b) ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    const ta = tableById.get(a.tableId);
    const tb = tableById.get(b.tableId);
    if (ta && tb) return compareRestaurantTables(ta, tb);
    return a.displayName.localeCompare(b.displayName, undefined, { numeric: true });
  });
}

export function buildWaiterBoardSections(
  groups: RestaurantTableGroup[],
  members: RestaurantTableGroupMember[],
  tables: RestaurantTableRow[],
  ungroupedLabel: string,
): WaiterBoardSection[] {
  const tableIds = new Set(tables.map((t) => t.id));
  const assigned = new Set<string>();
  const tableIdsByGroup = groupTableIdsByGroupId(members);
  const sections: WaiterBoardSection[] = [];

  for (const group of sortTableGroups(groups)) {
    const ids = (tableIdsByGroup[group.id] || []).filter((id) => tableIds.has(id));
    if (ids.length === 0) continue;
    ids.forEach((id) => assigned.add(id));
    sections.push({
      id: group.id,
      title: group.name,
      tableIds: sortRestaurantTableIds(ids, tables),
    });
  }

  const ungrouped = tables.map((t) => t.id).filter((id) => !assigned.has(id));
  if (ungrouped.length > 0) {
    sections.push({
      id: '__ungrouped__',
      title: ungroupedLabel,
      tableIds: ungrouped,
    });
  }

  return sections;
}

function sortRestaurantTableIds(tableIds: string[], tables: RestaurantTableRow[]): string[] {
  const order = new Map(sortRestaurantTables(tables).map((t, index) => [t.id, index]));
  return [...tableIds].sort((a, b) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999));
}

export function sortTablesForGroupPrint(
  tables: RestaurantTableRow[],
  groups: RestaurantTableGroup[],
  members: RestaurantTableGroupMember[],
): RestaurantTableRow[] {
  const sections = buildWaiterBoardSections(groups, members, tables, '');
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const out: RestaurantTableRow[] = [];
  for (const section of sections) {
    for (const id of section.tableIds) {
      const row = tableById.get(id);
      if (row) out.push(row);
    }
  }
  return out;
}
