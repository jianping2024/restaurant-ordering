import {
  isMergedSourceCloseKind,
  isOperationalSourceCloseKind,
  isTransferredSourceCloseKind,
} from '@/lib/order-history/close-kind';
import type { OrderHistoryEntry, OrderHistoryLifecycleStep } from '@/lib/order-history/types';

const LIFECYCLE_KIND_ORDER: Record<OrderHistoryLifecycleStep['kind'], number> = {
  opened: 0,
  transferred: 1,
  transferred_out: 2,
  merged_in: 3,
  merged_out: 4,
  closed: 5,
};

function formatOperator(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed || null;
}

/** Compose ordered session lifecycle from entry facts (single read-model shape). */
export function buildSessionLifecycleSteps(entry: OrderHistoryEntry): OrderHistoryLifecycleStep[] {
  const steps: OrderHistoryLifecycleStep[] = [];

  if (entry.openedAt) {
    steps.push({
      kind: 'opened',
      at: entry.openedAt,
      operatorName: formatOperator(entry.openedByName),
      detail: null,
      sortKey: 'opened',
    });
  }

  if (!isOperationalSourceCloseKind(entry.closeKind)) {
    for (const transfer of entry.transferEvents ?? []) {
      steps.push({
        kind: 'transferred',
        at: transfer.occurredAt,
        operatorName: formatOperator(transfer.operatorName),
        detail: `${transfer.fromDisplayName} → ${transfer.toDisplayName}`,
        sortKey: transfer.id,
      });
    }
  }

  if (isTransferredSourceCloseKind(entry.closeKind)) {
    steps.push({
      kind: 'transferred_out',
      at: entry.closedAt,
      operatorName: formatOperator(entry.closedByName),
      detail: entry.mergeContext?.targetDisplayName ?? null,
      sortKey: 'transferred_out',
    });
    return sortLifecycleSteps(steps);
  }

  if (isMergedSourceCloseKind(entry.closeKind)) {
    steps.push({
      kind: 'merged_out',
      at: entry.closedAt,
      operatorName: formatOperator(entry.closedByName),
      detail: entry.mergeContext?.targetDisplayName ?? null,
      sortKey: 'merged_out',
    });
    return sortLifecycleSteps(steps);
  }

  for (const source of entry.mergeSources ?? []) {
    steps.push({
      kind: 'merged_in',
      at: source.mergedAt,
      operatorName: formatOperator(source.mergedByName),
      detail: source.sourceDisplayName,
      sortKey: source.sourceSessionId,
      relatedSessionId: source.sourceSessionId,
    });
  }

  steps.push({
    kind: 'closed',
    at: entry.closedAt,
    operatorName:
      entry.closedReason === 'auto_nightly'
        ? null
        : formatOperator(entry.closedByName),
    detail: null,
    sortKey: 'closed',
    systemClose: entry.closedReason === 'auto_nightly',
  });

  return sortLifecycleSteps(steps);
}

function sortLifecycleSteps(steps: OrderHistoryLifecycleStep[]): OrderHistoryLifecycleStep[] {
  return [...steps].sort((left, right) => {
    const byTime = left.at.localeCompare(right.at);
    if (byTime !== 0) return byTime;

    const byKind = LIFECYCLE_KIND_ORDER[left.kind] - LIFECYCLE_KIND_ORDER[right.kind];
    if (byKind !== 0) return byKind;

    return left.sortKey.localeCompare(right.sortKey);
  });
}
