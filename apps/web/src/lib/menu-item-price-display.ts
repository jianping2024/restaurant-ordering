import { isSushiRoundFreeMenuPrice } from '@/lib/table-order-round/settings';

/**
 * Sole customer-facing price label for catalog card + item detail.
 * When `treatZeroAsFree`, sushi round free dishes show `freeLabel` instead of €0.00.
 */
export function formatCustomerMenuItemPrice(
  price: number,
  options: { freeLabel: string; treatZeroAsFree: boolean },
): string {
  if (options.treatZeroAsFree && isSushiRoundFreeMenuPrice(price)) {
    return options.freeLabel;
  }
  const n = Number(price);
  const safe = Number.isFinite(n) ? n : 0;
  return `€${safe.toFixed(2)}`;
}
