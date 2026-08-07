import type { SupabaseClient } from '@supabase/supabase-js';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const KITCHEN_SCREEN_MAX_STATIONS = 2;

export type KitchenScreenMutationError = {
  error: string;
  message?: string;
  status: number;
};

export type KitchenScreenRow = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  station_ids: string[];
};

type ScreenStationJoin = {
  print_station_id: string;
  sort_order: number;
};

function uniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

async function validateKitchenEnabledStationIds(
  admin: SupabaseClient,
  restaurantId: string,
  stationIds: string[],
): Promise<true | KitchenScreenMutationError> {
  if (stationIds.length === 0) {
    return { error: 'station_ids_required', status: 400 };
  }
  if (stationIds.length > KITCHEN_SCREEN_MAX_STATIONS) {
    return {
      error: 'station_ids_limit',
      message: `At most ${KITCHEN_SCREEN_MAX_STATIONS} stations per screen`,
      status: 400,
    };
  }
  if (new Set(stationIds).size !== stationIds.length) {
    return { error: 'duplicate_station_ids', status: 400 };
  }

  const { data, error } = await admin
    .from('print_stations')
    .select('id, kitchen_enabled')
    .eq('restaurant_id', restaurantId)
    .in('id', stationIds);

  if (error) {
    return { error: 'stations_lookup_failed', message: error.message, status: 500 };
  }

  const byId = new Map(
    (data || []).map((row) => [
      row.id as string,
      Boolean((row as { kitchen_enabled?: boolean }).kitchen_enabled),
    ]),
  );

  for (const id of stationIds) {
    if (!byId.has(id)) {
      return { error: 'station_not_found', status: 400 };
    }
    if (!byId.get(id)) {
      return { error: 'station_not_kitchen_enabled', status: 400 };
    }
  }

  return true;
}

function parseStationIds(raw: unknown): string[] | KitchenScreenMutationError {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'station_ids_required', status: 400 };
  }
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      return { error: 'invalid_station_ids', status: 400 };
    }
    const id = parseTableIdParam(item);
    if (!id) {
      return { error: 'invalid_station_ids', status: 400 };
    }
    ids.push(id);
  }
  return ids;
}

async function replaceScreenStations(
  admin: SupabaseClient,
  screenId: string,
  stationIds: string[],
): Promise<true | KitchenScreenMutationError> {
  const { error: delErr } = await admin
    .from('kitchen_screen_stations')
    .delete()
    .eq('screen_id', screenId);
  if (delErr) {
    return { error: 'stations_update_failed', message: delErr.message, status: 500 };
  }

  if (stationIds.length === 0) return true;

  const rows = stationIds.map((print_station_id, sort_order) => ({
    screen_id: screenId,
    print_station_id,
    sort_order,
  }));
  const { error: insErr } = await admin.from('kitchen_screen_stations').insert(rows);
  if (insErr) {
    if (insErr.message?.includes('kitchen_screen_station_limit') || insErr.code === '23514') {
      return {
        error: 'station_ids_limit',
        message: `At most ${KITCHEN_SCREEN_MAX_STATIONS} stations per screen`,
        status: 400,
      };
    }
    return { error: 'stations_update_failed', message: insErr.message, status: 500 };
  }
  return true;
}

