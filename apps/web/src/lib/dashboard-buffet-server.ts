import type { SupabaseClient } from '@supabase/supabase-js';
import type { Buffet, BuffetCalendarKind, BuffetPriceRule, BuffetTimeSlot } from '@/types';
import type { BuffetDashboardPatch } from '@/lib/buffet-dashboard-patch';
import type { MutationError } from '@/lib/dashboard-api-shared';
import { invalidateBuffetConfig } from '@/lib/buffet-config-version';
import { invalidateCustomerMenuCatalog } from '@/lib/customer-menu-catalog';
import { DEFAULT_BUFFET_VAT_RATE } from '@/lib/menu-vat-rate';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { parseBuffetUpdatePatch } from '@/lib/buffet-update-patch';

/** Bump staff buffet_config_version after a successful buffet-settings write. */
async function afterBuffetConfigWrite<T extends object>(
  restaurantId: string,
  result: T | MutationError,
): Promise<T | MutationError> {
  if (result && typeof result === 'object' && 'error' in result) return result;
  await invalidateBuffetConfig(restaurantId);
  return result;
}

export type BuffetDashboardData = {
  buffets: Buffet[];
  slots: BuffetTimeSlot[];
  rules: BuffetPriceRule[];
  calendarRows: Array<{ on_date: string; kind: 'holiday' | 'special' }>;
  buffet_friday_weekend_from: string | null;
};

export type BuffetMutationResult = { patch: BuffetDashboardPatch } | MutationError;

const BUFFETS_SELECT =
  'id, restaurant_id, name, is_active, description, vat_rate, created_at, updated_at';
const SLOTS_SELECT =
  'id, restaurant_id, name, start_time, end_time, weekdays, sort_order, created_at';
const RULES_SELECT =
  'id, restaurant_id, buffet_id, time_slot_id, calendar_kind, valid_from, valid_to, adult_price, child_price, priority, is_active, note, created_at';

async function loadBuffetsSlice(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ buffets: Buffet[] } | MutationError> {
  const { data, error } = await admin
    .from('buffets')
    .select(BUFFETS_SELECT)
    .eq('restaurant_id', restaurantId)
    .order('name');
  if (error) return { error: 'buffets_query_failed', message: error.message, status: 500 };
  return { buffets: (data || []) as Buffet[] };
}

async function loadSlotsSlice(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ slots: BuffetTimeSlot[] } | MutationError> {
  const { data, error } = await admin
    .from('buffet_time_slots')
    .select(SLOTS_SELECT)
    .eq('restaurant_id', restaurantId)
    .order('sort_order')
    .order('name');
  if (error) return { error: 'slots_query_failed', message: error.message, status: 500 };
  return { slots: (data || []) as BuffetTimeSlot[] };
}

async function loadRulesSlice(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ rules: BuffetPriceRule[] } | MutationError> {
  const { data, error } = await admin
    .from('buffet_price_rules')
    .select(RULES_SELECT)
    .eq('restaurant_id', restaurantId)
    .order('priority', { ascending: false });
  if (error) return { error: 'rules_query_failed', message: error.message, status: 500 };
  return { rules: (data || []) as BuffetPriceRule[] };
}

async function loadCalendarSlice(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ calendarRows: BuffetDashboardData['calendarRows'] } | MutationError> {
  const { data, error } = await admin
    .from('buffet_calendar_overrides')
    .select('on_date, kind')
    .eq('restaurant_id', restaurantId)
    .order('on_date');
  if (error) return { error: 'calendar_query_failed', message: error.message, status: 500 };
  return {
    calendarRows: (data || []) as BuffetDashboardData['calendarRows'],
  };
}

async function loadRestaurantBuffetSettingsSlice(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ buffet_friday_weekend_from: string | null } | MutationError> {
  const { data, error } = await admin
    .from('restaurants')
    .select('buffet_friday_weekend_from')
    .eq('id', restaurantId)
    .maybeSingle();
  if (error) return { error: 'restaurant_query_failed', message: error.message, status: 500 };
  return {
    buffet_friday_weekend_from: (data?.buffet_friday_weekend_from as string | null) ?? null,
  };
}

