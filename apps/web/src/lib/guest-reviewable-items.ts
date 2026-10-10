/**
 * Sole guest post-checkout dish-feedback list.
 * by_item → this phone's ticket shares only; whole_table / even → full session catalog.
 * Screen qty sole {@link formatRational} via `qtyLabel` (never float String dump).
 */
import type { BillSplitOrderLine } from '@/lib/bill-split-by-item-lines';
import type { UILanguage } from '@/lib/i18n';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { isBuffetBaseItem } from '@/lib/order-items';
import {
  addRationals,
  formatRational,
  normalizeRational,
  rationalFromNumber,
  type Rational,
} from '@/lib/rational-qty';
import { splitPartyKey } from '@/lib/split-party-id';
import type { SplitPerson } from '@/types';

export type GuestReviewableItem = {
  menu_item_id: string;
  order_id: string;
  name: string;
  emoji: string;
  image_url: string | null;
  /** Sole on-screen share qty (`1/3`, `1/2`, `2`) — UI prefixes `×`. */
  qtyLabel: string;
};

export type GuestReviewableSplitMode = 'whole_table' | 'even' | 'by_item';

type CatalogLine = Pick<
  BillSplitOrderLine,
  'id' | 'key' | 'order_id' | 'qty' | 'emoji' | 'kind' | 'item_status' | 'name' | 'name_pt' | 'name_en' | 'name_zh'
>;

type ReviewableDraft = {
  menu_item_id: string;
  order_id: string;
  name: string;
  emoji: string;
  image_url: string | null;
  qty: Rational;
};

function isReviewableCatalogLine(line: CatalogLine): boolean {
  if (line.item_status === 'voided') return false;
  if (isBuffetBaseItem(line)) return false;
  return typeof line.id === 'string' && line.id.length > 0;
}

function toReviewableItem(draft: ReviewableDraft): GuestReviewableItem {
  return {
    menu_item_id: draft.menu_item_id,
    order_id: draft.order_id,
    name: draft.name,
    emoji: draft.emoji,
    image_url: draft.image_url,
    qtyLabel: formatRational(draft.qty),
  };
}

/**
 * `${orderId}:${menuItemId}` keys for dishes on this phone's by-item tickets.
 * Buffet / voided / unknown line keys are omitted.
 */
export function mineByItemFeedbackOrderKeys(params: {
  persons: ReadonlyArray<SplitPerson>;
  mineTicketKeys: ReadonlySet<string>;
  catalogByLineKey: ReadonlyMap<string, { menuItemId: string; orderId: string }>;
}): Set<string> {
  const out = new Set<string>();
  if (params.mineTicketKeys.size === 0) return out;

  for (const person of params.persons) {
    const ticketKey = splitPartyKey(person.party_id, person.name);
    if (!ticketKey || !params.mineTicketKeys.has(ticketKey)) continue;
    for (const share of person.item_shares ?? []) {
      const lineKey = typeof share.key === 'string' ? share.key.trim() : '';
      if (!lineKey) continue;
      const qty = normalizeRational({ num: share.qty_num, den: share.qty_den });
      if (qty.num <= 0) continue;
      const catalog = params.catalogByLineKey.get(lineKey);
      if (!catalog) continue;
      out.add(`${catalog.orderId}:${catalog.menuItemId}`);
    }
  }
  return out;
}

function catalogByLineKeyFromLines(
  lines: ReadonlyArray<CatalogLine>,
  fallbackOrderId: string,
): Map<string, { menuItemId: string; orderId: string; line: CatalogLine }> {
  const map = new Map<string, { menuItemId: string; orderId: string; line: CatalogLine }>();
  for (const line of lines) {
    if (!isReviewableCatalogLine(line)) continue;
    const key = typeof line.key === 'string' ? line.key.trim() : '';
    if (!key || map.has(key)) continue;
    map.set(key, {
      menuItemId: line.id,
      orderId: line.order_id ?? fallbackOrderId,
      line,
    });
  }
  return map;
}

