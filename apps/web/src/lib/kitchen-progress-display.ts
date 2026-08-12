/**
 * Multi-end kitchen line progress (guest / floor / kitchen): one show-gate + one label map.
 * Status values always come from effectiveItemStatus — never a parallel clock mapping.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderItem, OrderItemStatus } from '@/types';
import type { UILanguage } from '@/lib/i18n';
import {
  effectiveItemStatus,
  type EffectiveItemStatusInput,
} from '@/lib/order-status';

/** Same product copy as kitchen screen status chips (one representation). */
export const KITCHEN_ITEM_STATUS_LABEL: Record<
  UILanguage,
  Record<'pending' | 'cooking' | 'ready' | 'done', string>
> = {
  zh: { pending: '已下单', cooking: '已备餐', ready: '已出餐', done: '已上桌' },
  en: { pending: 'Ordered', cooking: 'Prepped', ready: 'Ready', done: 'Served' },
  pt: { pending: 'Pedido', cooking: 'Preparado', ready: 'Pronto', done: 'Servido' },
  es: { pending: 'Pedido', cooking: 'Preparado', ready: 'Listo', done: 'Servido' },
  fr: { pending: 'Commande', cooking: 'Prepare', ready: 'Pret', done: 'Servi' },
  de: { pending: 'Bestellt', cooking: 'Vorbereitet', ready: 'Fertig', done: 'Serviert' },
};

export type CustomerKitchenProgress = {
  ready_after_minutes: number;
  enabled_station_ids: string[];
};

export function kitchenItemProgressLabel(
  lang: UILanguage,
  status: OrderItemStatus,
): string | null {
  if (status !== 'pending' && status !== 'cooking' && status !== 'ready' && status !== 'done') {
    return null;
  }
  const table = KITCHEN_ITEM_STATUS_LABEL[lang] ?? KITCHEN_ITEM_STATUS_LABEL.en;
  return table[status];
}

/** Show progress only for kitchen-enabled stations (or mid-flight lines if binding flipped). */
export function shouldShowKitchenItemProgress(args: {
  printStationId: string | null | undefined;
  kitchenEnabledStationIds: ReadonlySet<string> | readonly string[];
  item: Pick<OrderItem, 'item_status' | 'started_at'>;
}): boolean {
  const ids =
    args.kitchenEnabledStationIds instanceof Set
      ? args.kitchenEnabledStationIds
      : new Set(args.kitchenEnabledStationIds);
  if (args.printStationId && ids.has(args.printStationId)) return true;
  const stored = args.item.item_status;
  return (
    stored === 'cooking' ||
    stored === 'ready' ||
    stored === 'done' ||
    Boolean(args.item.started_at)
  );
}

export function resolveKitchenItemProgressLabel(
  args: EffectiveItemStatusInput & {
    lang: UILanguage;
    printStationId: string | null | undefined;
    kitchenEnabledStationIds: ReadonlySet<string> | readonly string[];
  },
): string | null {
  if (
    !shouldShowKitchenItemProgress({
      printStationId: args.printStationId,
      kitchenEnabledStationIds: args.kitchenEnabledStationIds,
      item: args.item,
    })
  ) {
    return null;
  }
  return kitchenItemProgressLabel(args.lang, effectiveItemStatus(args));
}

export async function loadKitchenEnabledStationIds(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string[]> {
  const { data } = await admin
    .from('print_stations')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('kitchen_enabled', true);
  return (data || []).map((row) => row.id as string);
}
