import type { SupabaseClient } from '@supabase/supabase-js';
import type { Buffet, BuffetCalendarKind, BuffetPriceRule, BuffetTimeSlot } from '@/types';
import type { MutationError } from '@/lib/dashboard-api-shared';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export type BuffetDashboardData = {
  buffets: Buffet[];
  slots: BuffetTimeSlot[];
  rules: BuffetPriceRule[];
  calendarRows: Array<{ on_date: string; kind: 'holiday' | 'special' }>;
  buffet_friday_weekend_from: string | null;
};

export async function loadBuffetDashboard(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<BuffetDashboardData | MutationError> {
  const [buffetsRes, slotsRes, rulesRes, calendarRes, restaurantRes] = await Promise.all([
    admin.from('buffets').select('*').eq('restaurant_id', restaurantId).order('name'),
    admin
      .from('buffet_time_slots')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order')
      .order('name'),
    admin
      .from('buffet_price_rules')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('priority', { ascending: false }),
    admin
      .from('buffet_calendar_overrides')
      .select('on_date, kind')
      .eq('restaurant_id', restaurantId)
      .order('on_date'),
    admin
      .from('restaurants')
      .select('buffet_friday_weekend_from')
      .eq('id', restaurantId)
      .maybeSingle(),
  ]);

  if (buffetsRes.error) {
    return { error: 'buffets_query_failed', message: buffetsRes.error.message, status: 500 };
  }
  if (slotsRes.error) {
    return { error: 'slots_query_failed', message: slotsRes.error.message, status: 500 };
  }
  if (rulesRes.error) {
    return { error: 'rules_query_failed', message: rulesRes.error.message, status: 500 };
  }
  if (calendarRes.error) {
    return { error: 'calendar_query_failed', message: calendarRes.error.message, status: 500 };
  }
  if (restaurantRes.error) {
    return { error: 'restaurant_query_failed', message: restaurantRes.error.message, status: 500 };
  }

  return {
    buffets: (buffetsRes.data || []) as Buffet[],
    slots: (slotsRes.data || []) as BuffetTimeSlot[],
    rules: (rulesRes.data || []) as BuffetPriceRule[],
    calendarRows: (calendarRes.data || []) as Array<{ on_date: string; kind: 'holiday' | 'special' }>,
    buffet_friday_weekend_from:
      (restaurantRes.data?.buffet_friday_weekend_from as string | null) ?? null,
  };
}

export async function createBuffet(
  admin: SupabaseClient,
  restaurantId: string,
  name: string,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'name_required', status: 400 };

  const { error } = await admin.from('buffets').insert({
    restaurant_id: restaurantId,
    name: trimmed,
    is_active: true,
  });
  if (error) return { error: 'insert_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function deleteBuffet(
  admin: SupabaseClient,
  restaurantId: string,
  buffetId: string,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const id = parseTableIdParam(buffetId);
  if (!id) return { error: 'invalid_buffet_id', status: 400 };

  const { error } = await admin.from('buffets').delete().eq('id', id).eq('restaurant_id', restaurantId);
  if (error) return { error: 'delete_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function updateBuffet(
  admin: SupabaseClient,
  restaurantId: string,
  buffetId: string,
  patch: Partial<Pick<Buffet, 'name' | 'is_active'>>,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const id = parseTableIdParam(buffetId);
  if (!id) return { error: 'invalid_buffet_id', status: 400 };

  const { error } = await admin.from('buffets').update(patch).eq('id', id).eq('restaurant_id', restaurantId);
  if (error) return { error: 'update_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function createBuffetTimeSlot(
  admin: SupabaseClient,
  restaurantId: string,
  input: { name: string; sort_order: number },
): Promise<{ data: BuffetDashboardData } | MutationError> {
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

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function deleteBuffetTimeSlot(
  admin: SupabaseClient,
  restaurantId: string,
  slotId: string,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const id = parseTableIdParam(slotId);
  if (!id) return { error: 'invalid_slot_id', status: 400 };

  const { error } = await admin
    .from('buffet_time_slots')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'delete_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function updateBuffetTimeSlot(
  admin: SupabaseClient,
  restaurantId: string,
  slotId: string,
  patch: Partial<BuffetTimeSlot>,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const id = parseTableIdParam(slotId);
  if (!id) return { error: 'invalid_slot_id', status: 400 };

  const { error } = await admin
    .from('buffet_time_slots')
    .update(patch)
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'update_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export type BuffetRuleInput = {
  buffet_id: string;
  time_slot_id: string;
  calendar_kind: BuffetCalendarKind;
  valid_from: string;
  valid_to: string;
  adult_price: number;
  child_price: number;
  priority: number;
  is_active: boolean;
  note: string | null;
};

function parseRuleInput(raw: Record<string, unknown>): BuffetRuleInput | MutationError {
  if (
    typeof raw.buffet_id !== 'string' ||
    typeof raw.time_slot_id !== 'string' ||
    typeof raw.calendar_kind !== 'string' ||
    typeof raw.valid_from !== 'string' ||
    typeof raw.valid_to !== 'string'
  ) {
    return { error: 'invalid_rule_body', status: 400 };
  }
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
    valid_from: raw.valid_from,
    valid_to: raw.valid_to,
    adult_price: adultPrice,
    child_price: childPrice,
    priority,
    is_active: raw.is_active !== false,
    note: typeof raw.note === 'string' ? raw.note.trim() || null : null,
  };
}

export async function createBuffetPriceRule(
  admin: SupabaseClient,
  restaurantId: string,
  raw: Record<string, unknown>,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const parsed = parseRuleInput(raw);
  if ('error' in parsed) return parsed;

  const { error } = await admin.from('buffet_price_rules').insert({
    restaurant_id: restaurantId,
    ...parsed,
  });
  if (error) return { error: 'insert_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function updateBuffetPriceRule(
  admin: SupabaseClient,
  restaurantId: string,
  ruleId: string,
  raw: Record<string, unknown>,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const id = parseTableIdParam(ruleId);
  if (!id) return { error: 'invalid_rule_id', status: 400 };
  const parsed = parseRuleInput(raw);
  if ('error' in parsed) return parsed;

  const { error } = await admin
    .from('buffet_price_rules')
    .update(parsed)
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'update_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function deleteBuffetPriceRule(
  admin: SupabaseClient,
  restaurantId: string,
  ruleId: string,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const id = parseTableIdParam(ruleId);
  if (!id) return { error: 'invalid_rule_id', status: 400 };

  const { error } = await admin
    .from('buffet_price_rules')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'delete_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function toggleBuffetPriceRuleActive(
  admin: SupabaseClient,
  restaurantId: string,
  ruleId: string,
  isActive: boolean,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const id = parseTableIdParam(ruleId);
  if (!id) return { error: 'invalid_rule_id', status: 400 };

  const { error } = await admin
    .from('buffet_price_rules')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) return { error: 'update_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function upsertBuffetCalendarOverrides(
  admin: SupabaseClient,
  restaurantId: string,
  rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const { error } = await admin.from('buffet_calendar_overrides').upsert(
    rows.map((r) => ({
      restaurant_id: restaurantId,
      on_date: r.on_date.slice(0, 10),
      kind: r.kind,
    })),
  );
  if (error) return { error: 'upsert_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function deleteBuffetCalendarOverride(
  admin: SupabaseClient,
  restaurantId: string,
  onDate: string,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const date = onDate.slice(0, 10);
  if (!date) return { error: 'invalid_date', status: 400 };

  const { error } = await admin
    .from('buffet_calendar_overrides')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('on_date', date);
  if (error) return { error: 'delete_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}

export async function updateBuffetFridayPolicy(
  admin: SupabaseClient,
  restaurantId: string,
  buffetFridayWeekendFrom: string | null,
): Promise<{ data: BuffetDashboardData } | MutationError> {
  const { error } = await admin
    .from('restaurants')
    .update({ buffet_friday_weekend_from: buffetFridayWeekendFrom })
    .eq('id', restaurantId);
  if (error) return { error: 'update_failed', message: error.message, status: 500 };

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) return data;
  return { data };
}
