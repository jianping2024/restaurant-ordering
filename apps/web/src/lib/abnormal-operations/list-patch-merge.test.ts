import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergePatchedAbnormalOperationRow } from './list-patch-merge';
import type { AbnormalOperationsListResult } from './owner-query';
import type { AbnormalOperationRow } from './types';

function row(
  partial: Partial<AbnormalOperationRow> & Pick<AbnormalOperationRow, 'id' | 'status'>,
): AbnormalOperationRow {
  return {
    restaurant_id: 'r1',
    type: 'UNPAID_TABLE_CLOSED',
    risk_level: 'HIGH',
    order_id: null,
    session_id: null,
    table_id: 't1',
    table_name: 'A-05',
    operator_id: 'u1',
    operator_name: 'qiantai',
    operator_role: 'frontdesk',
    amount_impact: 69.5,
    reason: 'boss_approved',
    reason_detail: null,
    before_data: {},
    after_data: {},
    owner_note: null,
    confirmed_by: null,
    confirmed_at: null,
    source_action_id: null,
    created_at: '2026-06-26T10:00:00.000Z',
    updated_at: '2026-06-26T10:00:00.000Z',
    ...partial,
  };
}

function listData(items: AbnormalOperationRow[]): AbnormalOperationsListResult {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
    stats: {
      total_count: items.length,
      high_risk_count: items.filter((r) => r.risk_level === 'HIGH').length,
      amount_impact_sum: items.reduce((sum, r) => sum + r.amount_impact, 0),
      pending_count: items.filter((r) => r.status === 'PENDING').length,
    },
  };
}

describe('mergePatchedAbnormalOperationRow', () => {
  it('updates note in place without changing stats', () => {
    const before = row({ id: 'a1', status: 'PENDING' });
    const data = listData([before]);
    const after = row({ id: 'a1', status: 'PENDING', owner_note: '哈哈' });

    const next = mergePatchedAbnormalOperationRow(data, before, after);
    assert.equal(next.items[0].owner_note, '哈哈');
    assert.deepEqual(next.stats, data.stats);
    assert.equal(next.total, data.total);
  });

  it('decrements pending when confirming', () => {
    const before = row({ id: 'a1', status: 'PENDING' });
    const data = listData([before, row({ id: 'a2', status: 'CONFIRMED' })]);
    const after = row({ id: 'a1', status: 'CONFIRMED', owner_note: 'ok' });

    const next = mergePatchedAbnormalOperationRow(data, before, after);
    assert.equal(next.items[0].status, 'CONFIRMED');
    assert.equal(next.stats.pending_count, 0);
    assert.equal(next.stats.total_count, 2);
  });

  it('removes row from page when it no longer matches status filter', () => {
    const before = row({ id: 'a1', status: 'PENDING' });
    const data = listData([before]);
    const after = row({ id: 'a1', status: 'CONFIRMED' });

    const next = mergePatchedAbnormalOperationRow(data, before, after, 'PENDING');
    assert.equal(next.items.length, 0);
    assert.equal(next.total, 0);
    assert.equal(next.stats.total_count, 0);
    assert.equal(next.stats.pending_count, 0);
  });
});
