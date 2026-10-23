/**
 * Open-time locked buffet unit prices — kept outside {@link buffet-order} so client
 * checkout hosts can import merge without hitting the billable↔sushi↔buffet-order cycle
 * that left `mergeBuffetPricesPreferLocked` undefined at call time.
 */
import {
  activeBuffetLineByBuffetId,
  type ResolvedBuffetPriceRow,
} from '@/lib/buffet-order';
import type { Order, OrderItem } from '@/types';

/**
 * Sole read of open-time locked unit prices from an active buffet_base line.
 * Null when adult/child unit prices are missing or not finite.
 */
export function resolvedBuffetPriceFromLockedLine(
  line: Pick<OrderItem, 'adult_unit_price' | 'child_unit_price' | 'price_rule_id'>,
): ResolvedBuffetPriceRow | null {
  const adultPrice = line.adult_unit_price;
  const childPrice = line.child_unit_price;
  if (adultPrice == null || childPrice == null) return null;
  const adult = Number(adultPrice);
  const child = Number(childPrice);
  if (!Number.isFinite(adult) || !Number.isFinite(child)) return null;
  return {
    adult_price: adult,
    child_price: child,
    rule_id: line.price_rule_id ?? null,
    time_slot_id: null,
  };
}

/** Sole map: buffet_id → locked open-time prices from latest active buffet_base lines. */
export function resolvedBuffetPricesFromOrders(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): Record<string, ResolvedBuffetPriceRow> {
  const out: Record<string, ResolvedBuffetPriceRow> = {};
  for (const [buffetId, line] of Array.from(activeBuffetLineByBuffetId(orders).entries())) {
    const locked = resolvedBuffetPriceFromLockedLine(line);
    if (locked) out[buffetId] = locked;
  }
  return out;
}

/**
 * Display/write price map: locked open-time unit prices win over live RPC rows
 * for the same buffet_id (never re-slot a package that already locked at open).
 */
export function mergeBuffetPricesPreferLocked(
  liveByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
  orders: Array<Pick<Order, 'items' | 'status'>>,
): Record<string, ResolvedBuffetPriceRow | null> {
  return {
    ...liveByBuffetId,
    ...resolvedBuffetPricesFromOrders(orders),
  };
}
