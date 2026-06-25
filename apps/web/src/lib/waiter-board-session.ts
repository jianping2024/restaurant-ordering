import type { UILanguage } from '@/lib/i18n';
import { isTableCheckoutRequested } from '@/lib/table-checkout-pending';
import type { Order } from '@/types';

export type WaiterTableSessionMeta = {
  sessionId: string;
  openedAt: string;
  status: 'open' | 'billing';
};

export type WaiterBoardFilter = 'all' | 'checkout' | 'dining' | 'idle';

export type WaiterTableBoardState = 'checkout' | 'dining' | 'idle';

export function classifyWaiterTableBoardState(
  tableId: string,
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
  checkoutRequestedTableIds: readonly string[],
): WaiterTableBoardState {
  const session = sessionMetaByTableId[tableId];
  const isCheckoutPending =
    isTableCheckoutRequested(tableId, checkoutRequestedTableIds) || session?.status === 'billing';
  if (isCheckoutPending) return 'checkout';
  if (session) return 'dining';
  return 'idle';
}

export function filterWaiterBoardTableIds(
  tableIds: readonly string[],
  filter: WaiterBoardFilter,
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
  checkoutRequestedTableIds: readonly string[],
): string[] {
  if (filter === 'all') return [...tableIds];
  return tableIds.filter(
    (tableId) =>
      classifyWaiterTableBoardState(tableId, sessionMetaByTableId, checkoutRequestedTableIds) ===
      filter,
  );
}

export type WaiterBoardStats = {
  total: number;
  idle: number;
  open: number;
  checkoutPending: number;
};

type DurationLabels = {
  hoursMinutes: (hours: number, minutes: number) => string;
  minutesOnly: (minutes: number) => string;
};

const DURATION_LABELS: Record<UILanguage, DurationLabels> = {
  zh: {
    hoursMinutes: (hours, minutes) => `${hours}小时${minutes}分`,
    minutesOnly: (minutes) => `${minutes}分`,
  },
  en: {
    hoursMinutes: (hours, minutes) => `${hours}h ${minutes}m`,
    minutesOnly: (minutes) => `${minutes}m`,
  },
  pt: {
    hoursMinutes: (hours, minutes) => `${hours}h ${minutes}m`,
    minutesOnly: (minutes) => `${minutes}m`,
  },
};

export function activeSessionIdByTableIdFromMeta(
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [tableId, meta] of Object.entries(sessionMetaByTableId)) {
    out[tableId] = meta.sessionId;
  }
  return out;
}

/** Demo board: infer session open time from earliest order on each table. */
export function demoSessionMetaFromOrders(orders: Order[]): Record<string, WaiterTableSessionMeta> {
  const map: Record<string, WaiterTableSessionMeta> = {};
  for (const order of orders) {
    if (!order.table_id || !order.session_id || !order.created_at) continue;
    const existing = map[order.table_id];
    if (!existing || order.created_at < existing.openedAt) {
      map[order.table_id] = {
        sessionId: order.session_id,
        openedAt: order.created_at,
        status: 'open',
      };
    }
  }
  return map;
}

/** Elapsed time between session open and checkout request (or now), formatted as hours + minutes. */
export function formatSessionDurationHm(
  openedAtIso: string,
  endAtIso: string | null | undefined,
  lang: UILanguage,
  nowMs = Date.now(),
): string {
  const startMs = new Date(openedAtIso).getTime();
  if (Number.isNaN(startMs)) return '';
  const endMs = endAtIso ? new Date(endAtIso).getTime() : nowMs;
  if (Number.isNaN(endMs) || endMs < startMs) return '';

  const totalMinutes = Math.floor((endMs - startMs) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const labels = DURATION_LABELS[lang];
  if (hours > 0) return labels.hoursMinutes(hours, minutes);
  return labels.minutesOnly(minutes);
}

export function buildWaiterTableCardSubtitle(input: {
  guestCount: number;
  sessionTotal: number;
  session: WaiterTableSessionMeta | undefined;
  hasCheckoutRequest: boolean;
  lang: UILanguage;
  checkoutRequestedAt: string | null;
  nowMs: number;
  labels: {
    guestCount: string;
    sessionAmount: string;
    checkoutPendingSubtitle: string;
    clickToView: string;
  };
}): string {
  const parts: string[] = [];
  if (input.guestCount > 0) {
    parts.push(input.labels.guestCount.replace('{n}', String(input.guestCount)));
  }
  if (input.session) {
    const duration = formatSessionDurationHm(
      input.session.openedAt,
      input.checkoutRequestedAt,
      input.lang,
      input.nowMs,
    );
    if (duration) parts.push(duration);
  }
  if (input.sessionTotal > 0) {
    parts.push(
      input.labels.sessionAmount.replace('{amount}', input.sessionTotal.toFixed(2)),
    );
  }
  if (parts.length > 0) return parts.join(' · ');
  if (input.hasCheckoutRequest) return input.labels.checkoutPendingSubtitle;
  return input.labels.clickToView;
}

export function computeWaiterBoardStats(
  tableIds: readonly string[],
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
  checkoutRequestedTableIds: readonly string[],
): WaiterBoardStats {
  let idle = 0;
  let open = 0;
  let checkoutPending = 0;

  for (const tableId of tableIds) {
    const session = sessionMetaByTableId[tableId];
    const isCheckoutPending =
      isTableCheckoutRequested(tableId, checkoutRequestedTableIds) ||
      session?.status === 'billing';

    if (isCheckoutPending) checkoutPending += 1;
    else if (session) open += 1;
    else idle += 1;
  }

  return {
    total: tableIds.length,
    idle,
    open,
    checkoutPending,
  };
}
