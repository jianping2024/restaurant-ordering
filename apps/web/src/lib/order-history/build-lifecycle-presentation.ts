import type {
  OrderHistoryCloseAnnotation,
  OrderHistoryCloseOutcome,
  OrderHistoryEntry,
} from '@/lib/order-history/types';
import {
  buildMergedIntoSummaryLine,
  resolveMergedSourceOutcomeBadge,
} from '@/lib/order-history/build-merge-presentation';
import {
  resolveOrderHistoryOutcomeBadge,
  type OrderHistoryOutcomeBadge,
} from '@/lib/order-history/build-detail-presentation';
import type { getMessages } from '@/lib/i18n/messages';

type OrderHistoryI18n = ReturnType<typeof getMessages>['orderHistory'];

/** Visual weight for abnormal closes — not a new session status. */
export type OrderHistoryAbnormalEmphasis = 'strong' | 'moderate' | 'none';

const CARD_SHELL =
  'rounded-xl px-4 py-3 text-left w-full cursor-pointer transition-colors';

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

export function resolveOrderHistoryCardClass(
  emphasis: OrderHistoryAbnormalEmphasis,
): string {
  switch (emphasis) {
    case 'strong':
      return `${CARD_SHELL} bg-amber-500/10 border border-amber-500/45 hover:border-amber-500/60 ring-1 ring-amber-500/20`;
    case 'moderate':
      return `${CARD_SHELL} bg-amber-500/5 border border-amber-500/25 hover:border-amber-500/40`;
    case 'none':
      return `${CARD_SHELL} bg-brand-card border border-brand-border hover:border-brand-gold/40`;
  }
}

/**
 * Theme-aware warning chrome for forced / strong surfaces.
 * Uses mesa-alert / mesa-text-warning so light theme gets dark amber fg.
 */
export const ORDER_HISTORY_FORCED_SUMMARY_CLASS =
  'mt-2 text-[13px] font-medium mesa-text-warning';

export const ORDER_HISTORY_FORCED_CALLOUT_CLASS =
  'mesa-alert-warning px-3 py-2.5 text-sm';

export const ORDER_HISTORY_FORCED_CALLOUT_TITLE_CLASS = 'font-medium';

export const ORDER_HISTORY_FORCED_CALLOUT_DETAIL_CLASS =
  'mt-1 text-[13px] opacity-80';

export function resolveOrderHistoryLifecycleBoxClass(
  emphasis: OrderHistoryAbnormalEmphasis,
): string {
  if (emphasis === 'strong') {
    return 'space-y-0.5 text-sm rounded-lg mesa-alert-warning px-3 py-2';
  }
  return 'space-y-0.5 text-sm text-brand-text-muted';
}

/** Lisbon wall-clock for lifecycle lines (SSR/client stable). */
export function formatOrderHistoryInstant(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('day')}/${get('month')}/${get('year')}, ${get('hour')}:${get('minute')}:${get('second')}`;
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
  formatInstant: (iso: string) => string = formatOrderHistoryInstant,
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

export type OrderHistorySurfaceMeta = {
  outcomeBadge: OrderHistoryOutcomeBadge;
  abnormal: OrderHistoryAbnormalEmphasis;
  lifecycle: OrderHistoryLifecycleLines;
  cardClass: string;
  lifecycleBoxClass: string;
  mergeSummaryLine: string | null;
  isMergedSource: boolean;
};

/** Shared list/detail chrome derived from one entry. closeKind gates before settlement outcome. */
export function buildOrderHistorySurfaceMeta(
  entry: OrderHistoryEntry,
  i18n: OrderHistoryI18n,
): OrderHistorySurfaceMeta {
  const lifecycle = buildOrderHistoryLifecycleLines(entry, i18n);

  if (entry.closeKind === 'merged_source') {
    return {
      outcomeBadge: resolveMergedSourceOutcomeBadge(i18n),
      abnormal: 'none',
      lifecycle,
      cardClass: resolveOrderHistoryCardClass('none'),
      lifecycleBoxClass: resolveOrderHistoryLifecycleBoxClass('none'),
      mergeSummaryLine: buildMergedIntoSummaryLine(entry, i18n),
      isMergedSource: true,
    };
  }

  const abnormal = resolveOrderHistoryAbnormalEmphasis(
    entry.settlement.outcome,
    entry.closeAnnotation,
  );
  return {
    outcomeBadge: resolveOrderHistoryOutcomeBadge(entry.settlement.outcome, i18n),
    abnormal,
    lifecycle,
    cardClass: resolveOrderHistoryCardClass(abnormal),
    lifecycleBoxClass: resolveOrderHistoryLifecycleBoxClass(abnormal),
    mergeSummaryLine: null,
    isMergedSource: false,
  };
}
