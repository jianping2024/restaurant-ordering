import { formatOrderItemListLabel } from '@/lib/order-list-display';
import type { CustomerSubmittedOrderGroup } from '@/lib/customer-submitted-order-display';
import type { TableOrderRoundLineRow } from '@/lib/table-order-round/types';
import type { Language, MenuItem } from '@/types';

function lineToDisplay(
  line: TableOrderRoundLineRow,
  byId: Map<string, MenuItem>,
  lang: Language,
): CustomerSubmittedOrderGroup['lines'][number] {
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
}

/**
 * Sole round-review list builder: whole-table lines, one block per guest_client_id.
 * Own block labeled (e.g. 我); other blocks use empty divider label (dashed only).
 */
export function buildTableRoundReviewGroups(params: {
  lines: TableOrderRoundLineRow[];
  guestClientId: string;
  menuItems: MenuItem[];
  lang: Language;
  ownBlockLabel: string;
}): CustomerSubmittedOrderGroup[] {
  const { lines, guestClientId, menuItems, lang, ownBlockLabel } = params;
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const active = lines.filter((l) => (Number(l.qty) || 0) > 0);
  if (active.length === 0) return [];

  const earliestByClient = new Map<string, number>();
  for (const line of active) {
    const t = Date.parse(line.added_at) || 0;
    const prev = earliestByClient.get(line.guest_client_id);
    if (prev === undefined || t < prev) earliestByClient.set(line.guest_client_id, t);
  }

  const clients = Array.from(earliestByClient.keys()).sort((a, b) => {
    if (a === guestClientId) return -1;
    if (b === guestClientId) return 1;
    return (earliestByClient.get(a) ?? 0) - (earliestByClient.get(b) ?? 0);
  });

  return clients.map((clientId) => {
    const clientLines = active.filter((l) => l.guest_client_id === clientId);
    return {
      groupKey: `round-${clientId}`,
      submittedTimeLabel: clientId === guestClientId ? ownBlockLabel : '',
      lines: clientLines.map((line) => lineToDisplay(line, byId, lang)),
    };
  });
}
