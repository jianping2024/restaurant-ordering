import type {
  OrderHistoryCloseAnnotation,
  OrderHistoryCloseOutcome,
} from '@/lib/order-history/types';
import type { getMessages } from '@/lib/i18n/messages';

type OrderHistoryI18n = ReturnType<typeof getMessages>['orderHistory'];

/** Visual weight for abnormal closes — not a new session status. */
export type OrderHistoryAbnormalEmphasis = 'strong' | 'moderate' | 'none';

/**
 * Strong = forced unpaid (UNPAID_TABLE_CLOSED).
 * Moderate = unpaid / partial collection outcomes.
 * None = settled paid or closed without billing (incl. nightly/merge empty).
 */
export function resolveOrderHistoryAbnormalEmphasis(
  outcome: OrderHistoryCloseOutcome,
  closeAnnotation: OrderHistoryCloseAnnotation,
): OrderHistoryAbnormalEmphasis {
  if (closeAnnotation.isForcedUnpaidClose) return 'strong';
  if (outcome === 'unpaid_closed' || outcome === 'partially_collected_closed') {
    return 'moderate';
  }
  return 'none';
}

/** Who closed: operator name, nightly system label, merge label, or em dash. */
export function resolveOrderHistoryClosedByLabel(
  closedByName: string | null,
  closedReason: string | null | undefined,
  i18n: OrderHistoryI18n,
): string {
  const name = closedByName?.trim();
  if (name) return name;
  if (closedReason === 'auto_nightly') return i18n.closedByNightly;
  if (closedReason === 'merged') return i18n.closedByMerged;
  return '—';
}

export type OrderHistoryLifecycleLines = {
  openedLine: string;
  closedLine: string;
};

/** Single lifecycle copy shape for list + detail. */
export function buildOrderHistoryLifecycleLines(
  input: {
    openedAt: string | null;
    openedByName: string | null;
    closedAt: string;
    closedByName: string | null;
    closedReason: string | null | undefined;
  },
  i18n: OrderHistoryI18n,
  formatInstant: (iso: string) => string,
): OrderHistoryLifecycleLines {
  const openedWhen = input.openedAt ? formatInstant(input.openedAt) : '—';
  const openedWho = input.openedByName?.trim() || '—';
  const closedWho = resolveOrderHistoryClosedByLabel(
    input.closedByName,
    input.closedReason,
    i18n,
  );

  return {
    openedLine: `${i18n.openedAtLabel} ${openedWhen} · ${i18n.openedBy} ${openedWho}`,
    closedLine: `${i18n.closedAtLabel} ${formatInstant(input.closedAt)} · ${i18n.closedBy} ${closedWho}`,
  };
}
