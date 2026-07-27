import type { OrderHistoryEntry } from '@/lib/order-history/types';
import type { OrderHistoryOutcomeBadge } from '@/lib/order-history/build-detail-presentation';
import type { getMessages } from '@/lib/i18n/messages';

type OrderHistoryI18n = ReturnType<typeof getMessages>['orderHistory'];

export function resolveMergedSourceOutcomeBadge(
  i18n: OrderHistoryI18n,
): OrderHistoryOutcomeBadge {
  return { label: i18n.outcomeMerged, tone: 'muted' };
}

export function buildMergedIntoSummaryLine(
  entry: OrderHistoryEntry,
  i18n: OrderHistoryI18n,
): string {
  const ctx = entry.mergeContext;
  if (!ctx?.targetDisplayName || ctx.targetDisplayName === '—') {
    return i18n.mergedIntoUnknown;
  }
  if (ctx.targetStatus === 'open' || ctx.targetStatus === 'billing') {
    return i18n.mergedIntoInProgress.replace('{table}', ctx.targetDisplayName);
  }
  return i18n.mergedIntoSummary.replace('{table}', ctx.targetDisplayName);
}

export function buildMergedSourceDetailStatus(
  entry: OrderHistoryEntry,
  i18n: OrderHistoryI18n,
): string {
  return `${buildMergedIntoSummaryLine(entry, i18n)} · ${i18n.mergedSourceOrdersTransferred}`;
}

export function formatMergeSourceLine(
  source: NonNullable<OrderHistoryEntry['mergeSources']>[number],
  i18n: OrderHistoryI18n,
  formatInstant: (iso: string) => string,
): string {
  return i18n.mergeSourceLine
    .replace('{table}', source.sourceDisplayName)
    .replace('{time}', formatInstant(source.mergedAt));
}
