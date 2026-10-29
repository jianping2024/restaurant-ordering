/**
 * Sole dine-in / takeaway revenue split from closed-session revenue materials.
 * Channel = session stamp (`ordering_channel`); missing → dine_in (legacy).
 */
import { auditMoney } from '@/lib/audit/money';
import type { ClosedSessionRevenueBundle } from '@/lib/analytics/closed-session-revenue';
import type { ClosedSessionRow } from '@/lib/analytics/analytics.types';
import { sessionRevenueDateKey } from '@/lib/analytics/session-revenue-date';
import { sessionRevenue } from '@/lib/analytics/qualifying';
import {
  normalizeOrderingChannel,
  type OrderingChannel,
} from '@/lib/instore-takeaway';

export type RevenueByOrderingChannel = {
  total: number;
  dine_in: number;
  takeaway: number;
};

function sessionChannel(session: ClosedSessionRow): OrderingChannel {
  return normalizeOrderingChannel(session.ordering_channel);
}

/**
 * Sum collected revenue for qualifying sessions, split by ordering channel.
 * Optional `dateKey` limits to one Lisbon business day (opened_at).
 */
export function revenueByOrderingChannel(
  bundle: ClosedSessionRevenueBundle,
  qualifying: ClosedSessionRow[],
  options?: { dateKey?: string },
): RevenueByOrderingChannel {
  let dineIn = 0;
  let takeaway = 0;
  for (const session of qualifying) {
    if (bundle.forcedClosedSessionIds.has(session.id)) continue;
    if (options?.dateKey && sessionRevenueDateKey(session) !== options.dateKey) continue;
    const orders = bundle.ordersBySession.get(session.id) || [];
    const splits = bundle.splitsBySession.get(session.id) || [];
    const amount = sessionRevenue(orders, splits, true, session.settled_payable_amount);
    if (amount <= 0) continue;
    if (sessionChannel(session) === 'takeaway') takeaway += amount;
    else dineIn += amount;
  }
  const dine_in = auditMoney(dineIn);
  const takeawayAmt = auditMoney(takeaway);
  return {
    dine_in,
    takeaway: takeawayAmt,
    total: auditMoney(dine_in + takeawayAmt),
  };
}

/** Display amount for the revenue-card segment control. */
export function revenueForChannelSegment(
  split: RevenueByOrderingChannel,
  segment: 'all' | OrderingChannel,
): number {
  if (segment === 'dine_in') return split.dine_in;
  if (segment === 'takeaway') return split.takeaway;
  return split.total;
}
