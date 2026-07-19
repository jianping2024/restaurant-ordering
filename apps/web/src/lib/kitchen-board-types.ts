import type { OrderItem, OrderStatus } from '@/types';

/** Wire table meta for kitchen board — seats unused on this surface. */
export type KitchenBoardTable = {
  id: string;
  display_name: string;
  sort_order: number;
};

/**
 * Kitchen board order. `items` stays a full OrderItem[] because PATCH replaces the
 * whole array (write-safe superset).
 */
export type KitchenBoardOrder = {
  id: string;
  table_id: string;
  display_name: string;
  status: Extract<OrderStatus, 'pending' | 'cooking'>;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

export type KitchenBoardData = {
  orders: KitchenBoardOrder[];
  activeTableIds: string[];
  tables: KitchenBoardTable[];
};

type KitchenBoardOrderRow = {
  id: string;
  table_id: string;
  display_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[] | null;
  session_id?: string | null;
};

export function toKitchenBoardOrder(order: KitchenBoardOrderRow): KitchenBoardOrder | null {
  if (order.status !== 'pending' && order.status !== 'cooking') return null;
  return {
    id: order.id,
    table_id: order.table_id,
    display_name: order.display_name,
    status: order.status,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: order.items || [],
  };
}

export function toKitchenBoardTable(row: {
  id: string;
  display_name: string;
  sort_order: number;
}): KitchenBoardTable {
  return {
    id: row.id,
    display_name: row.display_name,
    sort_order: row.sort_order,
  };
}
