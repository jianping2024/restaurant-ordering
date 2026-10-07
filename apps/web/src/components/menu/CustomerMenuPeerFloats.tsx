'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS,
  CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS,
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
} from '@/lib/customer-menu-chrome-layout';
import {
  MENU_IMAGE_OBJECT_FIT_CLASS,
  MENU_IMAGE_UNOPTIMIZED,
  MENU_IMAGE_WELL_BG_CLASS,
  resolveMenuImageDisplayUrl,
} from '@/lib/menu-image';
import { isBuffetBaseItem, isKitchenRemakeItem } from '@/lib/order-items';
import {
  mintPaidPeerFloatBaselineAtMs,
  parsePeerFloatAddedAtMs,
  peerFloatPaidItemKey,
  shouldEmitPaidPeerFloatAfterBaseline,
} from '@/lib/table-order-round/sushi-peer-float-baseline';
import {
  formatPeerFloatLabel,
  resolvePeerFloatThumb,
  type PeerFloatThumb,
} from '@/lib/table-order-round/sushi-peer-float-display';
import type { TableOrderRoundLineRow } from '@/lib/table-order-round/types';
import type { Language, MenuItem, Order } from '@/types';

type FloatItem = {
  id: string;
  /** Localized name + qty only — never embeds emoji (thumb owns identity). */
  label: string;
  thumb: PeerFloatThumb;
  /** Monotonic ms — sole sort key (older above in flex-col). */
  shownAt: number;
  /** After hold: CSS opacity fade; removed after PEER_FLOAT_FADE_MS. */
  fading: boolean;
};

const MAX_VISIBLE = 4;
/** Sole peer-float visible hold (round lines + order appends) before fade starts. */
export const PEER_FLOAT_HOLD_MS = 10_000;
/** Sole peer-float CSS fade-out duration; keep in sync with `duration-300` on bubbles. */
export const PEER_FLOAT_FADE_MS = 300;

/**
 * Sole peer-float rail: centered menu shell, left-inset by the category rail
 * (dodge sole `CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS` — bubbles sit on the
 * catalog column, not over left category labels).
 * Top under identity header; chronological flex-col (older above).
 * Same X dock as `customerMenuFixedShellDockClass` but z-40 (floats above chrome).
 * Never viewport `left-*` alone — that drifts from the menu on lg+.
 */
export const customerMenuPeerFloatRailClass = [
  'pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 flex flex-col items-start gap-2',
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS,
  CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS,
].join(' ');

/** Sole bubble chrome: opacity fade (Toast-style); duration matches PEER_FLOAT_FADE_MS. */
export const customerMenuPeerFloatBubbleClass = (fading: boolean) =>
  [
    'flex max-w-[min(72%,15rem)] items-center gap-2 rounded-2xl rounded-tl-sm',
    'bg-[rgb(26_22_18_/_0.88)] px-2.5 py-1.5',
    'text-[12.5px] leading-snug text-[rgb(242_239_231)] shadow-lg',
    'transition-opacity duration-300',
    fading ? 'opacity-0' : 'opacity-100',
  ].join(' ');

/** Sole peer-float dish thumb UI: photo else emoji (28×28). */
function PeerFloatDishThumb({ thumb }: { thumb: PeerFloatThumb }) {
  const src = resolveMenuImageDisplayUrl(thumb.imageUrl);
  return (
    <span
      className={`relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-[15px] leading-none ${MENU_IMAGE_WELL_BG_CLASS}`}
      data-peer-float-thumb={src ? 'photo' : 'emoji'}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          className={MENU_IMAGE_OBJECT_FIT_CLASS}
          sizes="28px"
          unoptimized={MENU_IMAGE_UNOPTIMIZED}
        />
      ) : (
        thumb.emoji
      )}
    </span>
  );
}

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
    }, PEER_FLOAT_FADE_MS);
  }, PEER_FLOAT_HOLD_MS);
}

