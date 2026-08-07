import type { KitchenScreen, Order, PrintStation } from '@/types';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export const DEMO_KITCHEN_STATION_HOT = 'demo-station-hot';
export const DEMO_KITCHEN_STATION_GRILL = 'demo-station-grill';

export const DEMO_RESTAURANT = {
  id: 'demo',
  name: 'Casa Portuguesa',
  slug: 'demo',
  kitchen_enabled_station_ids: [DEMO_KITCHEN_STATION_HOT, DEMO_KITCHEN_STATION_GRILL] as string[],
} as const;

const DEMO_TS = '2026-01-01T00:00:00.000Z';

/** Demo kitchen panes (matches station-kitchen-screens board). */
export const DEMO_PRINT_STATIONS: PrintStation[] = [
  {
    id: DEMO_KITCHEN_STATION_HOT,
    restaurant_id: DEMO_RESTAURANT.id,
    name_pt: 'Cozinha',
    name_en: 'Hot kitchen',
    name_zh: '热菜',
    sort_order: 0,
    created_at: DEMO_TS,
    kitchen_enabled: true,
  },
  {
    id: DEMO_KITCHEN_STATION_GRILL,
    restaurant_id: DEMO_RESTAURANT.id,
    name_pt: 'Grelhados',
    name_en: 'Grill',
    name_zh: '烧烤',
    sort_order: 1,
    created_at: DEMO_TS,
    kitchen_enabled: true,
  },
];

export const DEMO_KITCHEN_SCREEN: KitchenScreen = {
  id: 'demo-kitchen-screen-1',
  restaurant_id: DEMO_RESTAURANT.id,
  name: 'Kitchen / 后厨',
  sort_order: 0,
  created_at: DEMO_TS,
  station_ids: [DEMO_KITCHEN_STATION_HOT, DEMO_KITCHEN_STATION_GRILL],
};

function demoTableId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export const DEMO_TABLES: RestaurantTableRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: demoTableId(i + 1),
  display_name: String(i + 1),
  sort_order: i + 1,
  seat_min: 2,
  seat_max: 4,
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
        print_station_id: DEMO_KITCHEN_STATION_HOT,
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
        // Bar / no kitchen pane — omitted from station board.
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
        print_station_id: DEMO_KITCHEN_STATION_GRILL,
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
        print_station_id: DEMO_KITCHEN_STATION_HOT,
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
        print_station_id: DEMO_KITCHEN_STATION_HOT,
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
        print_station_id: DEMO_KITCHEN_STATION_HOT,
      },
    ],
    total_amount: 22.5,
    created_at: new Date(now - 1000 * 60 * 22).toISOString(),
    updated_at: new Date(now - 1000 * 60 * 10).toISOString(),
  },
];

const DEMO_BUFFET_ID = '00000000-0000-4000-8000-00000000b001';

export const DEMO_OPEN_TABLE_DEFAULTS = {
  buffets: [
    {
      id: DEMO_BUFFET_ID,
      restaurant_id: DEMO_RESTAURANT.id,
      name: 'Buffet livre',
      is_active: true,
      description: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  buffetPricesByBuffetId: {
    [DEMO_BUFFET_ID]: {
      adult_price: 19.95,
      child_price: 10,
      rule_id: 'demo-rule-1',
      time_slot_id: 'demo-slot-1',
    },
  },
};
