import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { abnormalConfirmedDefinition } from '@/lib/audit/builders/abnormal-owner-action';

describe('abnormalConfirmedDefinition', () => {
  it('builds operation log payload without abnormal row', () => {
    const payload = abnormalConfirmedDefinition.build({
      abnormalOperationId: 'abn-1',
      abnormalType: 'ITEM_DELETED',
      previousStatus: 'PENDING',
      nextStatus: 'CONFIRMED',
      previousOwnerNote: null,
      nextOwnerNote: 'checked',
    });
    assert.equal(payload.entityId, 'abn-1');
    assert.equal(payload.beforeData.status, 'PENDING');
    assert.equal(payload.afterData.status, 'CONFIRMED');
    assert.equal(abnormalConfirmedDefinition.createsAbnormal, false);
  });
});
