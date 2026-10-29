import {
  compareRestaurantTables,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';
import { isWaiterTableInCheckout, type WaiterTableSessionMeta } from '@/lib/waiter-board-session';

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
  /** When true and takeaway_ordering is on, desks in this group are takeaway. */
  is_takeaway: boolean;
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
  return [...rows].sort((a, b) => compareTableGroups(a, b));
}

/**
 * Sole set of takeaway desk table ids for floor open/detail UI.
 * Empty when takeaway_ordering is off or no is_takeaway group.
 */
export function buildTakeawayTableIdSet(
  takeawayOrderingEnabled: boolean,
  groups: readonly Pick<RestaurantTableGroup, 'id' | 'is_takeaway'>[],
  members: readonly Pick<RestaurantTableGroupMember, 'group_id' | 'table_id'>[],
): Set<string> {
  if (!takeawayOrderingEnabled) return new Set();
  const takeawayGroupIds = new Set(
    groups.filter((g) => g.is_takeaway === true).map((g) => g.id),
  );
  if (takeawayGroupIds.size === 0) return new Set();
  const ids = new Set<string>();
  for (const m of members) {
    if (takeawayGroupIds.has(m.group_id)) ids.add(m.table_id);
  }
  return ids;
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

/** Order member table ids by restaurant_tables.sort_order (then display_name). */
function sortedGroupMemberTableRows<
  T extends Pick<RestaurantTableRow, 'id' | 'sort_order' | 'display_name'>,
>(tableIds: string[], tables: readonly T[]): T[] {
  const tableById = new Map(tables.map((t) => [t.id, t]));
  return tableIds
    .map((id) => tableById.get(id))
    .filter((row): row is T => !!row)
    .sort(compareRestaurantTables);
}

export function sortTableIdsByRestaurantTableOrder(
  tableIds: string[],
  tables: readonly Pick<RestaurantTableRow, 'id' | 'sort_order' | 'display_name'>[],
): string[] {
  return sortedGroupMemberTableRows(tableIds, tables).map((row) => row.id);
}

/** Group members as table rows in restaurant_tables.sort_order. */
export function listGroupMemberTablesInOrder(
  tableIds: string[],
  tables: readonly RestaurantTableRow[],
): RestaurantTableRow[] {
  return sortedGroupMemberTableRows(tableIds, tables);
}

export type GroupMemberTablePreview = {
  chips: { id: string; display_name: string }[];
  totalCount: number;
};

/** List summary: all member display names in restaurant_tables.sort_order. */
export function formatGroupMemberTablePreview(
  tableIds: string[],
  tables: readonly Pick<RestaurantTableRow, 'id' | 'sort_order' | 'display_name'>[],
): GroupMemberTablePreview {
  const rows = sortedGroupMemberTableRows(tableIds, tables);
  return {
    chips: rows.map((row) => ({
      id: row.id,
      display_name: row.display_name,
    })),
    totalCount: rows.length,
  };
}

/**
 * Board card order: checkout-pending first, then stable floor layout
 * (`restaurant_tables.sort_order` / display_name). Occupancy does not reorder.
 */
export function sortWaiterTableCards<T extends WaiterTableCardSortInput>(
  cards: T[],
  tables: readonly RestaurantTableRow[],
  checkoutRequestedTableIds: readonly string[],
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
): T[] {
  const tableById = new Map(tables.map((t) => [t.id, t]));
  return [...cards].sort((a, b) => {
    const aCheckout = isWaiterTableInCheckout(
      a.tableId,
      sessionMetaByTableId,
      checkoutRequestedTableIds,
    )
      ? 1
      : 0;
    const bCheckout = isWaiterTableInCheckout(
      b.tableId,
      sessionMetaByTableId,
      checkoutRequestedTableIds,
    )
      ? 1
      : 0;
    if (aCheckout !== bCheckout) return bCheckout - aCheckout;

    const ta = tableById.get(a.tableId);
    const tb = tableById.get(b.tableId);
    if (ta && tb) return compareRestaurantTables(ta, tb);
    return a.displayName.localeCompare(b.displayName, undefined, { numeric: true });
  });
}

/**
 * Floor lane tabs (before 同行组). When `pinTakeawayBeforeParty`, the takeaway
 * group is the last floor section so it sits immediately left of 同行组 —
 * not leftmost among VIP/大厅 groups.
 */
export function buildWaiterBoardSections(
  groups: RestaurantTableGroup[],
  members: RestaurantTableGroupMember[],
  tables: RestaurantTableRow[],
  ungroupedLabel: string,
  options?: { pinTakeawayBeforeParty?: boolean },
): WaiterBoardSection[] {
  const tableIds = new Set(tables.map((t) => t.id));
  const assigned = new Set<string>();
  const tableIdsByGroup = groupTableIdsByGroupId(members);
  const sections: WaiterBoardSection[] = [];
  const pinTakeawayBeforeParty = options?.pinTakeawayBeforeParty === true;
  let takeawaySection: WaiterBoardSection | null = null;

  for (const group of sortTableGroups(groups)) {
    const ids = (tableIdsByGroup[group.id] || []).filter((id) => tableIds.has(id));
    if (ids.length === 0) continue;
    ids.forEach((id) => assigned.add(id));
    const section: WaiterBoardSection = {
      id: group.id,
      title: group.name,
      tableIds: sortTableIdsByRestaurantTableOrder(ids, tables),
    };
    if (pinTakeawayBeforeParty && group.is_takeaway === true) {
      takeawaySection = section;
      continue;
    }
    sections.push(section);
  }

  const ungrouped = tables.map((t) => t.id).filter((id) => !assigned.has(id));
  if (ungrouped.length > 0) {
    sections.push({
      id: '__ungrouped__',
      title: ungroupedLabel,
      tableIds: ungrouped,
    });
  }

  if (takeawaySection) {
    sections.push(takeawaySection);
  }

  return sections;
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
