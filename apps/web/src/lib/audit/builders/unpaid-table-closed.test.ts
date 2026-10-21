import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unpaidTableClosedDefinition } from '@/lib/audit/builders/unpaid-table-closed';
import { AUDIT_EVENT } from '@/lib/audit/types';

describe('unpaidTableClosedDefinition', () => {
  it('writes tableName into afterData for operation-log 桌位 + search', () => {
    const payload = unpaidTableClosedDefinition.build({
      sessionId: 'sess-1',
      tableId: 'table-1',
      tableName: 'A5',
      sessionStatusBefore: 'billing',
      payableAmount: 50,
      paidAmount: 10,
      gap: 40,
      hasUnpaidSplit: true,
    });

    assert.equal(unpaidTableClosedDefinition.actionType, AUDIT_EVENT.UNPAID_TABLE_CLOSED);
    assert.equal(payload.tableName, 'A5');
    assert.equal(payload.afterData.tableName, 'A5');
    assert.equal(payload.afterData.sessionId, 'sess-1');
    assert.equal(payload.afterData.amountImpact, 40);
    assert.equal(payload.beforeData.gap, 40);
  });
});
