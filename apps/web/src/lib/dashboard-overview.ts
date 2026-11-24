import type { AuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';
import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateMenuItemsFromOrders, rankMenuItemAggs } from '@/lib/analytics/aggregate-items';
import {
  fetchItemOrdersBySessionIds,
  groupOrdersBySession,
  type AnalyticsItemOrder,
} from '@/lib/analytics/analytics.repository';
import {
  filterQualifyingClosedSessions,
  loadClosedSessionRevenueBundlesRpc,
  todayRevenueFromBundle,
} from '@/lib/analytics/closed-session-revenue';
import { revenueByOrderingChannel } from '@/lib/analytics/revenue-ordering-channel';
import { isRestaurantFeatureEnabled } from '@mesa/shared';
import { resolveTodayLisbonWindow } from '@/lib/analytics/date-window';
import {
  aggregateBuffetHeadcountForOrders,
  type BuffetGuestHeadcount,
} from '@/lib/buffet-order';
import { printJobMaxAgeCutoffIso } from '@/lib/print-job-max-age';
import type { UILanguage } from '@/lib/i18n';
import { pickTrilingualName, type TrilingualName } from '@/lib/i18n/pick-trilingual-name';
import { auditMoney } from '@/lib/audit/money';
import {
  groupCollectedPaymentsBySession,
  liveSessionUncollectedAmount,
} from '@/lib/checkout-settlement';
import {
  parseSessionCollectedPaymentsWithSession,
  SESSION_COLLECTED_PAYMENT_SELECT,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import type { BillSplit, Order, OrderItem, OrderStatus } from '@/types';
import { countPendingCheckoutRequests } from '@/lib/table-checkout-pending';
import {
  activeSessionOrderScope,
  activeSessionOrdersOrFilter,
  BOARD_ORDER_SELECT,
} from '@/lib/waiter-board-active-orders';
import { ACTIVE_ORDER_STATUSES, filterOrdersInActiveSessions } from '@/lib/waiter-board-query';
import type { WaiterTableSessionRow } from '@/lib/waiter-table-session-meta';

export type { TrilingualName };

export const DASHBOARD_FEEDBACK_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
export const DASHBOARD_TOP_SELLING_LIMIT = 5;

const TODAY_ORDERS_SELECT = 'id, status, items, total_amount';

export type DashboardTopItem = {
  name: string;
  count: number;
  revenue: number;
};

/** Server view: trilingual names; client picks display label by lang. */
export type DashboardTopSellingItemView = TrilingualName & {
  count: number;
  revenue: number;
};

export type DashboardTopSellingRow = DashboardTopItem & {
  rank: number;
  /** Share of total units across the displayed top list (0–1). */
  volumeShare: number;
  /** Share of total revenue across the displayed top list (0–1). */
  revenueShare: number;
};

export type DashboardTopSellingSummary = {
  totalUnits: number;
  totalRevenue: number;
};

export function summarizeTopSellingItems(items: DashboardTopItem[]): DashboardTopSellingSummary {
  return {
    totalUnits: items.reduce((sum, item) => sum + item.count, 0),
    totalRevenue: items.reduce((sum, item) => sum + item.revenue, 0),
  };
}

export function buildTopSellingRows(items: DashboardTopItem[]): DashboardTopSellingRow[] {
  const { totalUnits, totalRevenue } = summarizeTopSellingItems(items);
  return items.map((item, index) => {
    const rank = index + 1;
    const volumeShare = totalUnits > 0 ? item.count / totalUnits : 0;
    const revenueShare = totalRevenue > 0 ? item.revenue / totalRevenue : 0;
    return {
      ...item,
      rank,
      volumeShare,
      revenueShare,
    };
  });
}

export type DashboardPendingActions = {
  pendingCheckout: number;
  /**
   * PENDING abnormal_operations count when caller has `dashboard.abnormal_ops.view`;
   * `null` when not entitled (do not query / do not show the chip).
   */
  pendingAbnormal: number | null;
  pendingPrint: number;
};

export type DashboardFeedbackIssue = {
  menu_item_id: string;
  namePt: string;
  nameEn?: string | null;
  nameZh?: string | null;
  down_count: number;
};

export type DashboardFeedbackPraise = {
  menu_item_id: string;
  namePt: string;
  nameEn?: string | null;
  nameZh?: string | null;
  up_count: number;
};

export type DashboardFeedbackInsights = {
  hasSufficientData: boolean;
  touchedRate: number;
  completedRate: number;
  actionableRate: number;
  sessionsWithFeedback: number;
  billedSessions: number;
  topIssues: DashboardFeedbackIssue[];
  topPraise: DashboardFeedbackPraise[];
};

export type DashboardTodayKpis = {
  /**
   * Qualifying closed sessions opened on Lisbon today — same set as todayRevenue
   * (`revenueSessionCount` from the closed-session revenue bundle; day = opened_at).
   */
  todayTableCount: number;
  todayRevenue: number;
  /** false when closed-session revenue raw materials failed (do not show fake €0 / table count). */
  revenueAvailable: boolean;
  /**
   * Guest headcount for the same sessions as todayTableCount.
   * Sole shape — UI total = adults + children via totalGuestsFromCounts.
   */
  todayGuests: BuffetGuestHeadcount;
  /** Active open|billing table sessions (floor dining tables). */
  diningTableCount: number;
  /** Sole live-floor guest headcount shape — UI total = adults + children. */
  diningGuests: BuffetGuestHeadcount;
  /**
   * Uncollected (尚欠) across open|billing sessions — sole dashboard「未收」.
   * Per session: {@link liveSessionUncollectedAmount}.
   */
  diningUncollectedAmount: number;
  /**
   * When `takeaway_ordering` is on: collected revenue split by session channel
   * (segment UI). Null when flag off — hide channel chrome.
   */
  revenueByChannel: { dine_in: number; takeaway: number } | null;
};

/** Single overview DTO: server aggregates; client only formats by language. */
export type DashboardOverviewView = {
  todayKpis: DashboardTodayKpis;
  pendingActions: DashboardPendingActions;
  topSelling: DashboardTopSellingItemView[];
  feedback: DashboardFeedbackInsights;
};

/** Above-the-fold: KPIs + pending actions (blocks first paint). */
export type DashboardOverviewPrimaryView = Pick<
  DashboardOverviewView,
  'todayKpis' | 'pendingActions'
> & {
  /**
   * Lisbon calendar day (YYYY-MM-DD) used as default end date for revenue interval picker.
   * Keep UI defaults aligned with server side “today” window.
   */
  todayDateKey: string;
};

/** Below-the-fold panels streamed after primary. */
export type DashboardOverviewSecondaryView = Pick<
  DashboardOverviewView,
  'topSelling' | 'feedback'
>;

type MenuNameRow = {
  name_pt?: string | null;
  name_en?: string | null;
  name_zh?: string | null;
};

type FeedbackSessionRow = {
  session_id: string | null;
  completed_at?: string | null;
};

type BilledSplitRow = {
  session_id: string | null;
};

type DishFeedbackRow = {
  menu_item_id: string;
  vote: string;
  reasons?: unknown;
  menu_items?: MenuNameRow | MenuNameRow[] | null;
};

type TodayOrderAggRow = {
  id: string;
  status: OrderStatus;
  items: OrderItem[];
  total_amount: number;
};

function feedbackLookbackIso(now = new Date()): string {
  return new Date(now.getTime() - DASHBOARD_FEEDBACK_LOOKBACK_MS).toISOString();
}

function dishNamesFromRow(row: DishFeedbackRow): TrilingualName {
  const nested = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items;
  return {
    namePt: nested?.name_pt || row.menu_item_id,
    nameEn: nested?.name_en ?? null,
    nameZh: nested?.name_zh ?? null,
  };
}

type DiningFloorOrder = Pick<Order, 'items' | 'status' | 'session_id' | 'table_id'>;

function diningFloorGroupKey(order: DiningFloorOrder): string | null {
  if (order.session_id) return `session:${order.session_id}`;
  if (order.table_id) return `table:${order.table_id}`;
  return null;
}

/**
 * Floor dining KPIs: session count + headcount + uncollected, per open|billing session.
 * Do not call aggregateBuffetHeadcountForOrders on the whole floor — it dedupes by
 * buffet_id and would undercount when many tables share one package id.
 * Uncollected per session: sole {@link liveSessionUncollectedAmount}.
 */
export function computeDiningFloorKpis(
  sessionRows: readonly Pick<WaiterTableSessionRow, 'id' | 'table_id'>[],
  orders: DiningFloorOrder[],
  options?: {
    billSplitBySessionId?: Map<string, BillSplit>;
    collectedBySessionId?: Map<string, SessionCollectedPayment[]>;
  },
): Pick<DashboardTodayKpis, 'diningTableCount' | 'diningGuests' | 'diningUncollectedAmount'> {
  const billSplitBySessionId = options?.billSplitBySessionId ?? new Map();
  const collectedBySessionId = options?.collectedBySessionId ?? new Map();

  const bySession = new Map<string, DiningFloorOrder[]>();
  const orphanByTable = new Map<string, DiningFloorOrder[]>();
  for (const order of orders) {
    if (order.session_id) {
      const list = bySession.get(order.session_id);
      if (list) list.push(order);
      else bySession.set(order.session_id, [order]);
      continue;
    }
    const key = diningFloorGroupKey(order);
    if (!key || !order.table_id) continue;
    const list = orphanByTable.get(order.table_id);
    if (list) list.push(order);
    else orphanByTable.set(order.table_id, [order]);
  }

  let adults = 0;
  let children = 0;
  let uncollected = 0;

  for (const session of sessionRows) {
    const sessionOrders = [
      ...(bySession.get(session.id) ?? []),
      ...(orphanByTable.get(session.table_id) ?? []),
    ];
    const headcount = aggregateBuffetHeadcountForOrders(sessionOrders);
    if (headcount) {
      adults += headcount.adults;
      children += headcount.children;
    }
    uncollected += liveSessionUncollectedAmount({
      orders: sessionOrders as Order[],
      billSplit: billSplitBySessionId.get(session.id),
      collectedPayments: collectedBySessionId.get(session.id) ?? [],
    });
  }

  return {
    diningTableCount: sessionRows.length,
    diningGuests: { adults, children },
    diningUncollectedAmount: auditMoney(uncollected),
  };
}

/** Today tables + guests + revenue share Lisbon-day opened_at qualifying set. */
export function computeTodayKpis(
  revenue: {
    todayRevenue: number;
    revenueSessionCount: number;
    todayGuests: BuffetGuestHeadcount;
    revenueByChannel: { dine_in: number; takeaway: number } | null;
  } | null,
  dining: Pick<
    DashboardTodayKpis,
    'diningTableCount' | 'diningGuests' | 'diningUncollectedAmount'
  >,
): DashboardTodayKpis {
  return {
    todayTableCount: revenue?.revenueSessionCount ?? 0,
    todayRevenue: revenue?.todayRevenue ?? 0,
    revenueAvailable: revenue != null,
    todayGuests: revenue?.todayGuests ?? { adults: 0, children: 0 },
    diningTableCount: dining.diningTableCount,
    diningGuests: dining.diningGuests,
    diningUncollectedAmount: dining.diningUncollectedAmount,
    revenueByChannel: revenue?.revenueByChannel ?? null,
  };
}

const DINING_REQUESTED_SPLIT_SELECT =
  'id, restaurant_id, order_ids, split_mode, persons, result, total_amount, status, created_at, session_id, table_id, display_name, discount_rate';

/** PostgREST page size (≤ platform max-rows) and session-id chunk for `.in()` URLs. */
const BATCH_PAGE_SIZE = 1000;
const BATCH_SESSION_CHUNK = 100;

/** Read every page of a range-able query (stable `order` required by caller). */
async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += BATCH_PAGE_SIZE) {
    const { data, error } = await page(from, from + BATCH_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data || []) as T[];
    rows.push(...chunk);
    if (chunk.length < BATCH_PAGE_SIZE) return rows;
  }
}

