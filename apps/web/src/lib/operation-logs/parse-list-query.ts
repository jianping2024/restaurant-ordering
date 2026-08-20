import {
  isOperationLogActionType,
  type OperationLogActionType,
} from '@/lib/audit/types';
import type { OperationLogsListQueryParams } from '@/lib/operation-logs/query';
import { normalizeOperationLogsSearchQ } from '@/lib/operation-logs/search';
import { LIST_DEFAULT_PAGE_SIZE } from '@/lib/paginate-list';

export function parseOperationLogsListQuery(
  searchParams: URLSearchParams,
  restaurantId: string,
): OperationLogsListQueryParams {
  const actionRaw = searchParams.get('action_type')?.trim();
  const pageRaw = searchParams.get('page');
  const pageSizeRaw = searchParams.get('page_size');
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  const pageSize = pageSizeRaw
    ? Number.parseInt(pageSizeRaw, 10)
    : LIST_DEFAULT_PAGE_SIZE;

  return {
    restaurantId,
    date: searchParams.get('date')?.trim() || undefined,
    actionType:
      actionRaw && isOperationLogActionType(actionRaw)
        ? (actionRaw as OperationLogActionType)
        : undefined,
    q: normalizeOperationLogsSearchQ(searchParams.get('q')),
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : LIST_DEFAULT_PAGE_SIZE,
  };
}
