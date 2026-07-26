import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderItemStatus } from '@/types';
import {
  addCalendarDays,
  calendarDateInTimezone,
  daysBetweenInclusive,
  lisbonDayStartUtcIso,
} from '@/lib/lisbon-calendar';
import {
  ABNORMAL_OPERATION_MAX_LOOKBACK_DAYS,
  ABNORMAL_OPERATION_MAX_RANGE_DAYS,
} from '@/lib/audit/reasons';
import type {
  AbnormalOperationRow,
  AbnormalOperationStatus,
  AbnormalRiskLevel,
  AbnormalOperationType,
} from '@/lib/abnormal-operations/types';

export type ParsedAbnormalDateRange =
  | {
      ok: true;
      startDate: string;
      endDate: string;
      startUtc: string;
      endExclusiveUtc: string;
    }
  | { ok: false; code: 'invalid_date_range' };

export type AbnormalOperationsListFilters = {
  restaurantId: string;
  startDate?: string;
  endDate?: string;
  type?: AbnormalOperationType;
  riskLevel?: AbnormalRiskLevel;
  operatorId?: string;
  tableId?: string;
  status?: AbnormalOperationStatus;
  page?: number;
  pageSize?: number;
  now?: Date;
};

export type AbnormalOperationsStats = {
  total_count: number;
  high_risk_count: number;
  amount_impact_sum: number;
  pending_count: number;
};

export type AbnormalOperationsListResult = {
  items: AbnormalOperationRow[];
  stats: AbnormalOperationsStats;
  page: number;
  pageSize: number;
  total: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RISK_SORT: Record<AbnormalRiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const STATUS_TRANSITIONS: Record<AbnormalOperationStatus, AbnormalOperationStatus[]> = {
  PENDING: ['CONFIRMED', 'IGNORED'],
  CONFIRMED: ['IGNORED'],
  IGNORED: ['CONFIRMED'],
};

export function riskLevelForVoidedItem(
  itemStatus: OrderItemStatus | undefined,
): AbnormalRiskLevel {
  if (itemStatus === 'done') return 'HIGH';
  if (itemStatus === 'cooking') return 'MEDIUM';
  return 'LOW';
}

export function riskLevelForDiscountRate(discountRate: number): AbnormalRiskLevel {
  const rate = Math.min(100, Math.max(0, discountRate));
  if (rate >= 30) return 'HIGH';
  if (rate >= 10) return 'MEDIUM';
  return 'LOW';
}

export function parseAbnormalOperationsDateRange(input: {
  startDate?: string;
  endDate?: string;
  now?: Date;
}): ParsedAbnormalDateRange {
  const now = input.now ?? new Date();
  const today = calendarDateInTimezone(now);
  const startDate = input.startDate?.trim() || today;
  const endDate = input.endDate?.trim() || today;

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { ok: false, code: 'invalid_date_range' };
  }
  if (endDate > today || startDate > endDate) {
    return { ok: false, code: 'invalid_date_range' };
  }
  if (daysBetweenInclusive(startDate, endDate) > ABNORMAL_OPERATION_MAX_RANGE_DAYS) {
    return { ok: false, code: 'invalid_date_range' };
  }

  const earliestAllowed = addCalendarDays(today, -(ABNORMAL_OPERATION_MAX_LOOKBACK_DAYS - 1));
  if (startDate < earliestAllowed) {
    return { ok: false, code: 'invalid_date_range' };
  }

  const startUtc = lisbonDayStartUtcIso(startDate);
  const endExclusiveUtc = lisbonDayStartUtcIso(addCalendarDays(endDate, 1));
  return { ok: true, startDate, endDate, startUtc, endExclusiveUtc };
}

export function compareAbnormalOperations(
  a: Pick<AbnormalOperationRow, 'risk_level' | 'created_at'>,
  b: Pick<AbnormalOperationRow, 'risk_level' | 'created_at'>,
): number {
  const riskDiff = RISK_SORT[a.risk_level] - RISK_SORT[b.risk_level];
  if (riskDiff !== 0) return riskDiff;
  return b.created_at.localeCompare(a.created_at);
}