function peerFloatBaselineOwnerKey(sessionId: string | null | undefined, tableId: string) {
  return `${sessionId ?? ''}:${tableId}`;
}

function shouldEmitOrderLinePeerFloat(params: {
  price: number;
  includeZeroPriceOrderLines: boolean;
}): boolean {
  if (params.price > 0) return true;
  return params.includeZeroPriceOrderLines && params.price === 0;
}

/**
 * Sole guest-menu peer-order float rail (classic + sushi):
 * - sushi: other guests' free round upserts + paid appends (price>0 only on orders —
 *   free dishes already floated from round lines)
 * - classic: order appends only (incl. price=0 instant dishes); pass empty round lines
 */
export function CustomerMenuPeerFloats(params: {
  lines: TableOrderRoundLineRow[];
  guestClientId: string;
  menuItems: MenuItem[];
  lang: Language;
  enabled: boolean;
  /** Table + session identity — reset baselines when either changes (换台 / 并台后会话). */
  tableId: string;
  sessionId: string | null;
  /** Round GET finished at least once (empty snapshot counts). Classic: pass true with []. */
  roundSnapshotReady: boolean;
  /** Full-scope session orders ready (SSR full seed or successful full fetch — not gate []). */
  paidOrdersReady: boolean;
  recentOrders?: Order[];
  /** Batch ids this device just appended — exclude from paid floats. */
  selfBatchIds?: ReadonlySet<string>;
  /**
   * Classic immediate append of price=0 dishes. Sushi keeps false so free dishes
   * do not float again when they land on orders after round finalize.
   */
  includeZeroPriceOrderLines?: boolean;
}) {
  const {
    lines,
    guestClientId,
    menuItems,
    lang,
    enabled,
    tableId,
    sessionId,
    roundSnapshotReady,
    paidOrdersReady,
    recentOrders,
    selfBatchIds,
    includeZeroPriceOrderLines = false,
  } = params;
  const [items, setItems] = useState<FloatItem[]>([]);
  const seenRoundRef = useRef<Map<string, number>>(new Map());
  const seenOrderItemRef = useRef<Set<string>>(new Set());
  /** Per-source: first ready snapshot seeds seen only (no historical floats). */
  const roundCatchupDoneRef = useRef(false);
  const paidCatchupDoneRef = useRef(false);
  /** Wall-clock when paid catchup completed — merge history must be ≤ this. */
  const paidBaselineAtMsRef = useRef(0);
  const baselineOwnerKeyRef = useRef(peerFloatBaselineOwnerKey(sessionId, tableId));
  const shownSeqRef = useRef(0);

  useEffect(() => {
    const nextKey = peerFloatBaselineOwnerKey(sessionId, tableId);
    if (baselineOwnerKeyRef.current === nextKey) return;
    baselineOwnerKeyRef.current = nextKey;
    roundCatchupDoneRef.current = false;
    paidCatchupDoneRef.current = false;
    paidBaselineAtMsRef.current = 0;
    seenRoundRef.current = new Map();
    seenOrderItemRef.current = new Set();
    setItems([]);
  }, [sessionId, tableId]);

  useEffect(() => {
    if (!enabled || !guestClientId) return;
    const byId = new Map(menuItems.map((m) => [m.id, m]));
    const pending: Omit<FloatItem, 'fading'>[] = [];

    const mintShownAt = () => {
      shownSeqRef.current += 1;
      return shownSeqRef.current;
    };

    if (roundSnapshotReady) {
      const allowRoundFloats = roundCatchupDoneRef.current;
      const nextRoundSeen = new Map<string, number>();
      for (const line of lines) {
        const qty = Number(line.qty) || 0;
        if (qty < 1) continue;
        nextRoundSeen.set(line.id, qty);
        if (line.guest_client_id === guestClientId) continue;

        const prevQty = seenRoundRef.current.get(line.id);
        const isNew = prevQty === undefined;
        const increased = prevQty !== undefined && qty > prevQty;
        if (!allowRoundFloats) continue;
        if (!isNew && !increased) continue;

        const item = byId.get(line.menu_item_id);
        const thumb = resolvePeerFloatThumb({ menu: item });
        const label = formatPeerFloatLabel(
          {
            name_pt: item?.name_pt || '',
            name_en: item?.name_en || '',
            name_zh: item?.name_zh || '',
          },
          qty,
          lang,
        );
        const id = `round:${line.id}:${qty}:${Date.now()}`;
        pending.push({ id, label, thumb, shownAt: mintShownAt() });
      }
      seenRoundRef.current = nextRoundSeen;
      if (!roundCatchupDoneRef.current) {
        roundCatchupDoneRef.current = true;
      }
    }

    if (paidOrdersReady) {
      const allowPaidFloats = paidCatchupDoneRef.current;
      const paidBaselineAtMs = paidBaselineAtMsRef.current;
      const orderList = recentOrders ?? [];
      const nextOrderSeen = new Set<string>();
      for (const order of orderList) {
        for (const line of order.items) {
          if (isBuffetBaseItem(line) || isKitchenRemakeItem(line)) continue;
          if (line.item_status === 'voided') continue;
          if (
            !shouldEmitOrderLinePeerFloat({
              price: Number(line.price),
              includeZeroPriceOrderLines,
            })
          ) {
            continue;
          }
          const key = peerFloatPaidItemKey({
            orderId: order.id,
            batchId: line.batch_id,
            lineId: line.id,
            addedAt: line.added_at,
          });
          nextOrderSeen.add(key);
          if (!allowPaidFloats) continue;
          if (seenOrderItemRef.current.has(key)) continue;
          const batchKey = line.batch_id || '';
          if (batchKey && selfBatchIds?.has(batchKey)) continue;
          const addedAtMs = parsePeerFloatAddedAtMs(line.added_at);
          if (!shouldEmitPaidPeerFloatAfterBaseline(addedAtMs, paidBaselineAtMs)) {
            continue;
          }

          // OrderItem.id is menu_item.id at append time.
          const menu = byId.get(line.id);
          const thumb = resolvePeerFloatThumb({
            menu,
            fallbackEmoji: line.emoji,
          });
          const label = formatPeerFloatLabel(
            {
              name: line.name || line.name_pt || '',
              name_pt: line.name_pt || line.name || '',
              name_en: line.name_en || '',
              name_zh: line.name_zh || '',
            },
            Number(line.qty) || 0,
            lang,
          );
          const id = `paid:${key}:${Date.now()}`;
          pending.push({ id, label, thumb, shownAt: mintShownAt() });
        }
      }
      seenOrderItemRef.current = nextOrderSeen;
      if (!paidCatchupDoneRef.current) {
        paidCatchupDoneRef.current = true;
        paidBaselineAtMsRef.current = mintPaidPeerFloatBaselineAtMs();
      }
    }

    if (pending.length > 0) {
      setItems((prev) => appendPeerFloatItems(prev, pending));
      for (const f of pending) {
        schedulePeerFloatDismiss(f.id, setItems);
      }
    }
  }, [
    enabled,
    guestClientId,
    includeZeroPriceOrderLines,
    lang,
    lines,
    menuItems,
    paidOrdersReady,
    recentOrders,
    roundSnapshotReady,
    selfBatchIds,
  ]);

  if (!enabled || items.length === 0) return null;

  const visible = [...items].sort((a, b) => a.shownAt - b.shownAt);

  return (
    <div
      className={customerMenuPeerFloatRailClass}
      aria-live="polite"
      data-peer-float-hold-ms={PEER_FLOAT_HOLD_MS}
      data-peer-float-fade-ms={PEER_FLOAT_FADE_MS}
    >
      {visible.map((item) => (
        <div
          key={item.id}
          className={customerMenuPeerFloatBubbleClass(item.fading)}
          data-fading={item.fading ? '1' : '0'}
        >
          <PeerFloatDishThumb thumb={item.thumb} />
          <span className="min-w-0">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
