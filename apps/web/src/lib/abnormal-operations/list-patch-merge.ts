import type { AbnormalOperationsListResult } from '@/lib/abnormal-operations/owner-query';
import type {
  AbnormalOperationRow,
  AbnormalOperationStatus,
} from '@/lib/abnormal-operations/types';

/** Apply PATCH response to the current list page without refetching. */
export function mergePatchedAbnormalOperationRow(
  data: AbnormalOperationsListResult,
  previous: AbnormalOperationRow,
  updated: AbnormalOperationRow,
  statusFilter: AbnormalOperationStatus | '' = '',
): AbnormalOperationsListResult {
  const rowLeavesFilteredView =
    !!statusFilter && updated.status !== statusFilter;

  const items = rowLeavesFilteredView
    ? data.items.filter((row) => row.id !== updated.id)
    : data.items.map((row) => (row.id === updated.id ? updated : row));

  let pendingDelta = 0;
  if (previous.status === 'PENDING' && updated.status !== 'PENDING') pendingDelta = -1;
  if (previous.status !== 'PENDING' && updated.status === 'PENDING') pendingDelta = 1;

  const totalDelta = rowLeavesFilteredView ? -1 : 0;

  return {
    ...data,
    items,
    total: data.total + totalDelta,
    stats: {
      ...data.stats,
      total_count: data.stats.total_count + totalDelta,
      pending_count: data.stats.pending_count + pendingDelta,
    },
  };
}
