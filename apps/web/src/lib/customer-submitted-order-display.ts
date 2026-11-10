import { formatCustomerOrderSubmittedTime } from '@/lib/format-dashboard-date';
import {
  formatOrderItemQuantityLabel,
} from '@/lib/order-list-display';
import {
  resolveKitchenItemProgressLabel,
  type CustomerKitchenProgress,
} from '@/lib/kitchen-progress-display';
import { isBuffetBaseItem, isKitchenRemakeItem, orderBatchDisplayGroupKey, orderItemBatchKey } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { KITCHEN_READY_AFTER_MINUTES_DEFAULT } from '@/lib/print-agent-config';
import { stationTicketOrderTimeIso } from '@/lib/table-guest-count';
import {
  resolvePeerFloatThumb,
  type PeerFloatThumb,
} from '@/lib/table-order-round/sushi-peer-float-display';
import type { UILanguage } from '@/lib/i18n';
import type { MenuItem, Order, OrderItem } from '@/types';

export type CustomerSubmittedOrderLine = {
  key: string;
  /** Localized dish name only — qty and unit price are separate fields. */
  label: string;
  /** Menu `× N` or buffet `· A-C` (receipt); empty string when none. */
  quantityLabel: string;
  /**
   * Unit price for non-buffet lines (`OrderItem.price`).
   * Null for `buffet_base` — that row’s `price` is the headcount line total, not a unit.
   */
  unitPrice: number | null;
  thumb: PeerFloatThumb;
  /** Wire note on the order line (choice labels + presets + free text); null when empty. */
  note: string | null;
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

type OrderedMenuThumb = Pick<MenuItem, 'id' | 'image_url' | 'emoji'>;

export type BuildCustomerSubmittedDisplayOptions = {
  kitchenProgress?: CustomerKitchenProgress | null;
  nowMs?: number;
  /** Live catalog. Photo and emoji come from here when the dish is still on the menu. */
  menuItems?: readonly OrderedMenuThumb[];
};

function guestSubmittedUnitPrice(item: Pick<OrderItem, 'kind' | 'price'>): number | null {
  if (isBuffetBaseItem(item)) return null;
  const price = Number(item.price);
  return Number.isFinite(price) ? price : null;
}

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
  const menuById = new Map((options.menuItems ?? []).map((row) => [row.id, row]));

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
            printStationIds: item.print_station_ids,
            printStationId: item.print_station_id,
            kitchenEnabledStationIds: enabledIds,
          })
        : null;

      const noteRaw = typeof item.note === 'string' ? item.note.trim() : '';
      bucket.lines.push({
        key: `${order.id}-${idx}`,
        label: resolveMenuItemLocalizedName(item, lang),
        quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'receipt' }),
        unitPrice: guestSubmittedUnitPrice(item),
        thumb: resolvePeerFloatThumb({
          menu: menuById.get(item.id),
          fallbackEmoji: item.emoji,
        }),
        note: noteRaw.length > 0 ? noteRaw : null,
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
