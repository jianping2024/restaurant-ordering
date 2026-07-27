import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ORDER_HISTORY_FORCED_SUMMARY_CLASS,
  buildMergedIntoSummaryLine,
  buildOrderHistoryLifecycleLines,
  buildOrderHistorySurfaceMeta,
  resolveOrderHistoryAbnormalEmphasis,
  resolveOrderHistoryCardClass,
  resolveOrderHistoryClosedByLabel,
  resolveOrderHistoryLifecycleBoxClass,
} from '@/lib/order-history/build-lifecycle-presentation';
import {
  ORDER_HISTORY_OUTCOME_BADGE_CLASS,
  resolveMergedSourceOutcomeBadge,
} from '@/lib/order-history/build-detail-presentation';
import { getMessages } from '@/lib/i18n/messages';
import type { OrderHistoryEntry } from '@/lib/order-history/types';

const i18n = getMessages('zh').orderHistory;

describe('resolveOrderHistoryAbnormalEmphasis', () => {
  it('marks forced unpaid as strong', () => {
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('unpaid_closed', {
        isForcedUnpaidClose: true,
        reasonCode: 'left_unpaid',
        reasonDetail: null,
      }),
      'strong',
    );
  });

  it('marks unpaid and partial as moderate without forced annotation', () => {
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('unpaid_closed', { isForcedUnpaidClose: false }),
      'moderate',
    );
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('partially_collected_closed', {
        isForcedUnpaidClose: false,
      }),
      'moderate',
    );
  });

  it('does not emphasize settled or without-billing', () => {
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('fully_paid', { isForcedUnpaidClose: false }),
      'none',
    );
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('closed_without_billing', {
        isForcedUnpaidClose: false,
      }),
      'none',
    );
  });
});

describe('resolveOrderHistoryClosedByLabel', () => {
  it('prefers operator name', () => {
    assert.equal(
      resolveOrderHistoryClosedByLabel('YAN ZI', 'auto_nightly', i18n),
      'YAN ZI',
    );
  });

  it('uses nightly and merge labels when operator missing', () => {
    assert.equal(resolveOrderHistoryClosedByLabel(null, 'auto_nightly', i18n), '夜间自动');
    assert.equal(resolveOrderHistoryClosedByLabel(null, 'merged', i18n), '并台');
    assert.equal(resolveOrderHistoryClosedByLabel(null, 'frontdesk_closed', i18n), '—');
  });
});

describe('buildOrderHistoryLifecycleLines', () => {
  it('builds labeled open and close lines', () => {
    const lines = buildOrderHistoryLifecycleLines(
      {
        openedAt: '2026-07-26T10:00:00.000Z',
        openedByName: 'Waiter',
        closedAt: '2026-07-26T14:00:00.000Z',
        closedByName: 'Cashier',
        closedReason: 'cashier_closed',
      },
      i18n,
      (iso) => iso.slice(0, 10),
    );
    assert.equal(lines.openedLine, '开桌时间 2026-07-26 · 开桌 Waiter');
    assert.equal(lines.closedLine, '关台时间 2026-07-26 · 关台人 Cashier');
  });
});

describe('resolveOrderHistoryCardClass', () => {
  it('returns distinct classes per emphasis', () => {
    const strong = resolveOrderHistoryCardClass('strong');
    const moderate = resolveOrderHistoryCardClass('moderate');
    const none = resolveOrderHistoryCardClass('none');
    assert.notEqual(strong, moderate);
    assert.notEqual(moderate, none);
    assert.match(strong, /amber-500\/10/);
    assert.match(none, /brand-card/);
  });
});

describe('resolveOrderHistoryLifecycleBoxClass', () => {
  it('uses theme warning alert for strong emphasis', () => {
    assert.match(resolveOrderHistoryLifecycleBoxClass('strong'), /mesa-alert-warning/);
    assert.match(resolveOrderHistoryLifecycleBoxClass('none'), /text-brand-text-muted/);
    assert.match(resolveOrderHistoryLifecycleBoxClass('moderate'), /text-brand-text-muted/);
  });
});

describe('ORDER_HISTORY_FORCED_SUMMARY_CLASS', () => {
  it('uses theme warning text (not pale amber-100/200)', () => {
    assert.match(ORDER_HISTORY_FORCED_SUMMARY_CLASS, /mesa-text-warning/);
    assert.doesNotMatch(ORDER_HISTORY_FORCED_SUMMARY_CLASS, /amber-(?:100|200)/);
  });
});

describe('ORDER_HISTORY_OUTCOME_BADGE_CLASS', () => {
  it('uses theme status badges for success and warning tones', () => {
    assert.equal(ORDER_HISTORY_OUTCOME_BADGE_CLASS.success, 'mesa-badge-success');
    assert.equal(ORDER_HISTORY_OUTCOME_BADGE_CLASS.warning, 'mesa-badge-warning');
    assert.doesNotMatch(ORDER_HISTORY_OUTCOME_BADGE_CLASS.warning, /amber-(?:100|200)/);
  });
});

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

describe('merge surface presentation', () => {
  it('uses merged outcome badge label', () => {
    const badge = resolveMergedSourceOutcomeBadge(i18n);
    assert.equal(badge.label, '已并台');
    assert.equal(badge.tone, 'muted');
  });

  it('builds merged into summary for closed target', () => {
    assert.equal(buildMergedIntoSummaryLine(mergedEntry(), i18n), '已并入 A-04');
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

  it('prefers merged badge over closed_without_billing outcome', () => {
    const meta = buildOrderHistorySurfaceMeta(mergedEntry(), i18n);
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
    assert.equal(meta.outcomeBadge.label, '已结账关台');
    assert.equal(meta.mergeSummaryLine, null);
  });
});
