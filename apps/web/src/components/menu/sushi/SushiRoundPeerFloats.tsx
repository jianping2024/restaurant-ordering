'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS,
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
} from '@/lib/customer-menu-chrome-layout';
import { formatOrderItemListLabel } from '@/lib/order-list-display';
import { isBuffetBaseItem, isKitchenRemakeItem } from '@/lib/order-items';
import type { TableOrderRoundLineRow } from '@/lib/table-order-round/types';
import type { Language, MenuItem, Order } from '@/types';

type FloatItem = {
  id: string;
  text: string;
  /** Monotonic ms — sole sort key (older above in flex-col). */
  shownAt: number;
  /** After hold: CSS opacity fade; removed after SUSHI_PEER_FLOAT_FADE_MS. */
  fading: boolean;
};

const MAX_VISIBLE = 4;
/** Sole peer-float visible hold (free round + paid append) before fade starts. */
export const SUSHI_PEER_FLOAT_HOLD_MS = 10_000;
/** Sole peer-float CSS fade-out duration; keep in sync with `duration-300` on bubbles. */
export const SUSHI_PEER_FLOAT_FADE_MS = 300;

/**
 * Sole peer-float rail shell: same centered menu shell + px-4 as the dish list
 * (phone and desktop), top under sticky header/category, chronological flex-col
 * (older above). Never viewport `left-*` alone — that drifts from the menu on lg+.
 */
export const sushiPeerFloatRailClass = [
  'pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 flex flex-col items-start gap-2 px-4',
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS,
].join(' ');

/** Sole bubble chrome: opacity fade (Toast-style); duration matches SUSHI_PEER_FLOAT_FADE_MS. */
export const sushiPeerFloatBubbleClass = (fading: boolean) =>
  [
    'max-w-[min(72%,15rem)] rounded-2xl rounded-tl-sm bg-[rgb(26_22_18_/_0.88)] px-3 py-2',
    'text-[12.5px] leading-snug text-[rgb(242_239_231)] shadow-lg',
    'transition-opacity duration-300',
    fading ? 'opacity-0' : 'opacity-100',
  ].join(' ');

/** Sole batch merge + chronological sort before render cap. */
export function appendPeerFloatItems(
  prev: FloatItem[],
  incoming: Omit<FloatItem, 'fading'>[],
): FloatItem[] {
  if (incoming.length === 0) return prev;
  const merged = [...prev, ...incoming.map((f) => ({ ...f, fading: false }))];
  merged.sort((a, b) => a.shownAt - b.shownAt);
  return merged.slice(-MAX_VISIBLE);
}

/** Sole dismiss schedule: hold → mark fading → remove after fade. */
function schedulePeerFloatDismiss(
  id: string,
  setItems: Dispatch<SetStateAction<FloatItem[]>>,
) {
  window.setTimeout(() => {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, fading: true } : f)));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((f) => f.id !== id));
    }, SUSHI_PEER_FLOAT_FADE_MS);
  }, SUSHI_PEER_FLOAT_HOLD_MS);
}

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
  /** First non-empty round/paid snapshot seeds seen maps only (no historical floats). */
  const initialCatchupDoneRef = useRef(false);
  const shownSeqRef = useRef(0);

  useEffect(() => {
    if (!enabled || !guestClientId) return;
    const byId = new Map(menuItems.map((m) => [m.id, m]));
    const nextRoundSeen = new Map<string, number>();
    const pending: Omit<FloatItem, 'fading'>[] = [];
    const allowFloats = initialCatchupDoneRef.current;

    const mintShownAt = () => {
      shownSeqRef.current += 1;
      return shownSeqRef.current;
    };

    for (const line of lines) {
      const qty = Number(line.qty) || 0;
      if (qty < 1) continue;
      nextRoundSeen.set(line.id, qty);
      if (line.guest_client_id === guestClientId) continue;

      const prevQty = seenRoundRef.current.get(line.id);
      const isNew = prevQty === undefined;
      const increased = prevQty !== undefined && qty > prevQty;
      if (!allowFloats) continue;
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
      pending.push({ id, text, shownAt: mintShownAt() });
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
        if (!allowFloats) continue;
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
        pending.push({ id, text, shownAt: mintShownAt() });
      }
    }
    seenOrderItemRef.current = nextOrderSeen;

    const hasRoundLines = lines.some((l) => (Number(l.qty) || 0) >= 1);
    const hasPaidLines = orderList.some((o) =>
      o.items.some(
        (line) =>
          !isBuffetBaseItem(line) &&
          !isKitchenRemakeItem(line) &&
          line.item_status !== 'voided' &&
          Number(line.price) > 0,
      ),
    );
    if (!initialCatchupDoneRef.current && (hasRoundLines || hasPaidLines)) {
      initialCatchupDoneRef.current = true;
      return;
    }

    if (pending.length > 0) {
      setItems((prev) => appendPeerFloatItems(prev, pending));
      for (const f of pending) {
        schedulePeerFloatDismiss(f.id, setItems);
      }
    }
  }, [enabled, guestClientId, lang, lines, menuItems, recentOrders, selfBatchIds]);

  if (!enabled || items.length === 0) return null;

  const visible = [...items].sort((a, b) => a.shownAt - b.shownAt);

  return (
    <div
      className={sushiPeerFloatRailClass}
      aria-live="polite"
      data-sushi-peer-float-hold-ms={SUSHI_PEER_FLOAT_HOLD_MS}
      data-sushi-peer-float-fade-ms={SUSHI_PEER_FLOAT_FADE_MS}
    >
      {visible.map((item) => (
        <div
          key={item.id}
          className={sushiPeerFloatBubbleClass(item.fading)}
          data-fading={item.fading ? '1' : '0'}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}