function buildSessionReviewableItems(params: {
  orderLines: ReadonlyArray<CatalogLine>;
  lang: UILanguage;
  imageUrlByMenuId: Record<string, string>;
  fallbackOrderId: string;
}): GuestReviewableItem[] {
  const dedup = new Map<string, ReviewableDraft>();
  for (const item of params.orderLines) {
    if (!isReviewableCatalogLine(item)) continue;
    const lineQty = rationalFromNumber(item.qty);
    const existing = dedup.get(item.id);
    if (existing) {
      existing.qty = addRationals(existing.qty, lineQty);
      continue;
    }
    dedup.set(item.id, {
      menu_item_id: item.id,
      order_id: item.order_id ?? params.fallbackOrderId,
      name: resolveMenuItemLocalizedName(item, params.lang),
      emoji: item.emoji,
      image_url: params.imageUrlByMenuId[item.id] ?? null,
      qty: lineQty,
    });
  }
  return Array.from(dedup.values()).map(toReviewableItem);
}

function buildByItemReviewableItems(params: {
  splitOrderLines: ReadonlyArray<CatalogLine>;
  persons: ReadonlyArray<SplitPerson>;
  mineTicketKeys: ReadonlySet<string>;
  lang: UILanguage;
  imageUrlByMenuId: Record<string, string>;
  fallbackOrderId: string;
}): GuestReviewableItem[] {
  const catalog = catalogByLineKeyFromLines(params.splitOrderLines, params.fallbackOrderId);
  const qtyByMenu = new Map<string, ReviewableDraft>();

  for (const person of params.persons) {
    const ticketKey = splitPartyKey(person.party_id, person.name);
    if (!ticketKey || !params.mineTicketKeys.has(ticketKey)) continue;
    for (const share of person.item_shares ?? []) {
      const lineKey = typeof share.key === 'string' ? share.key.trim() : '';
      if (!lineKey) continue;
      const shareQty = normalizeRational({ num: share.qty_num, den: share.qty_den });
      if (shareQty.num <= 0) continue;
      const entry = catalog.get(lineKey);
      if (!entry) continue;
      const { line, menuItemId, orderId } = entry;
      const prev = qtyByMenu.get(menuItemId);
      if (prev) {
        prev.qty = addRationals(prev.qty, shareQty);
        continue;
      }
      qtyByMenu.set(menuItemId, {
        menu_item_id: menuItemId,
        order_id: orderId,
        name: resolveMenuItemLocalizedName(line, params.lang),
        emoji: line.emoji,
        image_url: params.imageUrlByMenuId[menuItemId] ?? null,
        qty: shareQty,
      });
    }
  }

  return Array.from(qtyByMenu.values()).map(toReviewableItem);
}

/** Sole builder for guest bill-success「本次菜品体验」rows. */
export function buildGuestReviewableItems(params: {
  splitMode: GuestReviewableSplitMode;
  orderLines: ReadonlyArray<CatalogLine>;
  splitOrderLines: ReadonlyArray<CatalogLine>;
  persons: ReadonlyArray<SplitPerson>;
  mineTicketKeys: ReadonlySet<string> | ReadonlyArray<string>;
  lang: UILanguage;
  imageUrlByMenuId?: Record<string, string>;
  fallbackOrderId?: string;
}): GuestReviewableItem[] {
  const imageUrlByMenuId = params.imageUrlByMenuId ?? {};
  const fallbackOrderId = params.fallbackOrderId ?? '';
  if (params.splitMode !== 'by_item') {
    return buildSessionReviewableItems({
      orderLines: params.orderLines,
      lang: params.lang,
      imageUrlByMenuId,
      fallbackOrderId,
    });
  }
  const mineTicketKeys =
    params.mineTicketKeys instanceof Set
      ? params.mineTicketKeys
      : new Set(params.mineTicketKeys);
  return buildByItemReviewableItems({
    splitOrderLines: params.splitOrderLines,
    persons: params.persons,
    mineTicketKeys,
    lang: params.lang,
    imageUrlByMenuId,
    fallbackOrderId,
  });
}