function mapScreenRow(
  row: {
    id: string;
    restaurant_id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
    kitchen_screen_stations?: ScreenStationJoin[] | null;
  },
): KitchenScreenRow {
  const joins = [...(row.kitchen_screen_stations || [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    station_ids: joins.map((j) => j.print_station_id),
  };
}

export async function listKitchenScreens(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<KitchenScreenRow[] | KitchenScreenMutationError> {
  const { data, error } = await admin
    .from('kitchen_screens')
    .select(
      'id, restaurant_id, name, sort_order, created_at, updated_at, kitchen_screen_stations(print_station_id, sort_order)',
    )
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return { error: 'list_failed', message: error.message, status: 500 };
  }

  return (data || []).map((row) =>
    mapScreenRow(row as Parameters<typeof mapScreenRow>[0]),
  );
}

export async function createKitchenScreen(
  admin: SupabaseClient,
  restaurantId: string,
  input: { name: string; station_ids: unknown },
): Promise<{ screen: KitchenScreenRow } | KitchenScreenMutationError> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    return { error: 'name_required', status: 400 };
  }

  const stationIds = parseStationIds(input.station_ids);
  if (!Array.isArray(stationIds)) return stationIds;

  const valid = await validateKitchenEnabledStationIds(admin, restaurantId, stationIds);
  if (valid !== true) return valid;

  const { data: existing, error: listError } = await admin
    .from('kitchen_screens')
    .select('sort_order')
    .eq('restaurant_id', restaurantId);
  if (listError) {
    return { error: 'list_failed', message: listError.message, status: 500 };
  }
  const sortOrder =
    (existing || []).reduce((max, row) => Math.max(max, row.sort_order ?? 0), -1) + 1;

  const { data: screen, error: insErr } = await admin
    .from('kitchen_screens')
    .insert({
      restaurant_id: restaurantId,
      name,
      sort_order: sortOrder,
    })
    .select('id, restaurant_id, name, sort_order, created_at, updated_at')
    .single();

  if (insErr || !screen) {
    if (uniqueViolation(insErr)) {
      return { error: 'name_taken', status: 409 };
    }
    return { error: 'insert_failed', message: insErr?.message, status: 500 };
  }

  const linked = await replaceScreenStations(admin, screen.id as string, stationIds);
  if (linked !== true) {
    await admin.from('kitchen_screens').delete().eq('id', screen.id);
    return linked;
  }

  return {
    screen: {
      ...(screen as Omit<KitchenScreenRow, 'station_ids'>),
      station_ids: stationIds,
    },
  };
}

export async function updateKitchenScreen(
  admin: SupabaseClient,
  restaurantId: string,
  screenIdRaw: string,
  input: { name?: string; station_ids?: unknown },
): Promise<{ screen: KitchenScreenRow } | KitchenScreenMutationError> {
  const screenId = parseTableIdParam(screenIdRaw);
  if (!screenId) {
    return { error: 'invalid_screen_id', status: 400 };
  }

  const { data: existing, error: findErr } = await admin
    .from('kitchen_screens')
    .select('id')
    .eq('id', screenId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (findErr) {
    return { error: 'lookup_failed', message: findErr.message, status: 500 };
  }
  if (!existing) {
    return { error: 'screen_not_found', status: 404 };
  }

  const patch: { name?: string; updated_at?: string } = {};
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim()) {
      return { error: 'name_required', status: 400 };
    }
    patch.name = input.name.trim();
  }

  let stationIds: string[] | undefined;
  if (input.station_ids !== undefined) {
    const parsed = parseStationIds(input.station_ids);
    if (!Array.isArray(parsed)) return parsed;
    const valid = await validateKitchenEnabledStationIds(admin, restaurantId, parsed);
    if (valid !== true) return valid;
    stationIds = parsed;
  }

  if (Object.keys(patch).length === 0 && stationIds === undefined) {
    return { error: 'nothing_to_update', status: 400 };
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    const { error: updErr } = await admin
      .from('kitchen_screens')
      .update(patch)
      .eq('id', screenId)
      .eq('restaurant_id', restaurantId);
    if (updErr) {
      if (uniqueViolation(updErr)) {
        return { error: 'name_taken', status: 409 };
      }
      return { error: 'update_failed', message: updErr.message, status: 500 };
    }
  }

  if (stationIds !== undefined) {
    const linked = await replaceScreenStations(admin, screenId, stationIds);
    if (linked !== true) return linked;
  }

  const listed = await listKitchenScreens(admin, restaurantId);
  if (!Array.isArray(listed)) return listed;
  const screen = listed.find((s) => s.id === screenId);
  if (!screen) {
    return { error: 'screen_not_found', status: 404 };
  }
  return { screen };
}

export async function deleteKitchenScreen(
  admin: SupabaseClient,
  restaurantId: string,
  screenIdRaw: string,
): Promise<{ ok: true } | KitchenScreenMutationError> {
  const screenId = parseTableIdParam(screenIdRaw);
  if (!screenId) {
    return { error: 'invalid_screen_id', status: 400 };
  }

  const { data, error } = await admin
    .from('kitchen_screens')
    .delete()
    .eq('id', screenId)
    .eq('restaurant_id', restaurantId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: 'delete_failed', message: error.message, status: 500 };
  }
  if (!data) {
    return { error: 'screen_not_found', status: 404 };
  }
  return { ok: true };
}
