'use client';

import { useEffect, useRef, useState } from 'react';
import { formatOrderItemListLabel } from '@/lib/order-list-display';
import type { TableOrderRoundLineRow } from '@/lib/table-order-round/types';
import type { Language, MenuItem } from '@/types';

type FloatItem = {
  id: string;
  text: string;
};

const MAX_VISIBLE = 4;
const HOLD_MS = 2800;

/** Sole peer-order float rail for other guests' round line upserts. */
export function SushiRoundPeerFloats(params: {
  lines: TableOrderRoundLineRow[];
  guestClientId: string;
  menuItems: MenuItem[];
  lang: Language;
  enabled: boolean;
}) {
  const { lines, guestClientId, menuItems, lang, enabled } = params;
  const [items, setItems] = useState<FloatItem[]>([]);
  const seenRef = useRef<Map<string, number>>(new Map());
  const primedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !guestClientId) return;
    const byId = new Map(menuItems.map((m) => [m.id, m]));
    const nextSeen = new Map<string, number>();

    for (const line of lines) {
      const qty = Number(line.qty) || 0;
      if (qty < 1) continue;
      nextSeen.set(line.id, qty);
      if (line.guest_client_id === guestClientId) continue;

      const prevQty = seenRef.current.get(line.id);
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
      const id = `${line.id}:${qty}:${Date.now()}`;
      setItems((prev) => [...prev, { id, text }].slice(-MAX_VISIBLE));
      window.setTimeout(() => {
        setItems((prev) => prev.filter((f) => f.id !== id));
      }, HOLD_MS);
    }

    seenRef.current = nextSeen;
    primedRef.current = true;
  }, [enabled, guestClientId, lang, lines, menuItems]);

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
