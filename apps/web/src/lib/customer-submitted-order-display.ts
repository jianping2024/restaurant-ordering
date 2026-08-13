import { formatCustomerOrderSubmittedTime } from '@/lib/format-dashboard-date';
import { formatOrderItemListLabel } from '@/lib/order-list-display';
import {
  resolveKitchenItemProgressLabel,
  type CustomerKitchenProgress,
} from '@/lib/kitchen-progress-display';
import { isKitchenRemakeItem, orderBatchDisplayGroupKey, orderItemBatchKey } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { KITCHEN_READY_AFTER_MINUTES_DEFAULT } from '@/lib/print-agent-config';
import { stationTicketOrderTimeIso } from '@/lib/table-guest-count';
import type { UILanguage } from '@/lib/i18n';
import type { Order } from '@/types';

export type CustomerSubmittedOrderLine = {
  key: string;
  label: string;
  /** Kitchen-enabled station progress (effective status); null for non-kitchen lines. */
  statusLabel: string | null;
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

export type BuildCustomerSubmittedDisplayOptions = {
  kitchenProgress?: CustomerKitchenProgress | null;
  nowMs?: number;
};

/** Read-only submitted-order rows grouped by append batch — no locale/time in UI components. */
export function buildCustomerSubmittedDisplayOrders(
  orders: Order[],
  lang: UILanguage,
  options: BuildCustomerSubmittedDisplayOptions = {},
): CustomerSubmittedOrderGroup[] {
  const buckets = new Map<string, BatchBucket>();
  const kitchenProgress = options.kitchenProgress ?? null;
  const enabledIds = kitchenProgress?.enabled_station_ids ?? [];
  const readyAfterMinutes =
    kitchenProgress?.ready_after_minutes ?? KITCHEN_READY_AFTER_MINUTES_DEFAULT;
  const nowMs = options.nowMs ?? Date.now();

  for (const order of orders) {
    const items = order.items ?? [];
    for (let idx = 0; idx < items.length; idx += 1) {
      const item = items[idx];
      if (isKitchenRemakeItem(item)) continue;
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

      const statusLabel = kitchenProgress
        ? resolveKitchenItemProgressLabel({
            lang,
            item,
            orderStatus: order.status,
            nowMs,
            readyAfterMinutes,
            printStationId: item.print_station_id,
            kitchenEnabledStationIds: enabledIds,
          })
        : null;

      bucket.lines.push({
        key: `${order.id}-${idx}`,
        label: formatOrderItemListLabel(item, lang, { headcountStyle: 'receipt' }),
        statusLabel,
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
