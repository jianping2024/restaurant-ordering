import { formatOrderItemListLabel } from '@/lib/order-list-display';
import type { CustomerSubmittedOrderGroup } from '@/lib/customer-submitted-order-display';
import type { TableOrderRoundLineRow } from '@/lib/table-order-round/types';
import type { Language, MenuItem } from '@/types';

/** Own-client round lines as the same list rows as 查看已点 (no kitchen status, no other guests). */
export function buildOwnRoundReviewGroups(params: {
  lines: TableOrderRoundLineRow[];
  guestClientId: string;
  menuItems: MenuItem[];
  lang: Language;
}): CustomerSubmittedOrderGroup[] {
  const { lines, guestClientId, menuItems, lang } = params;
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const own = lines.filter((l) => l.guest_client_id === guestClientId && (Number(l.qty) || 0) > 0);
  if (own.length === 0) return [];

  return [
    {
      groupKey: 'round-own',
      submittedTimeLabel: '',
      lines: own.map((line) => {
        const item = byId.get(line.menu_item_id);
        const label = formatOrderItemListLabel(
          {
            emoji: item?.emoji || '🍽️',
            name: item?.name_pt || '',
            name_pt: item?.name_pt || '',
            name_en: item?.name_en || '',
            name_zh: item?.name_zh || '',
            qty: line.qty,
          },
          lang,
        );
        const note = (line.note ?? '').trim();
        return {
          key: line.id,
          label,
          statusLabel: note || null,
        };
      }),
    },
  ];
}
