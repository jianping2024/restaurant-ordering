import { formatCustomerOrderSubmittedTime } from '@/lib/format-dashboard-date';
import { formatOrderItemListLabel } from '@/lib/order-list-display';
import { orderBatchDisplayGroupKey, orderItemBatchKey } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { stationTicketOrderTimeIso } from '@/lib/table-guest-count';
import type { UILanguage } from '@/lib/i18n';
import type { Order } from '@/types';

export type CustomerSubmittedOrderLine = {
  key: string;
  label: string;
};

export type CustomerSubmittedOrderGroup = {
  groupKey: string;
  submittedTimeLabel: string;
  lines: CustomerSubmittedOrderLine[];
};

type BatchBucket = {
  groupKey: string;
  submittedTimeIso: string;
  lines: CustomerSubmittedOrderLine[];
};

/** Read-only submitted-order rows grouped by append batch — no locale/time in UI components. */
export function buildCustomerSubmittedDisplayOrders(
  orders: Order[],
  lang: UILanguage,
): CustomerSubmittedOrderGroup[] {
  const buckets = new Map<string, BatchBucket>();

  for (const order of orders) {
    const items = order.items ?? [];
    for (let idx = 0; idx < items.length; idx += 1) {
      const item = items[idx];
      if (normalizeOrderItemStatus(item, order.status) === 'voided') continue;

      const batchKey = orderItemBatchKey(item);
      const groupKey = orderBatchDisplayGroupKey(order.id, batchKey);
      let bucket = buckets.get(groupKey);
      if (!bucket) {
        bucket = {
          groupKey,
          submittedTimeIso: stationTicketOrderTimeIso(items, batchKey, order.created_at),
          lines: [],
        };
        buckets.set(groupKey, bucket);
      }

      bucket.lines.push({
        key: `${order.id}-${idx}`,
        label: formatOrderItemListLabel(item, { headcountStyle: 'receipt' }),
      });
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.submittedTimeIso.localeCompare(b.submittedTimeIso))
    .map((bucket) => ({
      groupKey: bucket.groupKey,
      submittedTimeLabel: formatCustomerOrderSubmittedTime(lang, bucket.submittedTimeIso),
      lines: bucket.lines,
    }));
}