async function mergeSlices(
  slices: Array<BuffetDashboardPatch | MutationError>,
): Promise<BuffetMutationResult> {
  const patch: BuffetDashboardPatch = {};
  for (const slice of slices) {
    if ('error' in slice) return slice;
    Object.assign(patch, slice);
  }
  return { patch };
}

export async function loadBuffetDashboard(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<BuffetDashboardData | MutationError> {
  const [buffetsRes, slotsRes, rulesRes, calendarRes, restaurantRes] = await Promise.all([
    loadBuffetsSlice(admin, restaurantId),
    loadSlotsSlice(admin, restaurantId),
    loadRulesSlice(admin, restaurantId),
    loadCalendarSlice(admin, restaurantId),
    loadRestaurantBuffetSettingsSlice(admin, restaurantId),
  ]);

  if ('error' in buffetsRes) return buffetsRes;
  if ('error' in slotsRes) return slotsRes;
  if ('error' in rulesRes) return rulesRes;
  if ('error' in calendarRes) return calendarRes;
  if ('error' in restaurantRes) return restaurantRes;

  return {
    buffets: buffetsRes.buffets,
    slots: slotsRes.slots,
    rules: rulesRes.rules,
    calendarRows: calendarRes.calendarRows,
    buffet_friday_weekend_from: restaurantRes.buffet_friday_weekend_from,
  };
}

export async function createBuffet(
  admin: SupabaseClient,
  restaurantId: string,
  name: string,
): Promise<BuffetMutationResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'name_required', status: 400 };

  const { error } = await admin.from('buffets').insert({
    restaurant_id: restaurantId,
    name: trimmed,
    is_active: true,
    vat_rate: DEFAULT_BUFFET_VAT_RATE,
  });
  if (error) return { error: 'insert_failed', message: error.message, status: 500 };

  const buffetsRes = await loadBuffetsSlice(admin, restaurantId);
  if ('error' in buffetsRes) return buffetsRes;
  return afterBuffetConfigWrite(restaurantId, { patch: buffetsRes });
}

export async function deleteBuffet(
  admin: SupabaseClient,
  restaurantId: string,
  buffetId: string,
): Promise<BuffetMutationResult> {
  const id = parseTableIdParam(buffetId);
  if (!id) return { error: 'invalid_buffet_id', status: 400 };

  const { error } = await admin.from('buffets').delete().eq('id', id).eq('restaurant_id', restaurantId);
  if (error) return { error: 'delete_failed', message: error.message, status: 500 };

  return afterBuffetConfigWrite(
    restaurantId,
    await mergeSlices([
      await loadBuffetsSlice(admin, restaurantId),
      await loadRulesSlice(admin, restaurantId),
    ]),
  );
}

export async function updateBuffet(
  admin: SupabaseClient,
  restaurantId: string,
  buffetId: string,
  rawPatch: unknown,
): Promise<BuffetMutationResult> {
  const id = parseTableIdParam(buffetId);
  if (!id) return { error: 'invalid_buffet_id', status: 400 };

  const parsed = parseBuffetUpdatePatch(rawPatch);
  if (!('ok' in parsed)) return parsed;

  const { error } = await admin
    .from('buffets')
    .update(parsed.patch)
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'update_failed', message: error.message, status: 500 };

  const buffetsRes = await loadBuffetsSlice(admin, restaurantId);
  if ('error' in buffetsRes) return buffetsRes;
  return afterBuffetConfigWrite(restaurantId, { patch: buffetsRes });
}

