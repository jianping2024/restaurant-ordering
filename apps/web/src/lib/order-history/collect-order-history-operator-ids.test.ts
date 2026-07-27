import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectOrderHistoryOperatorIds } from '@/lib/order-history/collect-order-history-operator-ids';
import type { OrderHistoryTransferEvent } from '@/lib/order-history/types';
import type { MergeSourceSessionRow } from '@/lib/order-history/load-merge-context';

describe('collectOrderHistoryOperatorIds', () => {
  it('collects open/close, merge, and transfer operator ids', () => {
    const sessions = [
      { opened_by_user_id: 'u1', closed_by_user_id: 'u2' },
      { opened_by_user_id: null, closed_by_user_id: 'u3' },
    ];
    const mergeSourcesByTargetId = new Map<string, MergeSourceSessionRow[]>([
      [
        'target',
        [
          {
            id: 'src',
            table_id: 't1',
            closed_at: '2026-01-01T00:00:00.000Z',
            closed_by_user_id: 'u4',
            merge_into_session_id: 'target',
          },
        ],
      ],
    ]);
    const transferEventsBySession = new Map<string, OrderHistoryTransferEvent[]>([
      [
        's1',
        [
          {
            id: 'e1',
            occurredAt: '2026-01-01T00:00:00.000Z',
            operatorUserId: 'u5',
            operatorName: null,
            fromTableId: 't1',
            toTableId: 't2',
            fromDisplayName: 'A-01',
            toDisplayName: 'A-02',
          },
        ],
      ],
    ]);

    const ids = collectOrderHistoryOperatorIds(
      sessions,
      mergeSourcesByTargetId,
      transferEventsBySession,
    );
    assert.deepEqual(new Set(ids), new Set(['u1', 'u2', 'u3', 'u4', 'u5']));
  });
});
