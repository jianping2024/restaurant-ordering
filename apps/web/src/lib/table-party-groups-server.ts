import type { SupabaseClient } from '@supabase/supabase-js';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { fetchCheckoutRequestedTableIds } from '@/lib/table-checkout-pending';
import {
  conflictingPartyMembers,
  defaultTablePartyName,
  isTableEligibleForPartyAdd,
  nextPrependSortOrder,
  sortTablePartyGroups,
  type TablePartyGroup,
  type TablePartyGroupMember,
} from '@/lib/table-party-groups';
import {
  buildWaiterBoardStateContext,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';

export async function loadTablePartyGroups(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ parties: TablePartyGroup[]; partyMembers: TablePartyGroupMember[] }> {
  const [{ data: partyRows }, { data: memberRows }] = await Promise.all([
    admin
      .from('table_party_groups')
      .select('id, restaurant_id, name, sort_order, created_at')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    admin
      .from('table_party_group_members')
      .select('party_id, table_id, restaurant_id')
      .eq('restaurant_id', restaurantId),
  ]);

  return {
    parties: sortTablePartyGroups((partyRows || []) as TablePartyGroup[]),
    partyMembers: (memberRows || []) as TablePartyGroupMember[],
  };
}

function normalizePartyName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length < 1 || name.length > 32) return null;
  return name;
}