export async function createBuffetTimeSlot(
  admin: SupabaseClient,
  restaurantId: string,
  input: { name: string; sort_order: number },
): Promise<BuffetMutationResult> {
  const trimmed = input.name.trim();
  if (!trimmed) return { error: 'name_required', status: 400 };

  const { error } = await admin.from('buffet_time_slots').insert({
    restaurant_id: restaurantId,
    name: trimmed,
    start_time: '11:00:00',
    end_time: '15:00:00',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    sort_order: input.sort_order,
  });
  if (error) return { error: 'insert_failed', message: error.message, status: 500 };
  await invalidateCustomerMenuCatalog(restaurantId);

  const slotsRes = await loadSlotsSlice(admin, restaurantId);
  if ('error' in slotsRes) return slotsRes;
  return afterBuffetConfigWrite(restaurantId, { patch: slotsRes });
}

export async function deleteBuffetTimeSlot(
  admin: SupabaseClient,
  restaurantId: string,
  slotId: string,
): Promise<BuffetMutationResult> {
  const id = parseTableIdParam(slotId);
  if (!id) return { error: 'invalid_slot_id', status: 400 };

  const { error } = await admin
    .from('buffet_time_slots')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'delete_failed', message: error.message, status: 500 };
  // FK sets those dishes' time_slot_id to null (all day) — guest catalog must reload.
  await invalidateCustomerMenuCatalog(restaurantId);

  return afterBuffetConfigWrite(
    restaurantId,
    await mergeSlices([
      await loadSlotsSlice(admin, restaurantId),
      await loadRulesSlice(admin, restaurantId),
    ]),
  );
}

export async function updateBuffetTimeSlot(
  admin: SupabaseClient,
  restaurantId: string,
  slotId: string,
  patch: Partial<BuffetTimeSlot>,
): Promise<BuffetMutationResult> {
  const id = parseTableIdParam(slotId);
  if (!id) return { error: 'invalid_slot_id', status: 400 };

  const { error } = await admin
    .from('buffet_time_slots')
    .update(patch)
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'update_failed', message: error.message, status: 500 };
  await invalidateCustomerMenuCatalog(restaurantId);

  const slotsRes = await loadSlotsSlice(admin, restaurantId);
  if ('error' in slotsRes) return slotsRes;
  return afterBuffetConfigWrite(restaurantId, { patch: slotsRes });
}

export type BuffetRuleInput = {
  buffet_id: string;
  time_slot_id: string;
  calendar_kind: BuffetCalendarKind;
  valid_from: string;
  valid_to: string | null;
  adult_price: number;
  child_price: number;
  priority: number;
  is_active: boolean;
  note: string | null;
};

function parseOptionalValidTo(raw: unknown): string | null | MutationError {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') return { error: 'invalid_rule_body', status: 400 };
  const trimmed = raw.trim().slice(0, 10);
  return trimmed || null;
}

function parseRuleInput(raw: Record<string, unknown>): BuffetRuleInput | MutationError {
  if (
    typeof raw.buffet_id !== 'string' ||
    typeof raw.time_slot_id !== 'string' ||
    typeof raw.calendar_kind !== 'string' ||
    typeof raw.valid_from !== 'string' ||
    !raw.valid_from.trim()
  ) {
    return { error: 'invalid_rule_body', status: 400 };
  }
  const validTo = parseOptionalValidTo(raw.valid_to);
  if (validTo && typeof validTo === 'object' && 'error' in validTo) return validTo;
  const adultPrice = typeof raw.adult_price === 'number' ? raw.adult_price : Number(raw.adult_price);
  const childPrice = typeof raw.child_price === 'number' ? raw.child_price : Number(raw.child_price);
  const priority = typeof raw.priority === 'number' ? raw.priority : Number(raw.priority ?? 0);
  if (!Number.isFinite(adultPrice) || !Number.isFinite(childPrice) || !Number.isFinite(priority)) {
    return { error: 'invalid_rule_body', status: 400 };
  }
  return {
    buffet_id: raw.buffet_id,
    time_slot_id: raw.time_slot_id,
    calendar_kind: raw.calendar_kind as BuffetCalendarKind,
    valid_from: raw.valid_from.trim().slice(0, 10),
    valid_to: validTo as string | null,
    adult_price: adultPrice,
    child_price: childPrice,
    priority,
    is_active: raw.is_active !== false,
    note: typeof raw.note === 'string' ? raw.note.trim() || null : null,
  };
}

