import type { Order, OrderItem, OrderItemStatus } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import {
  effectiveItemStatus,
  isKitchenBoardOpenStatus,
} from '@/lib/order-status';
import { formatOnScreenMenuItemLabel, resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import type { UILanguage } from '@/lib/i18n';

export type KitchenBoardLine = {
  key: string;
  orderId: string;
  itemIndex: number;
  order: Order;
  item: OrderItem;
  tableId: string;
  tableDisplay: string;
  menuItemId: string;
  /** Catalog/on-ticket item code snapshot (may be empty). */
  itemCode: string | null;
  /** Display name with optional code prefix — sole kitchen row title for the dish. */
  displayName: string;
  effectiveStatus: OrderItemStatus;
  /** Workbench: first prep only (pending). */
  prepEligible: boolean;
  /** Bottom rail: reprint only (cooking or display-ready). */
  printEligible: boolean;
  /** Ordered-at epoch ms (item.added_at || order.created_at). */
  orderedAtMs: number;
};

/** Workbench only: pending (not yet prepped). */
export function isKitchenWorkbenchStatus(status: OrderItemStatus): boolean {
  return status === 'pending';
}

/** Bottom rail: prepped (cooking) + display-ready. */
export function isKitchenBottomRailStatus(status: OrderItemStatus): boolean {
  return status === 'cooking' || status === 'ready';
}

export function lineSelectionKey(orderId: string, itemIndex: number): string {
  return `${orderId}:${itemIndex}`;
}

export function lineNoteKey(item: OrderItem): string {
  return (item.note || '').trim();
}

export function lineOrderedAtMs(order: Order, item: OrderItem): number {
  const raw = item.added_at || order.created_at;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Whole minutes waited since ordered-at (floor, min 0). */
export function lineWaitMinutes(orderedAtMs: number, nowMs: number): number {
  if (!orderedAtMs) return 0;
  return Math.max(0, Math.floor((nowMs - orderedAtMs) / 60_000));
}

/** Lines for one station pane: open statuses, matching print_station_id. */
export function collectStationBoardLines(input: {
  orders: Order[];
  printStationId: string;
  nowMs: number;
  readyAfterMinutes: number;
  lang: UILanguage;
}): KitchenBoardLine[] {
  const lines: KitchenBoardLine[] = [];
  for (const order of input.orders) {
    const items = order.items || [];
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      if (!item || isBuffetBaseItem(item)) continue;
      if (item.print_station_id !== input.printStationId) continue;
      const effectiveStatus = effectiveItemStatus({
        item,
        orderStatus: order.status,
        nowMs: input.nowMs,
        readyAfterMinutes: input.readyAfterMinutes,
      });
      if (!isKitchenBoardOpenStatus(effectiveStatus)) continue;
      const prepEligible = effectiveStatus === 'pending';
      const printEligible =
        effectiveStatus === 'cooking' || effectiveStatus === 'ready';
      const name = resolveMenuItemLocalizedName(item, input.lang) || item.id;
      const itemCode = resolveMenuItemCode(item);
      lines.push({
        key: lineSelectionKey(order.id, itemIndex),
        orderId: order.id,
        itemIndex,
        order,
        item,
        tableId: order.table_id,
        tableDisplay: (order.display_name || '').trim() || order.table_id.slice(0, 8),
        menuItemId: item.id,
        itemCode,
        displayName: formatOnScreenMenuItemLabel(name, itemCode),
        effectiveStatus,
        prepEligible,
        printEligible,
        orderedAtMs: lineOrderedAtMs(order, item),
      });
    }
  }
  lines.sort((a, b) => a.orderedAtMs - b.orderedAtMs);
  return lines;
}

/** Split board lines into workbench vs bottom rail — one line belongs to exactly one. */
export function partitionStationLines(lines: KitchenBoardLine[]): {
  workbench: KitchenBoardLine[];
  bottomRail: KitchenBoardLine[];
} {
  const workbench: KitchenBoardLine[] = [];
  const bottomRail: KitchenBoardLine[] = [];
  for (const line of lines) {
    if (isKitchenBottomRailStatus(line.effectiveStatus)) bottomRail.push(line);
    else if (isKitchenWorkbenchStatus(line.effectiveStatus)) workbench.push(line);
  }
  return { workbench, bottomRail };
}

/**
 * Sole bottom-rail status groups (display only; partition already put cooking+ready here).
 * Cooking first, then ready — preserves relative order within each group.
 */
export function groupBottomRailByStatus(lines: KitchenBoardLine[]): {
  cooking: KitchenBoardLine[];
  ready: KitchenBoardLine[];
} {
  const cooking: KitchenBoardLine[] = [];
  const ready: KitchenBoardLine[] = [];
  for (const line of lines) {
    if (line.effectiveStatus === 'ready') ready.push(line);
    else if (line.effectiveStatus === 'cooking') cooking.push(line);
  }
  return { cooking, ready };
}

export function sumLineQty(lines: KitchenBoardLine[]): number {
  return lines.reduce((sum, l) => sum + (Number(l.item.qty) || 0), 0);
}

export type DishAggregate = {
  menuItemId: string;
  name: string;
  /** Workbench portion total for this dish (qty sum; not order-line count). */
  totalQty: number;
  /** Order lines for by-dish L2 list + group select / prep (no L1 table-summary fields). */
  lines: KitchenBoardLine[];
};

/** Group workbench lines by dish; portion total for L1, lines for L2 (no L1 table summary). */
export function aggregateLinesByDish(lines: KitchenBoardLine[]): DishAggregate[] {
  const byId = new Map<string, DishAggregate>();
  for (const line of lines) {
    let agg = byId.get(line.menuItemId);
    if (!agg) {
      agg = {
        menuItemId: line.menuItemId,
        name: line.displayName,
        totalQty: 0,
        lines: [],
      };
      byId.set(line.menuItemId, agg);
    }
    agg.totalQty += Number(line.item.qty) || 0;
    agg.lines.push(line);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function groupLinesByTable(lines: KitchenBoardLine[]): Array<{
  tableId: string;
  tableDisplay: string;
  lines: KitchenBoardLine[];
}> {
  const byTable = new Map<string, { tableId: string; tableDisplay: string; lines: KitchenBoardLine[] }>();
  for (const line of lines) {
    let g = byTable.get(line.tableId);
    if (!g) {
      g = { tableId: line.tableId, tableDisplay: line.tableDisplay, lines: [] };
      byTable.set(line.tableId, g);
    }
    g.lines.push(line);
  }
  return Array.from(byTable.values());
}

/** Workbench group header badge + tri-state: order lines only (never qty / table count). */
export type GroupSelectionFrac = {
  selected: number;
  total: number;
  state: 'none' | 'partial' | 'all';
};

/**
 * Sole workbench group selection tally for by-table / by-dish headers.
 * `total` = prepEligible lines in the group; `selected` = those also in `selectedKeys`.
 */
export function groupSelectionFrac(
  lines: readonly KitchenBoardLine[],
  selectedKeys: ReadonlySet<string>,
): GroupSelectionFrac {
  let total = 0;
  let selected = 0;
  for (const line of lines) {
    if (!line.prepEligible) continue;
    total += 1;
    if (selectedKeys.has(line.key)) selected += 1;
  }
  const state: GroupSelectionFrac['state'] =
    total === 0 || selected === 0 ? 'none' : selected >= total ? 'all' : 'partial';
  return { selected, total, state };
}

/** Sole workbench group select-all toggle (prepEligible lines only). */
export function toggleGroupPrepSelection(
  lines: readonly KitchenBoardLine[],
  prev: ReadonlySet<string>,
): Set<string> {
  const next = new Set(prev);
  const { state } = groupSelectionFrac(lines, prev);
  const clear = state === 'all';
  for (const line of lines) {
    if (!line.prepEligible) continue;
    if (clear) next.delete(line.key);
    else next.add(line.key);
  }
  return next;
}

/**
 * Prep tray row state (workbench prepEligible lines only):
 * `selected` = in tray and will be prepped; `skipped` = in tray but tapped off (dashed chip);
 * neither = not in tray. `selected` wins if a key is in both, so a left-list re-check lights the chip.
 */
export type PrepTrayState = {
  selected: Set<string>;
  skipped: Set<string>;
};

export type PrepTrayChip = {
  key: string;
  tableId: string;
  tableDisplay: string;
  qty: number;
  waitMin: number;
  selected: boolean;
};

export type PrepTrayCard = {
  menuItemId: string;
  name: string;
  /** First line of the dish — thumb / detail source. */
  seedLine: KitchenBoardLine;
  /** Longest wait first. */
  chips: PrepTrayChip[];
  selectedCount: number;
  selectedQty: number;
  longestWaitMin: number;
};

/** Sole tray grouping: one card per dish, chips = tray lines sorted by wait desc. */
export function buildPrepTrayCards(
  lines: readonly KitchenBoardLine[],
  state: { selected: ReadonlySet<string>; skipped: ReadonlySet<string> },
  nowMs: number,
): PrepTrayCard[] {
  const byDish = new Map<string, PrepTrayCard>();
  for (const line of lines) {
    if (!line.prepEligible) continue;
    const selected = state.selected.has(line.key);
    if (!selected && !state.skipped.has(line.key)) continue;
    let card = byDish.get(line.menuItemId);
    if (!card) {
      card = {
        menuItemId: line.menuItemId,
        name: line.displayName,
        seedLine: line,
        chips: [],
        selectedCount: 0,
        selectedQty: 0,
        longestWaitMin: 0,
      };
      byDish.set(line.menuItemId, card);
    }
    const qty = Number(line.item.qty) || 0;
    const waitMin = lineWaitMinutes(line.orderedAtMs, nowMs);
    card.chips.push({
      key: line.key,
      tableId: line.tableId,
      tableDisplay: line.tableDisplay,
      qty,
      waitMin,
      selected,
    });
    if (selected) {
      card.selectedCount += 1;
      card.selectedQty += qty;
    }
    card.longestWaitMin = Math.max(card.longestWaitMin, waitMin);
  }
  const cards = Array.from(byDish.values());
  for (const card of cards) {
    card.chips.sort(
      (a, b) => b.waitMin - a.waitMin || a.tableDisplay.localeCompare(b.tableDisplay),
    );
  }
  return cards.sort(
    (a, b) => b.longestWaitMin - a.longestWaitMin || a.name.localeCompare(b.name),
  );
}

/** Header tally: selected rows only (skipped chips do not count). */
export function summarizePrepTray(cards: readonly PrepTrayCard[]): {
  dishCount: number;
  portions: number;
  tableCount: number;
} {
  const tables = new Set<string>();
  let dishCount = 0;
  let portions = 0;
  for (const card of cards) {
    if (card.selectedCount === 0) continue;
    dishCount += 1;
    portions += card.selectedQty;
    for (const chip of card.chips) if (chip.selected) tables.add(chip.tableId);
  }
  return { dishCount, portions, tableCount: tables.size };
}

/** Tray chip tap: selected ⇄ skipped. Keys outside the tray are untouched. */
export function toggleTrayChip(key: string, prev: PrepTrayState): PrepTrayState {
  const selected = new Set(prev.selected);
  const skipped = new Set(prev.skipped);
  if (selected.has(key)) {
    selected.delete(key);
    skipped.add(key);
  } else if (skipped.has(key)) {
    skipped.delete(key);
    selected.add(key);
  }
  return { selected, skipped };
}

/** Card「全选/清空」: on → all selected; off → all skipped (stay in tray). */
export function setTrayKeysSelected(
  keys: readonly string[],
  on: boolean,
  prev: PrepTrayState,
): PrepTrayState {
  const selected = new Set(prev.selected);
  const skipped = new Set(prev.skipped);
  for (const key of keys) {
    if (on) {
      skipped.delete(key);
      selected.add(key);
    } else {
      selected.delete(key);
      skipped.add(key);
    }
  }
  return { selected, skipped };
}

/** Card ✕ / clear all: rows leave the tray entirely (back to「not in tray」). */
export function removeTrayKeys(keys: readonly string[], prev: PrepTrayState): PrepTrayState {
  const selected = new Set(prev.selected);
  const skipped = new Set(prev.skipped);
  for (const key of keys) {
    selected.delete(key);
    skipped.delete(key);
  }
  return { selected, skipped };
}