function chunked<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

type DiningSessionRow = WaiterTableSessionRow & { restaurant_id: string };

type DiningFloorKpis = Pick<
  DashboardTodayKpis,
  'diningTableCount' | 'diningGuests' | 'diningUncollectedAmount'
>;

type CollectedPaymentRaw = NonNullable<Parameters<typeof parseSessionCollectedPaymentsWithSession>[0]>[number];

const EMPTY_DINING_FLOOR: DiningFloorKpis = {
  diningTableCount: 0,
  diningGuests: { adults: 0, children: 0 },
  diningUncollectedAmount: 0,
};

/**
 * Floor KPIs for many stores: open|billing sessions via one `.in('restaurant_id')`, then
 * orders / requested splits / ledger per session chunk (restaurant-scoped to the chunk's
 * stores), grouped back per store into {@link computeDiningFloorKpis}. Orphan orders
 * (no session) on an active table follow the same rule as the waiter board.
 */
async function loadDiningFloorKpisForRestaurants(
  admin: SupabaseClient,
  restaurantIds: readonly AuthorizedRestaurantId[],
): Promise<Map<string, DiningFloorKpis>> {
  // Read-failure policy kept from the single-store home: sessions / requested splits / ledger
  // read errors count as empty; the live-orders read throws.
  const sessionRows = await fetchAllPages<DiningSessionRow>((from, to) =>
    admin
      .from('table_sessions')
      .select('id, restaurant_id, table_id, opened_at, status')
      .in('restaurant_id', [...restaurantIds])
      .in('status', ['open', 'billing'])
      .order('restaurant_id', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  ).catch(() => [] as DiningSessionRow[]);

  const chunks = chunked(sessionRows, BATCH_SESSION_CHUNK);
  const perChunk = await Promise.all(
    chunks.map(async (chunk) => {
      const storeIds = Array.from(new Set(chunk.map((row) => row.restaurant_id)));
      const sessionIds = chunk.map((row) => row.id);
      const scope = activeSessionOrderScope(chunk);
      const [orders, splits, payments] = await Promise.all([
        scope
          ? fetchAllPages<Order>((from, to) =>
              admin
                .from('orders')
                .select(BOARD_ORDER_SELECT)
                .in('restaurant_id', storeIds)
                .in('status', [...ACTIVE_ORDER_STATUSES])
                .or(activeSessionOrdersOrFilter(scope))
                .order('id', { ascending: true })
                .range(from, to),
            )
          : Promise.resolve([] as Order[]),
        fetchAllPages<BillSplit>((from, to) =>
          admin
            .from('bill_splits')
            .select(DINING_REQUESTED_SPLIT_SELECT)
            .in('restaurant_id', storeIds)
            .eq('status', 'requested')
            .in('session_id', sessionIds)
            .order('id', { ascending: true })
            .range(from, to),
        ).catch(() => [] as BillSplit[]),
        fetchAllPages<CollectedPaymentRaw>((from, to) =>
          admin
            .from('session_collected_payments')
            .select(SESSION_COLLECTED_PAYMENT_SELECT)
            .in('restaurant_id', storeIds)
            .in('session_id', sessionIds)
            .order('id', { ascending: true })
            .range(from, to),
        ).catch(() => [] as CollectedPaymentRaw[]),
      ]);
      return { orders, splits, payments };
    }),
  );

  const ordersById = new Map<string, Order>();
  const splits: BillSplit[] = [];
  const payments: CollectedPaymentRaw[] = [];
  for (const part of perChunk) {
    // An orphan order can match two chunks when one table has two live sessions.
    for (const order of part.orders) ordersById.set(order.id, order);
    splits.push(...part.splits);
    payments.push(...part.payments);
  }

  const billSplitBySessionId = new Map<string, BillSplit>();
  for (const row of splits) {
    if (!row.session_id) continue;
    // One requested split per session in practice; keep latest if duplicates.
    const prev = billSplitBySessionId.get(row.session_id);
    if (!prev || row.created_at > prev.created_at) {
      billSplitBySessionId.set(row.session_id, row);
    }
  }
  const collectedBySessionId = groupCollectedPaymentsBySession(
    // Same order as the single-store ledger read (created_at ascending).
    parseSessionCollectedPaymentsWithSession(payments).sort((a, b) =>
      a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
    ),
  );

  const sessionsByStore = new Map<string, DiningSessionRow[]>();
  for (const row of sessionRows) {
    const list = sessionsByStore.get(row.restaurant_id);
    if (list) list.push(row);
    else sessionsByStore.set(row.restaurant_id, [row]);
  }
  const ordersByStore = new Map<string, Order[]>();
  const liveOrders = Array.from(ordersById.values()).sort((a, b) =>
    a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0,
  );
  for (const order of liveOrders) {
    const list = ordersByStore.get(order.restaurant_id);
    if (list) list.push(order);
    else ordersByStore.set(order.restaurant_id, [order]);
  }

  const out = new Map<string, DiningFloorKpis>();
  for (const restaurantId of restaurantIds) {
    const storeSessions = sessionsByStore.get(restaurantId) ?? [];
    const storeOrders = filterOrdersInActiveSessions(
      ordersByStore.get(restaurantId) ?? [],
      storeSessions,
    );
    out.set(
      restaurantId,
      computeDiningFloorKpis(storeSessions, storeOrders, {
        billSplitBySessionId,
        collectedBySessionId,
      }),
    );
  }
  return out;
}

type TodayRevenueKpis = {
  todayRevenue: number;
  revenueSessionCount: number;
  todayGuests: BuffetGuestHeadcount;
  revenueByChannel: { dine_in: number; takeaway: number } | null;
};

/** Revenue KPIs for many stores: one bundles RPC + item orders for stores with closed sessions. */
async function loadTodayRevenueKpisForRestaurants(
  admin: SupabaseClient,
  restaurantIds: readonly AuthorizedRestaurantId[],
  todayWindow: ReturnType<typeof resolveTodayLisbonWindow>,
  takeawayEnabledIds: ReadonlySet<string>,
): Promise<Map<string, TodayRevenueKpis | null>> {
  const bundles = await loadClosedSessionRevenueBundlesRpc(
    admin,
    restaurantIds,
    todayWindow.startUtc,
    todayWindow.endExclusiveUtc,
  );
  const entries = await Promise.all(
    restaurantIds.map(async (restaurantId): Promise<[string, TodayRevenueKpis | null]> => {
      const result = bundles.get(restaurantId);
      if (!result?.ok) return [restaurantId, null];
      const { bundle } = result;
      const sessionIds = bundle.sessions.map((session) => session.id);
      let itemOrdersBySession: Map<string, AnalyticsItemOrder[]> | undefined;
      if (sessionIds.length > 0) {
        const itemOrdersResult = await fetchItemOrdersBySessionIds(admin, restaurantId, sessionIds);
        if (!itemOrdersResult.ok) return [restaurantId, null];
        itemOrdersBySession = groupOrdersBySession(itemOrdersResult.rows);
      }
      const base = todayRevenueFromBundle(bundle, todayWindow.today, itemOrdersBySession);
      const revenueByChannel = takeawayEnabledIds.has(restaurantId)
        ? (() => {
            const qualifying = filterQualifyingClosedSessions(
              bundle.sessions,
              bundle.ordersBySession,
              bundle.splitsBySession,
            );
            const split = revenueByOrderingChannel(bundle, qualifying, {
              dateKey: todayWindow.today,
            });
            return { dine_in: split.dine_in, takeaway: split.takeaway };
          })()
        : null;
      return [restaurantId, { ...base, revenueByChannel }];
    }),
  );
  return new Map(entries);
}

/**
 * Sole today-KPI 口径 (home 「已收 / 未收 / 今日桌·人 / 当前用餐桌·人」) for one or many
 * stores: single-store home passes `[restaurantId]`, multi-store overview passes all.
 * Every input id gets a row.
 */
export async function loadTodayKpisForRestaurants(
  admin: SupabaseClient,
  restaurantIds: readonly AuthorizedRestaurantId[],
  now = new Date(),
): Promise<{ todayDateKey: string; kpisByRestaurantId: Map<AuthorizedRestaurantId, DashboardTodayKpis> }> {
  const todayWindow = resolveTodayLisbonWindow(now);
  const ids = Array.from(new Set(restaurantIds));
  const kpisByRestaurantId = new Map<AuthorizedRestaurantId, DashboardTodayKpis>();
  if (ids.length === 0) return { todayDateKey: todayWindow.today, kpisByRestaurantId };

  const [flagsResult, diningByStore] = await Promise.all([
    admin.from('restaurants').select('id, feature_flags').in('id', ids),
    loadDiningFloorKpisForRestaurants(admin, ids),
  ]);
  const takeawayEnabledIds = new Set(
    ((flagsResult.data || []) as Array<{ id: string; feature_flags: unknown }>)
      .filter((row) => isRestaurantFeatureEnabled(row.feature_flags, 'takeaway_ordering'))
      .map((row) => row.id),
  );
  const revenueByStore = await loadTodayRevenueKpisForRestaurants(
    admin,
    ids,
    todayWindow,
    takeawayEnabledIds,
  );

  for (const id of ids) {
    kpisByRestaurantId.set(
      id,
      computeTodayKpis(revenueByStore.get(id) ?? null, diningByStore.get(id) ?? EMPTY_DINING_FLOOR),
    );
  }
  return { todayDateKey: todayWindow.today, kpisByRestaurantId };
}

export function buildTodayTopSellingItems(
  orders: Array<{ status: OrderStatus; items: OrderItem[] }>,
  limit = DASHBOARD_TOP_SELLING_LIMIT,
): DashboardTopSellingItemView[] {
  return rankMenuItemAggs(aggregateMenuItemsFromOrders(orders), limit).map((agg) => ({
    namePt: agg.namePt,
    nameEn: agg.nameEn,
    nameZh: agg.nameZh,
    count: agg.consumedQuantity,
    revenue: agg.amount,
  }));
}

/** Localized top list for panels / tests that need a single display name. */
export function localizeTopSellingItems(
  items: DashboardTopSellingItemView[],
  lang: UILanguage,
): DashboardTopItem[] {
  return items.map((item) => ({
    name: pickTrilingualName(item, lang) || item.namePt,
    count: item.count,
    revenue: item.revenue,
  }));
}

export function buildFeedbackInsights(
  feedbackSessions: FeedbackSessionRow[],
  billedSplits: BilledSplitRow[],
  dishFeedbackRows: DishFeedbackRow[],
): DashboardFeedbackInsights {
  const billedSessionIds = new Set(billedSplits.map((row) => row.session_id).filter(Boolean));
  const touchedSessionIds = new Set(feedbackSessions.map((row) => row.session_id).filter(Boolean));
  const completedSessionIds = new Set(
    feedbackSessions
      .filter((row) => !!row.completed_at)
      .map((row) => row.session_id)
      .filter(Boolean),
  );

  const billedSessions = billedSessionIds.size;
  const sessionsWithFeedback = touchedSessionIds.size;
  const touchedRate = billedSessions > 0 ? sessionsWithFeedback / billedSessions : 0;
  const completedRate = sessionsWithFeedback > 0 ? completedSessionIds.size / sessionsWithFeedback : 0;

  const downRows = dishFeedbackRows.filter((row) => row.vote === 'down');
  const upRows = dishFeedbackRows.filter((row) => row.vote === 'up');
  const actionableDownRows = downRows.filter((row) => Array.isArray(row.reasons) && row.reasons.length > 0);
  const actionableRate = downRows.length > 0 ? actionableDownRows.length / downRows.length : 0;
  const feedbackVoteCount = downRows.length + upRows.length;

  const hasSufficientData =
    billedSessions >= 1 && (sessionsWithFeedback >= 1 || feedbackVoteCount >= 1);

  const issueMap = new Map<string, DashboardFeedbackIssue>();
  downRows.forEach((row) => {
    const names = dishNamesFromRow(row);
    const current = issueMap.get(row.menu_item_id) || {
      menu_item_id: row.menu_item_id,
      ...names,
      down_count: 0,
    };
    current.down_count += 1;
    issueMap.set(row.menu_item_id, current);
  });

  const praiseMap = new Map<string, DashboardFeedbackPraise>();
  upRows.forEach((row) => {
    const names = dishNamesFromRow(row);
    const current = praiseMap.get(row.menu_item_id) || {
      menu_item_id: row.menu_item_id,
      ...names,
      up_count: 0,
    };
    current.up_count += 1;
    praiseMap.set(row.menu_item_id, current);
  });

  const topIssues = Array.from(issueMap.values())
    .sort((a, b) => b.down_count - a.down_count)
    .slice(0, 5);
  const topPraise = Array.from(praiseMap.values())
    .sort((a, b) => b.up_count - a.up_count)
    .slice(0, 5);

  return {
    hasSufficientData,
    touchedRate,
    completedRate,
    actionableRate,
    sessionsWithFeedback,
    billedSessions,
    topIssues,
    topPraise,
  };
}

export function pendingActionsTotal(actions: DashboardPendingActions): number {
  return (
    actions.pendingCheckout +
    (actions.pendingAbnormal ?? 0) +
    actions.pendingPrint
  );
}

export async function loadDashboardOverviewPrimary(
  admin: SupabaseClient,
  restaurantId: AuthorizedRestaurantId,
  now = new Date(),
  options?: { includePendingAbnormal?: boolean },
): Promise<DashboardOverviewPrimaryView> {
  const includePendingAbnormal = options?.includePendingAbnormal === true;

  const [
    pendingCheckoutCount,
    pendingAbnormalCount,
    { count: pendingPrintCount },
    { todayDateKey, kpisByRestaurantId },
  ] = await Promise.all([
    countPendingCheckoutRequests(admin, restaurantId),
    includePendingAbnormal
      ? admin
          .from('abnormal_operations')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .eq('status', 'PENDING')
          .then((result) => result.count ?? 0)
      : Promise.resolve(null as number | null),
    admin
      .from('print_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')
      .gte('created_at', printJobMaxAgeCutoffIso(now)),
    loadTodayKpisForRestaurants(admin, [restaurantId], now),
  ]);
  const todayKpis = kpisByRestaurantId.get(restaurantId);
  if (!todayKpis) throw new Error('today_kpis_missing');

  return {
    todayKpis,
    pendingActions: {
      pendingCheckout: pendingCheckoutCount,
      pendingAbnormal: pendingAbnormalCount,
      pendingPrint: pendingPrintCount ?? 0,
    },
    todayDateKey,
  };
}

export async function loadDashboardOverviewSecondary(
  admin: SupabaseClient,
  restaurantId: AuthorizedRestaurantId,
  now = new Date(),
): Promise<DashboardOverviewSecondaryView> {
  const sinceIso = feedbackLookbackIso(now);
  const todayWindow = resolveTodayLisbonWindow(now);

  const [
    { data: todayOrders },
    { data: feedbackSessions },
    { data: billedSplits },
    { data: dishFeedbackRows },
  ] = await Promise.all([
    admin
      .from('orders')
      .select(TODAY_ORDERS_SELECT)
      .eq('restaurant_id', restaurantId)
      .gte('created_at', todayWindow.startUtc)
      .lt('created_at', todayWindow.endExclusiveUtc),
    admin
      .from('feedback_sessions')
      .select('session_id, completed_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', sinceIso),
    admin
      .from('bill_splits')
      .select('session_id')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', sinceIso)
      .not('session_id', 'is', null),
    admin
      .from('dish_feedback')
      .select('menu_item_id, vote, reasons, menu_items(name_pt, name_en, name_zh)')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', sinceIso),
  ]);

  const orders = (todayOrders || []) as TodayOrderAggRow[];

  return {
    topSelling: buildTodayTopSellingItems(orders),
    feedback: buildFeedbackInsights(
      (feedbackSessions || []) as FeedbackSessionRow[],
      (billedSplits || []) as BilledSplitRow[],
      (dishFeedbackRows || []) as DishFeedbackRow[],
    ),
  };
}
