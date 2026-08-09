import type {
  OrderHistoryCloseAnnotation,
  OrderHistoryCloseOutcome,
  OrderHistoryEntry,
  OrderHistoryLifecycleStep,
} from '@/lib/order-history/types';
import {
  isOperationalSourceCloseKind,
  isTransferredSourceCloseKind,
} from '@/lib/order-history/close-kind';
import {
  resolveOperationalSourceOutcomeBadge,
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

function formatOperatorLabel(name: string | null | undefined, i18n: OrderHistoryI18n): string {
  const trimmed = name?.trim();
  return trimmed || i18n.lifecycleOperatorUnknown;
}

/** Single lifecycle line for list + detail. */
export function formatOrderHistoryLifecycleStepLine(
  step: OrderHistoryLifecycleStep,
  i18n: OrderHistoryI18n,
  formatInstant: (iso: string) => string = formatOrderHistoryInstant,
): string {
  const when = formatInstant(step.at);
  const operator = formatOperatorLabel(step.operatorName, i18n);

  switch (step.kind) {
    case 'opened':
      return i18n.lifecycleOpened
        .replace('{time}', when)
        .replace('{operator}', operator);
    case 'transferred':
      return i18n.lifecycleTransferred
        .replace('{time}', when)
        .replace('{detail}', step.detail ?? '—')
        .replace('{operator}', operator);
    case 'transferred_out':
      return i18n.lifecycleTransferredOut
        .replace('{time}', when)
        .replace('{table}', step.detail ?? '—')
        .replace('{operator}', operator);
    case 'merged_in':
      return i18n.lifecycleMergedIn
        .replace('{time}', when)
        .replace('{table}', step.detail ?? '—')
        .replace('{operator}', operator);
    case 'merged_out':
      return i18n.lifecycleMergedOut
        .replace('{time}', when)
        .replace('{table}', step.detail ?? '—')
        .replace('{operator}', operator);
    case 'closed':
      if (step.systemClose) {
        return i18n.lifecycleClosedNightly.replace('{time}', when);
      }
      return i18n.lifecycleClosed
        .replace('{time}', when)
        .replace('{operator}', operator);
  }
}

export function buildContinuedSessionSummaryLine(
  entry: OrderHistoryEntry,
  i18n: OrderHistoryI18n,
): string {
  const ctx = entry.mergeContext;
  const isTransfer = isTransferredSourceCloseKind(entry.closeKind);

  if (!ctx?.targetDisplayName || ctx.targetDisplayName === '—') {
    return isTransfer ? i18n.transferredIntoUnknown : i18n.mergedIntoUnknown;
  }
  if (ctx.targetStatus === 'open' || ctx.targetStatus === 'billing') {
    const template = isTransfer ? i18n.transferredIntoInProgress : i18n.mergedIntoInProgress;
    return template.replace('{table}', ctx.targetDisplayName);
  }
  const template = isTransfer ? i18n.transferredIntoSummary : i18n.mergedIntoSummary;
  return template.replace('{table}', ctx.targetDisplayName);
}

export function buildOperationalSourceDetailStatus(
  entry: OrderHistoryEntry,
  i18n: OrderHistoryI18n,
): string {
  return buildContinuedSessionSummaryLine(entry, i18n);
}

export type OrderHistorySurfaceMeta = {
  outcomeBadge: OrderHistoryOutcomeBadge;
  abnormal: OrderHistoryAbnormalEmphasis;
  lifecycleSteps: OrderHistoryLifecycleStep[];
  cardClass: string;
  lifecycleBoxClass: string;
  mergeSummaryLine: string | null;
};

/** Shared list/detail chrome derived from one entry. closeKind gates before settlement outcome. */
export function buildOrderHistorySurfaceMeta(
  entry: OrderHistoryEntry,
  i18n: OrderHistoryI18n,
): OrderHistorySurfaceMeta {
  const { lifecycleSteps } = entry;

  if (isOperationalSourceCloseKind(entry.closeKind)) {
    return {
      outcomeBadge: resolveOperationalSourceOutcomeBadge(entry.closeKind, i18n),
      abnormal: 'none',
      lifecycleSteps,
      cardClass: resolveOrderHistoryCardClass('none'),
      lifecycleBoxClass: resolveOrderHistoryLifecycleBoxClass('none'),
      mergeSummaryLine: buildContinuedSessionSummaryLine(entry, i18n),
    };
  }

  const abnormal = resolveOrderHistoryAbnormalEmphasis(
    entry.settlement.outcome,
    entry.closeAnnotation,
  );
  return {
    outcomeBadge: resolveOrderHistoryOutcomeBadge(entry.settlement.outcome, i18n),
    abnormal,
    lifecycleSteps,
    cardClass: resolveOrderHistoryCardClass(abnormal),
    lifecycleBoxClass: resolveOrderHistoryLifecycleBoxClass(abnormal),
    mergeSummaryLine: null,
  };
}