type OwnerListRpcPayload = {
  items?: AbnormalOperationRow[];
  stats?: AbnormalOperationsStats;
  page?: number;
  pageSize?: number;
  total?: number;
};

export async function listAbnormalOperations(
  admin: SupabaseClient,
  filters: AbnormalOperationsListFilters,
): Promise<
  | { ok: true; result: AbnormalOperationsListResult }
  | { ok: false; code: 'invalid_date_range' | 'query_failed'; message?: string }
> {
  const parsed = parseAbnormalOperationsDateRange({
    startDate: filters.startDate,
    endDate: filters.endDate,
    now: filters.now,
  });
  if (!parsed.ok) {
    return { ok: false, code: 'invalid_date_range' };
  }

  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
  const page = Math.max(1, filters.page ?? 1);

  const { data, error } = await admin.rpc('abnormal_operations_owner_list', {
    p_restaurant_id: filters.restaurantId,
    p_start_utc: parsed.startUtc,
    p_end_exclusive_utc: parsed.endExclusiveUtc,
    p_type: filters.type ?? null,
    p_risk_level: filters.riskLevel ?? null,
    p_operator_id: filters.operatorId ?? null,
    p_table_id: filters.tableId ?? null,
    p_status: filters.status ?? null,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    return { ok: false, code: 'query_failed', message: error.message };
  }

  const payload = (data || {}) as OwnerListRpcPayload;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const stats = payload.stats ?? {
    total_count: 0,
    high_risk_count: 0,
    amount_impact_sum: 0,
    pending_count: 0,
  };

  return {
    ok: true,
    result: {
      items,
      stats: {
        total_count: Number(stats.total_count) || 0,
        high_risk_count: Number(stats.high_risk_count) || 0,
        amount_impact_sum: Number(stats.amount_impact_sum) || 0,
        pending_count: Number(stats.pending_count) || 0,
      },
      page: Number(payload.page) || page,
      pageSize: Number(payload.pageSize) || pageSize,
      total: Number(payload.total) || 0,
    },
  };
}

export async function getAbnormalOperationById(
  admin: SupabaseClient,
  restaurantId: string,
  id: string,
): Promise<AbnormalOperationRow | null> {
  const { data, error } = await admin
    .from('abnormal_operations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as AbnormalOperationRow;
}

export function canTransitionAbnormalStatus(
  from: AbnormalOperationStatus,
  to: AbnormalOperationStatus,
): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from].includes(to);
}

export async function patchAbnormalOperation(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    id: string;
    ownerId: string;
    status?: AbnormalOperationStatus;
    ownerNote?: string | null;
  },
): Promise<
  | { ok: true; row: AbnormalOperationRow }
  | { ok: false; code: 'not_found' | 'invalid_status' | 'update_failed'; message?: string }
> {
  const existing = await getAbnormalOperationById(admin, params.restaurantId, params.id);
  if (!existing) {
    return { ok: false, code: 'not_found' };
  }

  const nextStatus = params.status ?? existing.status;
  if (!canTransitionAbnormalStatus(existing.status, nextStatus)) {
    return { ok: false, code: 'invalid_status' };
  }

  const patch: Record<string, unknown> = {};
  if (params.status && params.status !== existing.status) {
    patch.status = params.status;
    patch.confirmed_by = params.ownerId;
    patch.confirmed_at = new Date().toISOString();
  }
  if (params.ownerNote !== undefined) {
    patch.owner_note = params.ownerNote;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, row: existing };
  }

  const { data, error } = await admin
    .from('abnormal_operations')
    .update(patch)
    .eq('restaurant_id', params.restaurantId)
    .eq('id', params.id)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return { ok: false, code: 'update_failed', message: error?.message };
  }

  return { ok: true, row: data as AbnormalOperationRow };
}
