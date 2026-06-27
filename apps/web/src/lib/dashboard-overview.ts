import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateMenuItemsFromOrders, rankMenuItemAggs, type MenuItemAgg } from '@/lib/analytics/aggregate-items';
import { printJobMaxAgeCutoffIso } from '@/lib/print-job-max-age';
import type { UILanguage } from '@/lib/i18n';
import type { Order } from '@/types';

export const DASHBOARD_FEEDBACK_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
export const DASHBOARD_RECENT_ORDERS_LIMIT = 5;
export const DASHBOARD_TOP_SELLING_LIMIT = 5;

export type DashboardTopItem = {
  name: string;
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
  dish_name: string;
  down_count: number;
};

export type DashboardFeedbackPraise = {
  menu_item_id: string;
  dish_name: string;
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
  todayOrderCount: number;
  todayRevenue: number;
  avgTicketPrice: number;
};

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

function feedbackLookbackIso(now = new Date()): string {
  return new Date(now.getTime() - DASHBOARD_FEEDBACK_LOOKBACK_MS).toISOString();
}

function todayStartIso(now = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export function menuItemAggDisplayName(agg: MenuItemAgg, lang: UILanguage): string {
  if (lang === 'zh') {
    return (agg.nameZh || agg.nameEn || agg.namePt || agg.itemId).trim();
  }
  if (lang === 'pt') {
    return (agg.namePt || agg.nameEn || agg.nameZh || agg.itemId).trim();
  }
  return (agg.nameEn || agg.namePt || agg.nameZh || agg.itemId).trim();
}

function dishNameFromRow(row: DishFeedbackRow, lang: UILanguage): string {
  const nested = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items;
  if (lang === 'zh') {
    return nested?.name_zh || nested?.name_en || nested?.name_pt || row.menu_item_id;
  }
  if (lang === 'pt') {
    return nested?.name_pt || nested?.name_en || nested?.name_zh || row.menu_item_id;
  }
  return nested?.name_en || nested?.name_pt || nested?.name_zh || row.menu_item_id;
}

export function computeTodayKpis(orders: Order[]): DashboardTodayKpis {
  const todayOrderCount = orders.length;
  const todayRevenue = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
  const avgTicketPrice = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;
  return { todayOrderCount, todayRevenue, avgTicketPrice };
}

export function buildTodayTopSellingItems(
  orders: Order[],
  lang: UILanguage,
  limit = DASHBOARD_TOP_SELLING_LIMIT,
): DashboardTopItem[] {
  return rankMenuItemAggs(aggregateMenuItemsFromOrders(orders), limit).map((agg) => ({
    name: menuItemAggDisplayName(agg, lang),
    count: agg.consumedQuantity,
    revenue: agg.amount,
  }));
}

export function buildFeedbackInsights(
  feedbackSessions: FeedbackSessionRow[],
  billedSplits: BilledSplitRow[],
  dishFeedbackRows: DishFeedbackRow[],
  lang: UILanguage,
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
    const dishName = dishNameFromRow(row, lang);
    const current = issueMap.get(row.menu_item_id) || { menu_item_id: row.menu_item_id, dish_name: dishName, down_count: 0 };
    current.down_count += 1;
    issueMap.set(row.menu_item_id, current);
  });

  const praiseMap = new Map<string, DashboardFeedbackPraise>();
  upRows.forEach((row) => {
    const dishName = dishNameFromRow(row, lang);
    const current = praiseMap.get(row.menu_item_id) || { menu_item_id: row.menu_item_id, dish_name: dishName, up_count: 0 };
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

export async function loadDashboardOverviewData(
  admin: SupabaseClient,
  restaurantId: string,
  lang: UILanguage,
  now = new Date(),
): Promise<{
  todayOrders: Order[];
  recentOrders: Order[];
  pendingActions: DashboardPendingActions;
  todayKpis: DashboardTodayKpis;
  topItems: DashboardTopItem[];
  feedback: DashboardFeedbackInsights;
}> {
  const sinceIso = feedbackLookbackIso(now);
  const todayIso = todayStartIso(now);

  const [
    { data: todayOrders },
    { data: recentOrders },
    { count: inProgressOrderCount },
    { count: pendingCheckoutCount },
    { count: pendingAbnormalCount },
    { count: pendingPrintCount },
    { data: feedbackSessions },
    { data: billedSplits },
    { data: dishFeedbackRows },
  ] = await Promise.all([
    admin
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', todayIso),
    admin
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(DASHBOARD_RECENT_ORDERS_LIMIT),
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .neq('status', 'done'),
    admin
      .from('bill_splits')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'requested')
      .not('session_id', 'is', null),
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

  const orders = (todayOrders || []) as Order[];

  return {
    todayOrders: orders,
    recentOrders: (recentOrders || []) as Order[],
    pendingActions: {
      inProgressOrders: inProgressOrderCount ?? 0,
      pendingCheckout: pendingCheckoutCount ?? 0,
      pendingAbnormal: pendingAbnormalCount ?? 0,
      pendingPrint: pendingPrintCount ?? 0,
    },
    todayKpis: computeTodayKpis(orders),
    topItems: buildTodayTopSellingItems(orders, lang),
    feedback: buildFeedbackInsights(
      (feedbackSessions || []) as FeedbackSessionRow[],
      (billedSplits || []) as BilledSplitRow[],
      (dishFeedbackRows || []) as DishFeedbackRow[],
      lang,
    ),
  };
}