async function loadRuleById(
  admin: SupabaseClient,
  restaurantId: string,
  ruleId: string,
): Promise<BuffetPriceRule | null | MutationError> {
  const { data, error } = await admin
    .from('buffet_price_rules')
    .select(RULES_SELECT)
    .eq('id', ruleId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error) return { error: 'rules_query_failed', message: error.message, status: 500 };
  return (data as BuffetPriceRule | null) ?? null;
}

export type BuffetRuleMutationResult =
  | {
      patch: BuffetDashboardPatch;
      ruleId: string;
      before: BuffetPriceRule | null;
      after: BuffetPriceRule | null;
      op: 'create' | 'update' | 'delete' | 'toggle';
    }
  | MutationError;

export async function createBuffetPriceRule(
  admin: SupabaseClient,
  restaurantId: string,
  raw: Record<string, unknown>,
): Promise<BuffetRuleMutationResult> {
  const parsed = parseRuleInput(raw);
  if ('error' in parsed) return parsed;

  const { data, error } = await admin
    .from('buffet_price_rules')
    .insert({
      restaurant_id: restaurantId,
      ...parsed,
    })
    .select(RULES_SELECT)
    .single();
  if (error) return { error: 'insert_failed', message: error.message, status: 500 };

  const rulesRes = await loadRulesSlice(admin, restaurantId);
  if ('error' in rulesRes) return rulesRes;
  const after = data as BuffetPriceRule;
  return afterBuffetConfigWrite(restaurantId, {
    patch: rulesRes,
    ruleId: after.id,
    before: null,
    after,
    op: 'create' as const,
  });
}

export async function updateBuffetPriceRule(
  admin: SupabaseClient,
  restaurantId: string,
  ruleId: string,
  raw: Record<string, unknown>,
): Promise<BuffetRuleMutationResult> {
  const id = parseTableIdParam(ruleId);
  if (!id) return { error: 'invalid_rule_id', status: 400 };
  const parsed = parseRuleInput(raw);
  if ('error' in parsed) return parsed;

  const before = await loadRuleById(admin, restaurantId, id);
  if (before && 'error' in before) return before;
  if (!before) return { error: 'rule_not_found', status: 404 };

  const { data, error } = await admin
    .from('buffet_price_rules')
    .update(parsed)
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select(RULES_SELECT)
    .single();
  if (error) return { error: 'update_failed', message: error.message, status: 500 };

  const rulesRes = await loadRulesSlice(admin, restaurantId);
  if ('error' in rulesRes) return rulesRes;
  return afterBuffetConfigWrite(restaurantId, {
    patch: rulesRes,
    ruleId: id,
    before,
    after: data as BuffetPriceRule,
    op: 'update' as const,
  });
}

export async function deleteBuffetPriceRule(
  admin: SupabaseClient,
  restaurantId: string,
  ruleId: string,
): Promise<BuffetRuleMutationResult> {
  const id = parseTableIdParam(ruleId);
  if (!id) return { error: 'invalid_rule_id', status: 400 };

  const before = await loadRuleById(admin, restaurantId, id);
  if (before && 'error' in before) return before;
  if (!before) return { error: 'rule_not_found', status: 404 };

  const { error } = await admin
    .from('buffet_price_rules')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'delete_failed', message: error.message, status: 500 };

  const rulesRes = await loadRulesSlice(admin, restaurantId);
  if ('error' in rulesRes) return rulesRes;
  return afterBuffetConfigWrite(restaurantId, {
    patch: rulesRes,
    ruleId: id,
    before,
    after: null,
    op: 'delete' as const,
  });
}

