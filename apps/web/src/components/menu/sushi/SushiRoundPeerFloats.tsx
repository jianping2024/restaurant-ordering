'use client';

import { useEffect, useRef, useState } from 'react';
import { formatOrderItemListLabel } from '@/lib/order-list-display';
import { isBuffetBaseItem, isKitchenRemakeItem } from '@/lib/order-items';
import type { TableOrderRoundLineRow } from '@/lib/table-order-round/types';
import type { Language, MenuItem, Order } from '@/types';

type FloatItem = {
  id: string;
  text: string;
};

const MAX_VISIBLE = 4;
/** Sole peer-float hold duration (free round + paid append). */
export const SUSHI_PEER_FLOAT_HOLD_MS = 5500;

/** Sole peer-order float rail: other guests' free round upserts + paid appends. */
export function SushiRoundPeerFloats(params: {
  lines: TableOrderRoundLineRow[];
  guestClientId: string;
  menuItems: MenuItem[];
  lang: Language;
  enabled: boolean;
  recentOrders?: Order[];
  /** Batch ids this device just appended — exclude from paid floats. */
  selfBatchIds?: ReadonlySet<string>;
}) {
  const { lines, guestClientId, menuItems, lang, enabled, recentOrders, selfBatchIds } = params;
  const [items, setItems] = useState<FloatItem[]>([]);
  const seenRoundRef = useRef<Map<string, number>>(new Map());
  const seenOrderItemRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !guestClientId) return;
    const byId = new Map(menuItems.map((m) => [m.id, m]));
    const nextRoundSeen = new Map<string, number>();

    for (const line of lines) {
      const qty = Number(line.qty) || 0;
      if (qty < 1) continue;
      nextRoundSeen.set(line.id, qty);
      if (line.guest_client_id === guestClientId) continue;

      const prevQty = seenRoundRef.current.get(line.id);
      const isNew = prevQty === undefined;
      const increased = prevQty !== undefined && qty > prevQty;
      if (!primedRef.current) continue;
      if (!isNew && !increased) continue;

      const item = byId.get(line.menu_item_id);
      const text = formatOrderItemListLabel(
        {
          emoji: item?.emoji || '🍽️',
          name: item?.name_pt || '',
          name_pt: item?.name_pt || '',
          name_en: item?.name_en || '',
          name_zh: item?.name_zh || '',
          qty,
        },
        lang,
      );
      const id = `round:${line.id}:${qty}:${Date.now()}`;
      setItems((prev) => [...prev, { id, text }].slice(-MAX_VISIBLE));
      window.setTimeout(() => {
        setItems((prev) => prev.filter((f) => f.id !== id));
      }, SUSHI_PEER_FLOAT_HOLD_MS);
    }

    seenRoundRef.current = nextRoundSeen;

    const orderList = recentOrders ?? [];
    const nextOrderSeen = new Set<string>();
    for (const order of orderList) {
      for (const line of order.items) {
        if (isBuffetBaseItem(line) || isKitchenRemakeItem(line)) continue;
        if (line.item_status === 'voided') continue;
        if (!(Number(line.price) > 0)) continue;
                    const key = `${order.id}:${line.batch_id || 'nobatch'}:${line.id}:${line.added_at || ''}`;
        nextOrderSeen.add(key);
        if (!primedRef.current) continue;
        if (seenOrderItemRef.current.has(key)) continue;
        const batchKey = line.batch_id || '';
        if (batchKey && selfBatchIds?.has(batchKey)) continue;

        const text = formatOrderItemListLabel(
          {
            emoji: line.emoji || '🍽️',
            name: line.name || line.name_pt || '',
            name_pt: line.name_pt || line.name || '',
            name_en: line.name_en || '',
            name_zh: line.name_zh || '',
            qty: Number(line.qty) || 0,
          },
          lang,
        );
        const id = `paid:${key}:${Date.now()}`;
        setItems((prev) => [...prev, { id, text }].slice(-MAX_VISIBLE));
        window.setTimeout(() => {
          setItems((prev) => prev.filter((f) => f.id !== id));
        }, SUSHI_PEER_FLOAT_HOLD_MS);
      }
    }
    seenOrderItemRef.current = nextOrderSeen;
    primedRef.current = true;
  }, [enabled, guestClientId, lang, lines, menuItems, recentOrders, selfBatchIds]);

  if (!enabled || items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(5.5rem+var(--mesa-customer-menu-bottom-safe,0px))] left-3 z-40 flex w-[min(72%,15rem)] flex-col gap-2"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl rounded-bl-sm bg-[rgb(26_22_18_/_0.88)] px-3 py-2 text-[12.5px] leading-snug text-[rgb(242_239_231)] shadow-lg"
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}
