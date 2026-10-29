/**
 * Server loaders for in-store takeaway — channel resolve stays in instore-takeaway.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isRestaurantFeatureEnabled } from '@mesa/shared';
import {
  resolveTableOrderingChannel,
  type OrderingChannel,
} from '@/lib/instore-takeaway';

export async function loadTakeawayOrderingEnabled(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('restaurants')
    .select('feature_flags')
    .eq('id', restaurantId)
    .maybeSingle();
  if (error || !data) return false;
  return isRestaurantFeatureEnabled(data.feature_flags, 'takeaway_ordering');
}

export async function loadTableInTakeawayGroup(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<boolean> {
  const { data: member, error: memberError } = await admin
    .from('restaurant_table_group_members')
    .select('group_id')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .maybeSingle();
  if (memberError || !member?.group_id) return false;

  const { data: group, error: groupError } = await admin
    .from('restaurant_table_groups')
    .select('is_takeaway')
    .eq('id', member.group_id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (groupError || !group) return false;
  return group.is_takeaway === true;
}

/** Sole server entry that loads flag+group then calls resolveTableOrderingChannel. */
export async function resolveOrderingChannelForTable(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    tableId: string;
    sessionChannel?: OrderingChannel | string | null;
  },
): Promise<OrderingChannel> {
  if (params.sessionChannel != null && String(params.sessionChannel).length > 0) {
    return resolveTableOrderingChannel({
      takeawayOrderingEnabled: false,
      tableInTakeawayGroup: false,
      sessionChannel: params.sessionChannel,
    });
  }
  const [takeawayOrderingEnabled, tableInTakeawayGroup] = await Promise.all([
    loadTakeawayOrderingEnabled(admin, params.restaurantId),
    loadTableInTakeawayGroup(admin, params.restaurantId, params.tableId),
  ]);
  return resolveTableOrderingChannel({
    takeawayOrderingEnabled,
    tableInTakeawayGroup,
    sessionChannel: null,
  });
}

export type DisableTakeawayOrderingResult =
  | { ok: true }
  | { ok: false; error: 'takeaway_group_has_open_sessions' };

/** Block turning takeaway_ordering off while takeaway-group tables still have open/billing sessions. */
export async function assertCanDisableTakeawayOrdering(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<DisableTakeawayOrderingResult> {
  const { data: groups, error: groupsError } = await admin
    .from('restaurant_table_groups')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('is_takeaway', true);
  if (groupsError) {
    return { ok: false, error: 'takeaway_group_has_open_sessions' };
  }
  const groupIds = (groups || []).map((g) => g.id as string);
  if (groupIds.length === 0) return { ok: true };

  const { data: members, error: membersError } = await admin
    .from('restaurant_table_group_members')
    .select('table_id')
    .eq('restaurant_id', restaurantId)
    .in('group_id', groupIds);
  if (membersError) {
    return { ok: false, error: 'takeaway_group_has_open_sessions' };
  }
  const tableIds = Array.from(
    new Set((members || []).map((m) => m.table_id as string).filter(Boolean)),
  );
  if (tableIds.length === 0) return { ok: true };

  const { data: sessions, error: sessionsError } = await admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .in('table_id', tableIds)
    .in('status', ['open', 'billing'])
    .limit(1);
  if (sessionsError) {
    return { ok: false, error: 'takeaway_group_has_open_sessions' };
  }
  if ((sessions || []).length > 0) {
    return { ok: false, error: 'takeaway_group_has_open_sessions' };
  }
  return { ok: true };
}
