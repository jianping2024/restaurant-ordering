import type { Order } from '@/types';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export const DEMO_RESTAURANT = {
  id: 'demo',
  name: 'Casa Portuguesa',
  slug: 'demo',
} as const;

function demoTableId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export const DEMO_TABLES: RestaurantTableRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: demoTableId(i + 1),
  display_name: String(i + 1),
  sort_order: i + 1,
}));

export function demoTableByDisplayName(name: string): RestaurantTableRow | undefined {
  return DEMO_TABLES.find((t) => t.display_name === name);
}

const now = Date.now();

export const DEMO_ORDERS: Order[] = [
  {
    id: 'demo-order-1',
    restaurant_id: 'demo',
    session_id: 'demo-session-1',
    table_id: demoTableId(5),
    display_name: '5',
    status: 'pending',
    items: [
      {
        id: 'd5',
        name: 'Bacalhau a Bras',
        name_pt: 'Bacalhau a Bras',
        qty: 1,
        note: 'Less salt',
        price: 18.5,
        emoji: '🥚',
        item_status: 'pending',
        batch_id: 'batch-a',
        added_at: new Date(now - 1000 * 60 * 4).toISOString(),
      },
      {
        id: 'd10',
        name: 'House Red Wine',
        name_pt: 'Vinho Tinto da Casa',
        qty: 2,
        price: 4,
        emoji: '🍷',
        item_status: 'pending',
        batch_id: 'batch-a',
        added_at: new Date(now - 1000 * 60 * 4).toISOString(),
      },
    ],
    total_amount: 26.5,
    created_at: new Date(now - 1000 * 60 * 7).toISOString(),
    updated_at: new Date(now - 1000 * 60 * 4).toISOString(),
  },
  {
    id: 'demo-order-2',
    restaurant_id: 'demo',
    session_id: 'demo-session-2',
    table_id: demoTableId(2),
    display_name: '2',
    status: 'cooking',
    items: [
      {
        id: 'd6',
        name: 'BBQ Chicken',
        name_pt: 'Frango no Churrasco',
        qty: 1,
        price: 15,
        emoji: '🍗',
        item_status: 'done',
        batch_id: 'batch-b',
        started_at: new Date(now - 1000 * 60 * 14).toISOString(),
        done_at: new Date(now - 1000 * 60 * 6).toISOString(),
        added_at: new Date(now - 1000 * 60 * 15).toISOString(),
      },
      {
        id: 'd7',
        name: 'Octopus Lagareiro',
        name_pt: 'Polvo a Lagareiro',
        qty: 1,
        note: 'No onion',
        price: 22,
        emoji: '🐙',
        item_status: 'cooking',
        batch_id: 'batch-c',
        started_at: new Date(now - 1000 * 60 * 4).toISOString(),
        added_at: new Date(now - 1000 * 60 * 5).toISOString(),
      },
    ],
    total_amount: 37,
    created_at: new Date(now - 1000 * 60 * 16).toISOString(),
    updated_at: new Date(now - 1000 * 60 * 2).toISOString(),
  },
  {
    id: 'demo-order-3',
    restaurant_id: 'demo',
    session_id: 'demo-session-3',
    table_id: demoTableId(8),
    display_name: '8',
    status: 'done',
    items: [
      {
        id: 'd9',
        name: 'Duck Rice',
        name_pt: 'Arroz de Pato',
        qty: 1,
        price: 17.5,
        emoji: '🦆',
        item_status: 'done',
        batch_id: 'batch-d',
        started_at: new Date(now - 1000 * 60 * 18).toISOString(),
        done_at: new Date(now - 1000 * 60 * 11).toISOString(),
        added_at: new Date(now - 1000 * 60 * 20).toISOString(),
      },
      {
        id: 'd14',
        name: 'Custard Tart',
        name_pt: 'Pastel de Nata',
        qty: 2,
        price: 2.5,
        emoji: '🥧',
        item_status: 'done',
        batch_id: 'batch-d',
        done_at: new Date(now - 1000 * 60 * 11).toISOString(),
        added_at: new Date(now - 1000 * 60 * 20).toISOString(),
      },
    ],
    total_amount: 22.5,
    created_at: new Date(now - 1000 * 60 * 22).toISOString(),
    updated_at: new Date(now - 1000 * 60 * 10).toISOString(),
  },
];
