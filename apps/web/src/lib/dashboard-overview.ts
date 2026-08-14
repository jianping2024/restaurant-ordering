import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateMenuItemsFromOrders, rankMenuItemAggs } from '@/lib/analytics/aggregate-items';
import {
  fetchItemOrdersBySessionIds,
  groupOrdersBySession,
} from '@/lib/analytics/analytics.repository';
import {
  loadClosedSessionRevenueBundleRpc,
  todayRevenueFromBundle,
} from '@/lib/analytics/closed-session-revenue';
import { resolveTodayLisbonWindow } from '@/lib/analytics/date-window';
import {
  aggregateBuffetHeadcountForOrders,
  type BuffetGuestHeadcount,
} from '@/lib/buffet-order';
import { printJobMaxAgeCutoffIso } from '@/lib/print-job-max-age';
import type { UILanguage } from '@/lib/i18n';
import { pickTrilingualName, type TrilingualName } from '@/lib/i18n/pick-trilingual-name';
import type { Order, OrderItem, OrderStatus } from '@/types';
import { countPendingCheckoutRequests } from '@/lib/table-checkout-pending';
import { loadOrdersForActiveWaiterBoardSessions } from '@/lib/waiter-board-active-orders';
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
  inProgressOrders: number;
  pendingCheckout: number;
  pendingAbnormal: number;
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
   * Qualifying closed sessions with revenue on Lisbon today — same set as todayRevenue
   * (`revenueSessionCount` from the closed-session revenue bundle).
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
>;

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

/**
 * Floor dining KPIs: session count + headcount summed per session/table group.
 * Do not call aggregateBuffetHeadcountForOrders on the whole floor — it dedupes by
 * buffet_id and would undercount when many tables share one package id.
 */
export function computeDiningFloorKpis(
  diningTableCount: number,
  orders: Array<Pick<Order, 'items' | 'status' | 'session_id' | 'table_id'>>,
): Pick<DashboardTodayKpis, 'diningTableCount' | 'diningGuests'> {
  const byGroup = new Map<string, Array<Pick<Order, 'items' | 'status'>>>();
  for (const order of orders) {
    const key = order.session_id
      ? `session:${order.session_id}`
      : order.table_id
        ? `table:${order.table_id}`
        : null;
    if (!key) continue;
    const list = byGroup.get(key);
    if (list) list.push(order);
    else byGroup.set(key, [order]);
  }

  let adults = 0;
  let children = 0;
  for (const group of Array.from(byGroup.values())) {
    const headcount = aggregateBuffetHeadcountForOrders(group);
    if (!headcount) continue;
    adults += headcount.adults;
    children += headcount.children;
  }

  return {
    diningTableCount,
    diningGuests: { adults, children },
  };
}

/** Today tables + guests + revenue share Lisbon-day closed_at qualifying set. */
export function computeTodayKpis(
  revenue: {
    todayRevenue: number;
    revenueSessionCount: number;
    todayGuests: BuffetGuestHeadcount;
  } | null,
  dining: Pick<DashboardTodayKpis, 'diningTableCount' | 'diningGuests'>,
): DashboardTodayKpis {
  return {
    todayTableCount: revenue?.revenueSessionCount ?? 0,
    todayRevenue: revenue?.todayRevenue ?? 0,
    revenueAvailable: revenue != null,
    todayGuests: revenue?.todayGuests ?? { adults: 0, children: 0 },
    diningTableCount: dining.diningTableCount,
    diningGuests: dining.diningGuests,
  };
}

async function loadDiningFloorKpis(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<Pick<DashboardTodayKpis, 'diningTableCount' | 'diningGuests'>> {
  const { data } = await admin
    .from('table_sessions')
    .select('id, table_id, opened_at, status')
    .eq('restaurant_id', restaurantId)
    .in('status', ['open', 'billing']);
  const sessionRows = (data || []) as WaiterTableSessionRow[];
  const orders = await loadOrdersForActiveWaiterBoardSessions(admin, restaurantId, sessionRows);
  return computeDiningFloorKpis(sessionRows.length, orders);
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
    actions.inProgressOrders +
    actions.pendingCheckout +
    actions.pendingAbnormal +
    actions.pendingPrint
  );
}

async function loadTodayRevenueKpis(
  admin: SupabaseClient,
  restaurantId: string,
  startUtc: string,
  endExclusiveUtc: string,
  todayDateKey: string,
): Promise<{
  todayRevenue: number;
  revenueSessionCount: number;
  todayGuests: BuffetGuestHeadcount;
} | null> {
  const revenueBundleResult = await loadClosedSessionRevenueBundleRpc(
    admin,
    restaurantId,
    startUtc,
    endExclusiveUtc,
  );
  if (!revenueBundleResult.ok) return null;

  const { bundle } = revenueBundleResult;
  const sessionIds = bundle.sessions.map((session) => session.id);
  if (sessionIds.length === 0) {
    return todayRevenueFromBundle(bundle, todayDateKey);
  }

  const itemOrdersResult = await fetchItemOrdersBySessionIds(admin, restaurantId, sessionIds);
  if (!itemOrdersResult.ok) return null;

  return todayRevenueFromBundle(
    bundle,
    todayDateKey,
    groupOrdersBySession(itemOrdersResult.rows),
  );
}

export async function loadDashboardOverviewPrimary(
  admin: SupabaseClient,
  restaurantId: string,
  now = new Date(),
): Promise<DashboardOverviewPrimaryView> {
  const todayWindow = resolveTodayLisbonWindow(now);

  const [
    { count: inProgressOrderCount },
    pendingCheckoutCount,
    { count: pendingAbnormalCount },
    { count: pendingPrintCount },
    todayRevenue,
    diningFloor,
  ] = await Promise.all([
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .neq('status', 'done'),
    countPendingCheckoutRequests(admin, restaurantId),
    admin
      .from('abnormal_operations')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'PENDING'),
    admin
      .from('print_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')
      .gte('created_at', printJobMaxAgeCutoffIso(now)),
    loadTodayRevenueKpis(
      admin,
      restaurantId,
      todayWindow.startUtc,
      todayWindow.endExclusiveUtc,
      todayWindow.today,
    ),
    loadDiningFloorKpis(admin, restaurantId),
  ]);

  return {
    todayKpis: computeTodayKpis(todayRevenue, diningFloor),
    pendingActions: {
      inProgressOrders: inProgressOrderCount ?? 0,
      pendingCheckout: pendingCheckoutCount,
      pendingAbnormal: pendingAbnormalCount ?? 0,
      pendingPrint: pendingPrintCount ?? 0,
    },
  };
}

export async function loadDashboardOverviewSecondary(
  admin: SupabaseClient,
  restaurantId: string,
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
