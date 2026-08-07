import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSessionLifecycleSteps } from '@/lib/order-history/build-session-lifecycle';
import type { OrderHistoryEntry } from '@/lib/order-history/types';

function entry(overrides: Partial<OrderHistoryEntry>): OrderHistoryEntry {
  return {
    historyRecordId: 'sess-1',
    sessionId: 'sess-1',
    tableId: 'table-1',
    displayName: 'A-02',
    closeKind: 'billing',
    openedAt: '2026-07-27T12:00:00.000Z',
    openedByName: 'Alice',
    closedAt: '2026-07-27T14:00:00.000Z',
    closedByName: 'Bob',
    closedReason: 'frontdesk_closed',
    itemCount: 1,
    closeAnnotation: { isForcedUnpaidClose: false },
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
    lifecycleSteps: [],
    orders: [],
    ...overrides,
  };
}

describe('buildSessionLifecycleSteps', () => {
  it('orders open, transfer, merge-in, and close', () => {
    const steps = buildSessionLifecycleSteps(
      entry({
        transferEvents: [
          {
            id: 'evt-1',
            occurredAt: '2026-07-27T13:00:00.000Z',
            operatorUserId: 'u1',
            operatorName: 'Alice',
            fromTableId: 't1',
            toTableId: 't2',
            fromDisplayName: 'A-04',
            toDisplayName: 'A-02',
          },
        ],
        mergeSources: [
          {
            sourceSessionId: 'src-1',
            sourceTableId: 't3',
            sourceDisplayName: 'A-06',
            mergedAt: '2026-07-27T13:30:00.000Z',
            mergedByName: 'Carol',
          },
        ],
      }),
    );

    assert.deepEqual(
      steps.map((step) => step.kind),
      ['opened', 'transferred', 'merged_in', 'closed'],
    );
    assert.equal(steps[1]?.detail, 'A-04 → A-02');
    assert.equal(steps[2]?.operatorName, 'Carol');
  });

  it('uses merged_out for merge source sessions', () => {
    const steps = buildSessionLifecycleSteps(
      entry({
        closeKind: 'merged_source',
        closedReason: 'merged',
        closedByName: 'Dave',
        mergeContext: {
          targetSessionId: 'target-1',
          targetTableId: 't-target',
          targetDisplayName: 'A-02',
          targetStatus: 'closed',
        },
      }),
    );

    assert.deepEqual(steps.map((step) => step.kind), ['opened', 'merged_out']);
    assert.equal(steps[1]?.operatorName, 'Dave');
    assert.equal(steps[1]?.detail, 'A-02');
  });

  it('uses transferred_out for transfer source sessions', () => {
    const steps = buildSessionLifecycleSteps(
      entry({
        historyRecordId: 'transfer:evt-1',
        closeKind: 'transferred_source',
        closedReason: null,
        closedByName: 'Dave',
        mergeContext: {
          targetSessionId: 'target-1',
          targetTableId: 't-target',
          targetDisplayName: 'B-03',
          targetStatus: 'billing',
        },
      }),
    );

    assert.deepEqual(steps.map((step) => step.kind), ['opened', 'transferred_out']);
    assert.equal(steps[1]?.detail, 'B-03');
  });
});
