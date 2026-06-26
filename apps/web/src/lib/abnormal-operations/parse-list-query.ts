import type {
  AbnormalOperationStatus,
  AbnormalOperationType,
  AbnormalRiskLevel,
} from '@/lib/abnormal-operations/types';
import type { AbnormalOperationsListFilters } from '@/lib/abnormal-operations/owner-query';

const TYPES = new Set<AbnormalOperationType>([
  'DISCOUNT_APPLIED',
  'ITEM_DELETED',
  'UNPAID_TABLE_CLOSED',
]);
const RISKS = new Set<AbnormalRiskLevel>(['LOW', 'MEDIUM', 'HIGH']);
const STATUSES = new Set<AbnormalOperationStatus>(['PENDING', 'CONFIRMED', 'IGNORED']);

export function parseAbnormalOperationsListQuery(
  searchParams: URLSearchParams,
  restaurantId: string,
): AbnormalOperationsListFilters {
  const typeRaw = searchParams.get('type')?.trim();
  const riskRaw = searchParams.get('risk_level')?.trim();
  const statusRaw = searchParams.get('status')?.trim();
  const pageRaw = searchParams.get('page');
  const pageSizeRaw = searchParams.get('page_size');

  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : 20;

  return {
    restaurantId,
    startDate: searchParams.get('start_date')?.trim() || undefined,
    endDate: searchParams.get('end_date')?.trim() || undefined,
    type: typeRaw && TYPES.has(typeRaw as AbnormalOperationType)
      ? (typeRaw as AbnormalOperationType)
      : undefined,
    riskLevel: riskRaw && RISKS.has(riskRaw as AbnormalRiskLevel)
      ? (riskRaw as AbnormalRiskLevel)
      : undefined,
    operatorId: searchParams.get('operator_id')?.trim() || undefined,
    tableId: searchParams.get('table_id')?.trim() || undefined,
    status: statusRaw && STATUSES.has(statusRaw as AbnormalOperationStatus)
      ? (statusRaw as AbnormalOperationStatus)
      : undefined,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
  };
}
