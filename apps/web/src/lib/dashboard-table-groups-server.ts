import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isValidTableGroupName,
  normalizeTableGroupName,
  sortTableGroups,
  TABLE_GROUP_REMARKS_MAX_LEN,
  type RestaurantTableGroup,
  type RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import type { MutationError } from '@/lib/dashboard-api-shared';
import { uniqueViolation } from '@/lib/dashboard-api-shared';

export type TableGroupsPayload = {
  groups: RestaurantTableGroup[];
  members: RestaurantTableGroupMember[];
};

export async function loadRestaurantTableGroups(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<TableGroupsPayload | MutationError> {
  const [{ data: groups, error: groupsError }, { data: members, error: membersError }] =
    await Promise.all([
      admin
        .from('restaurant_table_groups')
        .select('id, restaurant_id, name, remarks, sort_order, created_at')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      admin
        .from('restaurant_table_group_members')
        .select('group_id, table_id, restaurant_id')
        .eq('restaurant_id', restaurantId),
    ]);

  if (groupsError) {
    return { error: 'table_groups_query_failed', message: groupsError.message, status: 500 };
  }
  if (membersError) {
    return { error: 'table_group_members_query_failed', message: membersError.message, status: 500 };
  }

  return {
    groups: sortTableGroups((groups || []) as RestaurantTableGroup[]),
    members: (members || []) as RestaurantTableGroupMember[],
  };
}

async function validateTableIds(
  admin: SupabaseClient,
  restaurantId: string,
  tableIds: string[],
): Promise<MutationError | null> {
  if (tableIds.length === 0) return null;
  const { data, error } = await admin
    .from('restaurant_tables')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .in('id', tableIds);
  if (error) {
    return { error: 'tables_query_failed', message: error.message, status: 500 };
  }
  if ((data || []).length !== tableIds.length) {
    return { error: 'invalid_table_ids', status: 400 };
  }
  return null;
}

async function replaceTableGroupMembersAdmin(
  admin: SupabaseClient,
  restaurantId: string,
  groupId: string,
  tableIds: string[],
): Promise<MutationError | null> {
  const tableCheck = await validateTableIds(admin, restaurantId, tableIds);
  if (tableCheck) return tableCheck;

  if (tableIds.length > 0) {
    const { error: clearOthersError } = await admin
      .from('restaurant_table_group_members')
      .delete()
      .eq('restaurant_id', restaurantId)
      .in('table_id', tableIds);
    if (clearOthersError) {
      return { error: 'members_update_failed', message: clearOthersError.message, status: 500 };
    }
  }

  const { error: clearGroupError } = await admin
    .from('restaurant_table_group_members')
    .delete()
    .eq('group_id', groupId);
  if (clearGroupError) {
    return { error: 'members_update_failed', message: clearGroupError.message, status: 500 };
  }

  if (tableIds.length === 0) return null;

  const rows = tableIds.map((tableId) => ({
    group_id: groupId,
    table_id: tableId,
    restaurant_id: restaurantId,
  }));
  const { error: insertError } = await admin.from('restaurant_table_group_members').insert(rows);
  if (insertError) {
    return { error: 'members_update_failed', message: insertError.message, status: 500 };
  }
  return null;
}

function parseGroupFields(input: {
  name: string;
  remarks?: string | null;
  table_ids?: string[];
}): { name: string; remarks: string | null; tableIds: string[] } | MutationError {
  const name = normalizeTableGroupName(input.name);
  if (!isValidTableGroupName(name)) {
    return { error: 'invalid_group_name', status: 400 };
  }
  const remarks = input.remarks?.trim().slice(0, TABLE_GROUP_REMARKS_MAX_LEN) || null;
  const tableIds = (input.table_ids || [])
    .map((id) => parseTableIdParam(id))
    .filter((id): id is string => !!id);
  if (input.table_ids && tableIds.length !== input.table_ids.length) {
    return { error: 'invalid_table_ids', status: 400 };
  }
  return { name, remarks, tableIds };
}

export async function createTableGroup(
  admin: SupabaseClient,
  restaurantId: string,
  input: { name: string; remarks?: string | null; table_ids?: string[] },
): Promise<{ payload: TableGroupsPayload } | MutationError> {
  const fields = parseGroupFields(input);
  if ('error' in fields) return fields;

  const existing = await loadRestaurantTableGroups(admin, restaurantId);
  if ('error' in existing) return existing;

  const nextOrder =
    existing.groups.length === 0
      ? 0
      : Math.max(...existing.groups.map((g) => g.sort_order)) + 1;

  const { data, error } = await admin
    .from('restaurant_table_groups')
    .insert({
      restaurant_id: restaurantId,
      name: fields.name,
      remarks: fields.remarks,
      sort_order: nextOrder,
    })
    .select('id, restaurant_id, name, remarks, sort_order, created_at')
    .single();

  if (error) {
    return {
      error: uniqueViolation(error) ? 'duplicate_group_name' : 'insert_failed',
      message: error.message,
      status: uniqueViolation(error) ? 409 : 500,
    };
  }

  const memberError = await replaceTableGroupMembersAdmin(
    admin,
    restaurantId,
    data.id,
    fields.tableIds,
  );
  if (memberError) {
    await admin.from('restaurant_table_groups').delete().eq('id', data.id);
    return memberError;
  }

  const payload = await loadRestaurantTableGroups(admin, restaurantId);
  if ('error' in payload) return payload;
  return { payload };
}

export async function updateTableGroup(
  admin: SupabaseClient,
  restaurantId: string,
  groupId: string,
  input: { name: string; remarks?: string | null; table_ids?: string[] },
): Promise<{ payload: TableGroupsPayload } | MutationError> {
  const id = parseTableIdParam(groupId);
  if (!id) return { error: 'invalid_group_id', status: 400 };

  const fields = parseGroupFields(input);
  if ('error' in fields) return fields;

  const existing = await loadRestaurantTableGroups(admin, restaurantId);
  if ('error' in existing) return existing;
  if (!existing.groups.some((g) => g.id === id)) {
    return { error: 'group_not_found', status: 404 };
  }

  const { error } = await admin
    .from('restaurant_table_groups')
    .update({ name: fields.name, remarks: fields.remarks })
    .eq('id', id)
    .eq('restaurant_id', restaurantId);

  if (error) {
    return {
      error: uniqueViolation(error) ? 'duplicate_group_name' : 'update_failed',
      message: error.message,
      status: uniqueViolation(error) ? 409 : 500,
    };
  }

  const memberError = await replaceTableGroupMembersAdmin(
    admin,
    restaurantId,
    id,
    fields.tableIds,
  );
  if (memberError) return memberError;

  const payload = await loadRestaurantTableGroups(admin, restaurantId);
  if ('error' in payload) return payload;
  return { payload };
}

export async function swapTableGroupOrder(
  admin: SupabaseClient,
  restaurantId: string,
  groupIdA: string,
  groupIdB: string,
): Promise<{ payload: TableGroupsPayload } | MutationError> {
  const idA = parseTableIdParam(groupIdA);
  const idB = parseTableIdParam(groupIdB);
  if (!idA || !idB) return { error: 'invalid_group_id', status: 400 };

  const existing = await loadRestaurantTableGroups(admin, restaurantId);
  if ('error' in existing) return existing;

  const a = existing.groups.find((g) => g.id === idA);
  const b = existing.groups.find((g) => g.id === idB);
  if (!a || !b) return { error: 'group_not_found', status: 404 };

  const { error: e1 } = await admin
    .from('restaurant_table_groups')
    .update({ sort_order: b.sort_order })
    .eq('id', idA)
    .eq('restaurant_id', restaurantId);
  if (e1) return { error: 'update_failed', message: e1.message, status: 500 };

  const { error: e2 } = await admin
    .from('restaurant_table_groups')
    .update({ sort_order: a.sort_order })
    .eq('id', idB)
    .eq('restaurant_id', restaurantId);
  if (e2) return { error: 'update_failed', message: e2.message, status: 500 };

  const payload = await loadRestaurantTableGroups(admin, restaurantId);
  if ('error' in payload) return payload;
  return { payload };
}

export async function deleteTableGroup(
  admin: SupabaseClient,
  restaurantId: string,
  groupId: string,
): Promise<{ payload: TableGroupsPayload } | MutationError> {
  const id = parseTableIdParam(groupId);
  if (!id) return { error: 'invalid_group_id', status: 400 };

  const { error } = await admin
    .from('restaurant_table_groups')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) {
    return { error: 'delete_failed', message: error.message, status: 500 };
  }

  const payload = await loadRestaurantTableGroups(admin, restaurantId);
  if ('error' in payload) return payload;
  return { payload };
}
