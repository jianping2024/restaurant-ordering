import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectAttemptFingerprint, createCollectAttemptIds } from './collect-attempt-ids';

describe('createCollectAttemptIds', () => {
  const fp = collectAttemptFingerprint({
    billSplitId: 'b1',
    personIndex: 0,
    amount: 10,
    paymentMethod: 'CASH',
  });

  it('reuses the id for a retry of the same attempt', () => {
    let n = 0;
    const ids = createCollectAttemptIds(() => `id-${++n}`);
    assert.equal(ids.idFor(fp), 'id-1');
    assert.equal(ids.idFor(fp), 'id-1');
  });

  it('mints a fresh id after the attempt settled', () => {
    let n = 0;
    const ids = createCollectAttemptIds(() => `id-${++n}`);
    assert.equal(ids.idFor(fp), 'id-1');
    ids.settle(fp);
    assert.equal(ids.idFor(fp), 'id-2');
  });

  it('keeps a different amount or method as a different attempt', () => {
    let n = 0;
    const ids = createCollectAttemptIds(() => `id-${++n}`);
    const other = collectAttemptFingerprint({
      billSplitId: 'b1',
      personIndex: 0,
      amount: 5,
      paymentMethod: 'CASH',
    });
    assert.notEqual(ids.idFor(fp), ids.idFor(other));
  });
});
