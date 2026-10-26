import { formatOrderItemNameLabel } from '@/lib/order-list-display';
import type { TableOrderRoundLineRow } from '@/lib/table-order-round/types';
import { isKitchenRemakeItem, isMenuCatalogItem } from '@/lib/order-items';
import type { Language, MenuItem, Order } from '@/types';

export type RoundReviewLine = {
  key: string;
  lineId: string;
  menuItemId: string;
  label: string;
  note: string;
  qty: number;
  editable: boolean;
};

export type RoundReviewGroup = {
  groupKey: string;
  /** Own block label (e.g. 我); peers use empty string (dashed divider only). */
  submittedTimeLabel: string;
  lines: RoundReviewLine[];
};

/**
 * Sole round-review list builder: whole-table lines, one block per guest_client_id.
 * Labels are name-only (qty lives in CartQtyStepper for own rows).
 */
export function buildTableRoundReviewGroups(params: {
  lines: TableOrderRoundLineRow[];
  guestClientId: string;
  menuItems: MenuItem[];
  lang: Language;
  ownBlockLabel: string;
  /** When false, own rows render qty read-only (cooldown / finalize_failed). */
  ownLinesEditable?: boolean;
}): RoundReviewGroup[] {
  const {
    lines,
    guestClientId,
    menuItems,
    lang,
    ownBlockLabel,
    ownLinesEditable = true,
  } = params;
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
    const isOwn = clientId === guestClientId;
    const clientLines = active.filter((l) => l.guest_client_id === clientId);
    return {
      groupKey: `round-${clientId}`,
      submittedTimeLabel: isOwn ? ownBlockLabel : '',
      lines: clientLines.map((line) => {
        const item = byId.get(line.menu_item_id);
        const label = formatOrderItemNameLabel(
          {
            emoji: item?.emoji || '🍽️',
            name: item?.name_pt || '',
            name_pt: item?.name_pt || '',
            name_en: item?.name_en || '',
            name_zh: item?.name_zh || '',
          },
          lang,
        );
        const note = (line.note ?? '').trim();
        const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
        return {
          key: line.id,
          lineId: line.id,
          menuItemId: line.menu_item_id,
          label,
          note,
          qty,
          editable: isOwn && ownLinesEditable,
        };
      }),
    };
  });
}

/** Read-only paid row shown in round review (already sent on submit — never in the round). */
export type RoundReviewPaidSentLine = {
  key: string;
  label: string;
  note: string;
  qty: number;
};

/**
 * Sole round-review「收费菜 · 已直接送厨」rows: whole-table paid catalog lines
 * appended since the active round started. Paid dishes never join the round
 * (contract §2.2); this only answers "where did my paid dish go" — not counted,
 * not editable, not part of send.
 */
export function buildRoundPaidSentLines(params: {
  orders: readonly Order[];
  /** Active round `created_at`; null (no active round) → no rows. */
  roundStartedAt: string | null | undefined;
  lang: Language;
}): RoundReviewPaidSentLine[] {
  const startedAtMs = params.roundStartedAt ? Date.parse(params.roundStartedAt) : NaN;
  if (!Number.isFinite(startedAtMs)) return [];

  const rows: { row: RoundReviewPaidSentLine; addedAtMs: number }[] = [];
  for (const order of params.orders) {
    order.items.forEach((line, index) => {
      if (!isMenuCatalogItem(line) || isKitchenRemakeItem(line)) return;
      if (line.item_status === 'voided') return;
      if (!(Number(line.price) > 0)) return;
      const addedAtMs = line.added_at ? Date.parse(line.added_at) : NaN;
      if (!Number.isFinite(addedAtMs) || addedAtMs < startedAtMs) return;
      const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
      if (qty < 1) return;
      rows.push({
        addedAtMs,
        row: {
          key: `${order.id}:${index}`,
          label: formatOrderItemNameLabel(line, params.lang),
          note: (line.note ?? '').trim(),
          qty,
        },
      });
    });
  }
  return rows.sort((a, b) => a.addedAtMs - b.addedAtMs).map((r) => r.row);
}
