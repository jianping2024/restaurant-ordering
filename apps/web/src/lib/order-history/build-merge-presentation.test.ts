import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMergedIntoSummaryLine,
  resolveMergedSourceOutcomeBadge,
} from '@/lib/order-history/build-merge-presentation';
import {
  buildOrderHistorySurfaceMeta,
} from '@/lib/order-history/build-lifecycle-presentation';
import { getMessages } from '@/lib/i18n/messages';
import type { OrderHistoryEntry } from '@/lib/order-history/types';

const i18n = getMessages('zh').orderHistory;

function mergedEntry(
  overrides: Partial<OrderHistoryEntry> = {},
): OrderHistoryEntry {
  return {
    sessionId: 'source-1',
    tableId: 'table-source',
    displayName: 'B-03',
    closeKind: 'merged_source',
    openedAt: '2026-07-27T12:19:24.000Z',
    openedByName: 'Cashier',
    closedAt: '2026-07-27T12:23:29.000Z',
    closedByName: null,
    closedReason: 'merged',
    itemCount: 0,
    closeAnnotation: { isForcedUnpaidClose: false },
    orders: [],
    settlement: {
      outcome: 'closed_without_billing',
      summary: null,
      showFinancialDetails: false,
      collectedPayments: [],
      listAmount: null,
      listAmountKind: null,
      paidRevenue: null,
      canPrintBill: false,
    },
    mergeContext: {
      targetSessionId: 'target-1',
      targetTableId: 'table-target',
      targetDisplayName: 'A-04',
      targetStatus: 'closed',
    },
    ...overrides,
  };
}

describe('build-merge-presentation', () => {
  it('uses merged outcome badge label', () => {
    const badge = resolveMergedSourceOutcomeBadge(i18n);
    assert.equal(badge.label, '已并台');
    assert.equal(badge.tone, 'muted');
  });

  it('builds merged into summary for closed target', () => {
    const line = buildMergedIntoSummaryLine(mergedEntry(), i18n);
    assert.equal(line, '已并入 A-04');
  });

  it('builds in-progress summary when target still active', () => {
    const line = buildMergedIntoSummaryLine(
      mergedEntry({
        mergeContext: {
          targetSessionId: 'target-1',
          targetTableId: 'table-target',
          targetDisplayName: 'A-04',
          targetStatus: 'billing',
        },
      }),
      i18n,
    );
    assert.match(line, /进行中/);
    assert.match(line, /A-04/);
  });
});

describe('buildOrderHistorySurfaceMeta merged', () => {
  it('prefers merged badge over closed_without_billing outcome', () => {
    const meta = buildOrderHistorySurfaceMeta(mergedEntry(), i18n);
    assert.equal(meta.isMergedSource, true);
    assert.equal(meta.outcomeBadge.label, '已并台');
    assert.equal(meta.mergeSummaryLine, '已并入 A-04');
    assert.equal(meta.abnormal, 'none');
  });

  it('keeps billing path unchanged', () => {
    const meta = buildOrderHistorySurfaceMeta(
      {
        ...mergedEntry(),
        closeKind: 'billing',
        closedReason: 'frontdesk_closed',
        settlement: {
          outcome: 'fully_paid',
          summary: null,
          showFinancialDetails: false,
          collectedPayments: [],
          listAmount: 10,
          listAmountKind: 'paid',
          paidRevenue: 10,
          canPrintBill: true,
        },
      },
      i18n,
    );
    assert.equal(meta.isMergedSource, false);
    assert.equal(meta.outcomeBadge.label, '已结账关台');
    assert.equal(meta.mergeSummaryLine, null);
  });
});
