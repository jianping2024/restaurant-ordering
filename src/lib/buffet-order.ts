import type { Buffet, OrderItem } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';

export function stripBuffetBaseLines(items: OrderItem[]): OrderItem[] {
  return items.filter((i) => !isBuffetBaseItem(i));
}

export interface ResolvedBuffetPriceRow {
  adult_price: number | null;
  child_price: number | null;
  rule_id: string | null;
  time_slot_id: string | null;
}

export function buildBuffetBaseLine(params: {
  buffet: Pick<Buffet, 'id' | 'name'>;
  adultCount: number;
  childCount: number;
  resolved: ResolvedBuffetPriceRow;
}): OrderItem | null {
  const ap = params.resolved.adult_price;
  const cp = params.resolved.child_price;
  if (ap == null || cp == null) return null;
  const adults = Math.max(0, Math.floor(params.adultCount));
  const children = Math.max(0, Math.floor(params.childCount));
  if (adults + children <= 0) return null;

  const lineTotal = adults * Number(ap) + children * Number(cp);
  const addedAt = new Date().toISOString();

  return {
    id: `buffet:${params.buffet.id}`,
    kind: 'buffet_base',
    name: params.buffet.name,
    name_pt: params.buffet.name,
    qty: 1,
    price: lineTotal,
    emoji: '🍽️',
    item_status: 'done',
    buffet_id: params.buffet.id,
    adult_count: adults,
    child_count: children,
    adult_unit_price: Number(ap),
    child_unit_price: Number(cp),
    price_rule_id: params.resolved.rule_id || undefined,
    added_at: addedAt,
    batch_id: '__buffet__',
  };
}
