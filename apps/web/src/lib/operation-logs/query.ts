import type { SupabaseClient } from '@supabase/supabase-js';
import {
  OPERATION_LOG_ACTION_TYPES,
  type OperationLogActionType,
} from '@/lib/audit/types';
import { parseAbnormalOperationsDateRange } from '@/lib/abnormal-operations/owner-query';
import { LIST_DEFAULT_PAGE_SIZE } from '@/lib/paginate-list';
import type { OperationLogRow } from '@/lib/operation-logs/types';

export type OperationLogsListFilters = {
  restaurantId: string;
  startDate?: string;
  endDate?: string;
  actionType?: OperationLogActionType;
  page?: number;
  pageSize?: number;
  now?: Date;
};

export type OperationLogsListResult = {
  items: OperationLogRow[];
  page: number;
  pageSize: number;
  total: number;
};

export async function listOperationLogs(
  admin: SupabaseClient,
  filters: OperationLogsListFilters,
): Promise<
  | { ok: true; result: OperationLogsListResult }
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

  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? LIST_DEFAULT_PAGE_SIZE));
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from('operation_logs')
    .select(
      'id, restaurant_id, action_type, entity_type, entity_id, operator_id, operator_name, operator_role, before_data, after_data, reason, reason_detail, created_at',
      { count: 'exact' },
    )
    .eq('restaurant_id', filters.restaurantId)
    .gte('created_at', parsed.startUtc)
    .lt('created_at', parsed.endExclusiveUtc)
    .in('action_type', [...OPERATION_LOG_ACTION_TYPES])
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.actionType) {
    query = query.eq('action_type', filters.actionType);
  }

  const { data, error, count } = await query;
  if (error) {
    return { ok: false, code: 'query_failed', message: error.message };
  }

  return {
    ok: true,
    result: {
      items: (data || []) as OperationLogRow[],
      page,
      pageSize,
      total: count ?? 0,
    },
  };
}
