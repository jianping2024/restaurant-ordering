import type { OrderItem } from '@/types';

/** Sole display name for order-line staff operation log payloads. */
export function orderItemAuditLabel(
  item: Pick<OrderItem, 'name_zh' | 'name_pt' | 'name' | 'name_en'>,
): string {
  return (
    item.name_zh?.trim() ||
    item.name_pt?.trim() ||
    item.name?.trim() ||
    item.name_en?.trim() ||
    '—'
  );
}
