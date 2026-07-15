import { formatCustomerOrderSubmittedTime } from '@/lib/format-dashboard-date';
import { formatOrderItemListLabel } from '@/lib/order-list-display';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { orderItemBatchKey } from '@/lib/station-ticket-enqueue';
import { stationTicketOrderTimeIso } from '@/lib/table-guest-count';
import type { UILanguage } from '@/lib/i18n';
import type { Order, OrderItem } from '@/types';

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
  batchKey: string;
  fallbackIso: string;
  lines: CustomerSubmittedOrderLine[];
  items: OrderItem[];
  sortIso: string;
};

function displayBatchGroupKey(orderId: string, batchKey: string): string {
  return batchKey === 'legacy' ? `${orderId}:legacy` : batchKey;
}

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
      const groupKey = displayBatchGroupKey(order.id, batchKey);
      let bucket = buckets.get(groupKey);
      if (!bucket) {
        const sortIso = stationTicketOrderTimeIso(items, batchKey, order.created_at);
        bucket = {
          groupKey,
          batchKey,
          fallbackIso: order.created_at,
          lines: [],
          items: [],
          sortIso,
        };
        buckets.set(groupKey, bucket);
      }

      bucket.items.push(item);
      bucket.lines.push({
        key: `${order.id}-${idx}`,
        label: formatOrderItemListLabel(item, { headcountStyle: 'receipt' }),
      });
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.sortIso.localeCompare(b.sortIso))
    .map((bucket) => ({
      groupKey: bucket.groupKey,
      submittedTimeLabel: formatCustomerOrderSubmittedTime(
        lang,
        stationTicketOrderTimeIso(bucket.items, bucket.batchKey, bucket.fallbackIso),
      ),
      lines: bucket.lines,
    }));
}