function parseTableIdList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids: string[] = [];
  for (const item of raw) {
    const id = parseTableIdParam(item);
    if (!id) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export type TablePartyMutationResult =
  | { ok: true; parties: TablePartyGroup[]; partyMembers: TablePartyGroupMember[] }
  | { ok: false; status: number; error: string; conflicts?: TablePartyGroupMember[] };

async function reloadResult(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<Extract<TablePartyMutationResult, { ok: true }>> {
  const loaded = await loadTablePartyGroups(admin, restaurantId);
  return { ok: true, ...loaded };
}

export async function createTablePartyGroup(
  admin: SupabaseClient,
  restaurantId: string,
  nameInput?: unknown,
): Promise<TablePartyMutationResult> {
  const existing = await loadTablePartyGroups(admin, restaurantId);
  const name = normalizePartyName(nameInput) ?? defaultTablePartyName(existing.parties.length);
  const sortOrder = nextPrependSortOrder(existing.parties);

  const { error } = await admin.from('table_party_groups').insert({
    restaurant_id: restaurantId,
    name,
    sort_order: sortOrder,
  });
  if (error) {
    return { ok: false, status: 400, error: error.message };
  }
  return reloadResult(admin, restaurantId);
}

export async function dissolveTablePartyGroup(
  admin: SupabaseClient,
  restaurantId: string,
  partyIdRaw: unknown,
): Promise<TablePartyMutationResult> {
  const partyId = parseTableIdParam(partyIdRaw);
  if (!partyId) return { ok: false, status: 400, error: 'invalid_party_id' };

  const { data: party, error: findError } = await admin
    .from('table_party_groups')
    .select('id')
    .eq('id', partyId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (findError) return { ok: false, status: 400, error: findError.message };
  if (!party) return { ok: false, status: 404, error: 'party_not_found' };

  const { error } = await admin
    .from('table_party_groups')
    .delete()
    .eq('id', partyId)
    .eq('restaurant_id', restaurantId);
  if (error) return { ok: false, status: 400, error: error.message };
  return reloadResult(admin, restaurantId);
}

export async function removeTableFromParty(
  admin: SupabaseClient,
  restaurantId: string,
  partyIdRaw: unknown,
  tableIdRaw: unknown,
): Promise<TablePartyMutationResult> {
  const partyId = parseTableIdParam(partyIdRaw);
  const tableId = parseTableIdParam(tableIdRaw);
  if (!partyId || !tableId) {
    return { ok: false, status: 400, error: 'invalid_ids' };
  }

  const { error } = await admin
    .from('table_party_group_members')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('party_id', partyId)
    .eq('table_id', tableId);
  if (error) return { ok: false, status: 400, error: error.message };
  return reloadResult(admin, restaurantId);
}

/** True when the table is a member of any together-group in this restaurant. */
export async function tableIsInAnyParty(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('table_party_group_members')
    .select('table_id')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .maybeSingle();
  if (error) {
    console.error('[tableIsInAnyParty]', {
      restaurantId,
      tableId,
      message: error.message,
    });
    throw new Error(error.message);
  }
  return Boolean(data);
}

/**
 * After 关台: drop the table from any together-group.
 * Best-effort — must not fail the close path. Empty parties are left intact.
 */
export async function purgeTablePartyMembership(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<void> {
  try {
    const { error } = await admin
      .from('table_party_group_members')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('table_id', tableId);
    if (error) {
      console.error('[purgeTablePartyMembership]', {
        restaurantId,
        tableId,
        message: error.message,
      });
    }
  } catch (err) {
    console.error('[purgeTablePartyMembership]', {
      restaurantId,
      tableId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Add tables to a party. Tables already in another party require confirm_move=true.
 * Only dining (open session, not checkout) tables may join.
 */
export async function addTablesToParty(
  admin: SupabaseClient,
  restaurantId: string,
  partyIdRaw: unknown,
  tableIdsRaw: unknown,
  confirmMove: boolean,
): Promise<TablePartyMutationResult> {
  const partyId = parseTableIdParam(partyIdRaw);
  const tableIds = parseTableIdList(tableIdsRaw);
  if (!partyId || !tableIds || tableIds.length === 0) {
    return { ok: false, status: 400, error: 'invalid_ids' };
  }

  const { data: party, error: findError } = await admin
    .from('table_party_groups')
    .select('id')
    .eq('id', partyId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (findError) return { ok: false, status: 400, error: findError.message };
  if (!party) return { ok: false, status: 404, error: 'party_not_found' };

  const { data: tableRows, error: tablesError } = await admin
    .from('restaurant_tables')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .in('id', tableIds);
  if (tablesError) return { ok: false, status: 400, error: tablesError.message };
  if ((tableRows || []).length !== tableIds.length) {
    return { ok: false, status: 400, error: 'invalid_table_ids' };
  }

  const [{ data: sessionRows, error: sessionsError }, checkoutRequestedTableIds] =
    await Promise.all([
      admin
        .from('table_sessions')
        .select('id, table_id, status, opened_at')
        .eq('restaurant_id', restaurantId)
        .in('table_id', tableIds)
        .in('status', ['open', 'billing']),
      fetchCheckoutRequestedTableIds(admin, restaurantId),
    ]);
  if (sessionsError) return { ok: false, status: 400, error: sessionsError.message };

  const sessionMetaByTableId: Record<string, WaiterTableSessionMeta> = {};
  for (const row of sessionRows || []) {
    const tableId = typeof row.table_id === 'string' ? row.table_id : null;
    const status = row.status === 'open' || row.status === 'billing' ? row.status : null;
    const openedAt = typeof row.opened_at === 'string' ? row.opened_at : null;
    const sessionId = typeof row.id === 'string' ? row.id : null;
    if (!tableId || !status || !openedAt || !sessionId) continue;
    sessionMetaByTableId[tableId] = { sessionId, openedAt, status };
  }
  const boardStateContext = buildWaiterBoardStateContext(
    sessionMetaByTableId,
    checkoutRequestedTableIds,
    tableIds.map((tableId) => ({ tableId, occupied: Boolean(sessionMetaByTableId[tableId]) })),
  );
  if (tableIds.some((id) => !isTableEligibleForPartyAdd(id, boardStateContext))) {
    return { ok: false, status: 400, error: 'tables_not_dining' };
  }

  const loaded = await loadTablePartyGroups(admin, restaurantId);
  const conflicts = conflictingPartyMembers(loaded.partyMembers, tableIds, partyId);
  if (conflicts.length > 0 && !confirmMove) {
    return {
      ok: false,
      status: 409,
      error: 'tables_in_other_party',
      conflicts,
    };
  }

  if (conflicts.length > 0) {
    const { error: clearError } = await admin
      .from('table_party_group_members')
      .delete()
      .eq('restaurant_id', restaurantId)
      .in(
        'table_id',
        conflicts.map((c) => c.table_id),
      );
    if (clearError) return { ok: false, status: 400, error: clearError.message };
  }

  const alreadyInParty = new Set(
    loaded.partyMembers.filter((m) => m.party_id === partyId).map((m) => m.table_id),
  );
  const toInsert = tableIds.filter((id) => !alreadyInParty.has(id));
  if (toInsert.length > 0) {
    const { error: insertError } = await admin.from('table_party_group_members').insert(
      toInsert.map((table_id) => ({
        party_id: partyId,
        table_id,
        restaurant_id: restaurantId,
      })),
    );
    if (insertError) return { ok: false, status: 400, error: insertError.message };
  }

  return reloadResult(admin, restaurantId);
}