export async function toggleBuffetPriceRuleActive(
  admin: SupabaseClient,
  restaurantId: string,
  ruleId: string,
  isActive: boolean,
): Promise<BuffetRuleMutationResult> {
  const id = parseTableIdParam(ruleId);
  if (!id) return { error: 'invalid_rule_id', status: 400 };

  const before = await loadRuleById(admin, restaurantId, id);
  if (before && 'error' in before) return before;
  if (!before) return { error: 'rule_not_found', status: 404 };

  const { data, error } = await admin
    .from('buffet_price_rules')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select(RULES_SELECT)
    .single();
  if (error) return { error: 'update_failed', message: error.message, status: 500 };

  const rulesRes = await loadRulesSlice(admin, restaurantId);
  if ('error' in rulesRes) return rulesRes;
  return afterBuffetConfigWrite(restaurantId, {
    patch: rulesRes,
    ruleId: id,
    before,
    after: data as BuffetPriceRule,
    op: 'toggle' as const,
  });
}

export type BuffetCalendarMutationResult =
  | {
      patch: BuffetDashboardPatch;
      op: 'upsert' | 'delete';
      rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>;
      removedDate?: string;
      removedKind?: 'holiday' | 'special' | null;
    }
  | MutationError;

export async function upsertBuffetCalendarOverrides(
  admin: SupabaseClient,
  restaurantId: string,
  rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>,
): Promise<BuffetCalendarMutationResult> {
  const normalized = rows.map((r) => ({
    on_date: r.on_date.slice(0, 10),
    kind: r.kind,
  }));
  const { error } = await admin.from('buffet_calendar_overrides').upsert(
    normalized.map((r) => ({
      restaurant_id: restaurantId,
      on_date: r.on_date,
      kind: r.kind,
    })),
  );
  if (error) return { error: 'upsert_failed', message: error.message, status: 500 };

  const calendarRes = await loadCalendarSlice(admin, restaurantId);
  if ('error' in calendarRes) return calendarRes;
  return afterBuffetConfigWrite(restaurantId, {
    patch: calendarRes,
    op: 'upsert' as const,
    rows: normalized,
  });
}

export async function deleteBuffetCalendarOverride(
  admin: SupabaseClient,
  restaurantId: string,
  onDate: string,
): Promise<BuffetCalendarMutationResult> {
  const date = onDate.slice(0, 10);
  if (!date) return { error: 'invalid_date', status: 400 };

  const { data: existing } = await admin
    .from('buffet_calendar_overrides')
    .select('on_date, kind')
    .eq('restaurant_id', restaurantId)
    .eq('on_date', date)
    .maybeSingle();

  const { error } = await admin
    .from('buffet_calendar_overrides')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('on_date', date);
  if (error) return { error: 'delete_failed', message: error.message, status: 500 };

  const calendarRes = await loadCalendarSlice(admin, restaurantId);
  if ('error' in calendarRes) return calendarRes;
  return afterBuffetConfigWrite(restaurantId, {
    patch: calendarRes,
    op: 'delete' as const,
    rows: [],
    removedDate: date,
    removedKind: (existing?.kind as 'holiday' | 'special' | undefined) ?? null,
  });
}

export type BuffetFridayPolicyMutationResult =
  | {
      patch: BuffetDashboardPatch;
      beforeFrom: string | null;
      afterFrom: string | null;
    }
  | MutationError;

export async function updateBuffetFridayPolicy(
  admin: SupabaseClient,
  restaurantId: string,
  buffetFridayWeekendFrom: string | null,
): Promise<BuffetFridayPolicyMutationResult> {
  const beforeRes = await loadRestaurantBuffetSettingsSlice(admin, restaurantId);
  if ('error' in beforeRes) return beforeRes;
  const beforeFrom = beforeRes.buffet_friday_weekend_from;

  const { error } = await admin
    .from('restaurants')
    .update({ buffet_friday_weekend_from: buffetFridayWeekendFrom })
    .eq('id', restaurantId);
  if (error) return { error: 'update_failed', message: error.message, status: 500 };

  const restaurantRes = await loadRestaurantBuffetSettingsSlice(admin, restaurantId);
  if ('error' in restaurantRes) return restaurantRes;
  return afterBuffetConfigWrite(restaurantId, {
    patch: {
      buffet_friday_weekend_from: restaurantRes.buffet_friday_weekend_from,
    },
    beforeFrom,
    afterFrom: restaurantRes.buffet_friday_weekend_from,
  });
}
