import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

/** One formatter for staff + guest chargeable-share hints (`bill.chargeableHint`). */
export function formatChargeableShareHint(
  lang: UILanguage,
  qty: number,
  unitPrice: number,
): string {
  return getMessages(lang)
    .bill.chargeableHint.replace('{qty}', String(qty))
    .replace('{price}', unitPrice.toFixed(2));
}
