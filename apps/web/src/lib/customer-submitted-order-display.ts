import { formatCustomerOrderSubmittedTime } from '@/lib/format-dashboard-date';
import { formatOrderItemListLabel } from '@/lib/order-list-display';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import type { UILanguage } from '@/lib/i18n';
import type { Order } from '@/types';

export type CustomerSubmittedOrderLine = {
  key: string;
  label: string;
};

export type CustomerSubmittedOrderGroup = {
  orderId: string;
  submittedTimeLabel: string;
  lines: CustomerSubmittedOrderLine[];
};

/** Read-only submitted-order rows for customer OrderedDrawer — no locale/time in UI components. */
export function buildCustomerSubmittedDisplayOrders(
  orders: Order[],
  lang: UILanguage,
): CustomerSubmittedOrderGroup[] {
  return orders
    .map((order) => {
      const items = order.items ?? [];
      const lines = items.flatMap((item, idx) => {
        if (normalizeOrderItemStatus(item, order.status) === 'voided') return [];
        return [{
          key: `${order.id}-${idx}`,
          label: formatOrderItemListLabel(item, { headcountStyle: 'receipt' }),
        }];
      });

      if (lines.length === 0) return null;

      return {
        orderId: order.id,
        submittedTimeLabel: formatCustomerOrderSubmittedTime(lang, order.created_at),
        lines,
      };
    })
    .filter((group): group is CustomerSubmittedOrderGroup => group !== null);
}
