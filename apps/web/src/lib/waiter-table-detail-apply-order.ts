import type { WaiterTableDetailData } from '@/lib/waiter-table-detail-types';
import type { Order } from '@/types';

/** Merge an authoritative order row returned by staff mutation APIs into table detail state. */
export function applyOrderUpdateToWaiterDetail(
  detail: WaiterTableDetailData,
  updatedOrder: Order,
): WaiterTableDetailData {
  const index = detail.orders.findIndex((row) => row.id === updatedOrder.id);
  const orders =
    index >= 0
      ? detail.orders.map((row, i) => (i === index ? updatedOrder : row))
      : [...detail.orders, updatedOrder];
  return { ...detail, orders };
}
