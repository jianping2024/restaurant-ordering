import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSushiSendGuidance, sushiSendGuidanceTicks } from './send-guidance';

const nowMs = Date.parse('2026-10-26T12:00:00.000Z');
const plus = (s: number) => new Date(nowMs + s * 1000).toISOString();
const base = {
  status: null,
  cooldownUntil: null,
  submitDeadlineAt: null,
  tableReviewQty: 0,
  roundCapTotal: 5,
  nowMs,
} as const;

describe('resolveSushiSendGuidance', () => {
  it('hides when no active round and nothing unsent', () => {
    assert.equal(resolveSushiSendGuidance(base), null);
    assert.equal(resolveSushiSendGuidance({ ...base, status: 'collecting' }), null);
  });

  it('warns unsent table qty (collecting or pre-status lines)', () => {
    assert.deepEqual(resolveSushiSendGuidance({ ...base, status: 'collecting', tableReviewQty: 3 }), {
      kind: 'unsent',
      qty: 3,
      full: false,
      cap: 5,
    });
    assert.equal(resolveSushiSendGuidance({ ...base, tableReviewQty: 1 })?.kind, 'unsent');
  });

  it('flags a full round so the guest sends before adding more', () => {
    const g = resolveSushiSendGuidance({ ...base, status: 'collecting', tableReviewQty: 5 });
    assert.equal(g?.kind === 'unsent' && g.full, true);
    const noCap = resolveSushiSendGuidance({ ...base, status: 'collecting', tableReviewQty: 5, roundCapTotal: 0 });
    assert.equal(noCap?.kind === 'unsent' && noCap.full, false);
  });

  it('counts down pending_confirm regardless of qty', () => {
    assert.deepEqual(
      resolveSushiSendGuidance({ ...base, status: 'pending_confirm', submitDeadlineAt: plus(17.2), tableReviewQty: 2 }),
      { kind: 'countdown', seconds: 18 },
    );
    assert.deepEqual(
      resolveSushiSendGuidance({ ...base, status: 'pending_confirm', submitDeadlineAt: plus(-3) }),
      { kind: 'countdown', seconds: 0 },
    );
  });

  it('reports failed finalize as its own state', () => {
    assert.deepEqual(resolveSushiSendGuidance({ ...base, status: 'finalize_failed', tableReviewQty: 2 }), {
      kind: 'failed',
    });
  });

  it('shows sent only while cooldown is active', () => {
    assert.deepEqual(resolveSushiSendGuidance({ ...base, status: 'cooldown', cooldownUntil: plus(90) }), {
      kind: 'sent',
      seconds: 90,
    });
    assert.equal(resolveSushiSendGuidance({ ...base, status: 'cooldown', cooldownUntil: plus(-1) }), null);
  });

  it('ticks only for countdown and sent', () => {
    assert.equal(sushiSendGuidanceTicks({ kind: 'countdown', seconds: 3 }), true);
    assert.equal(sushiSendGuidanceTicks({ kind: 'sent', seconds: 3 }), true);
    assert.equal(sushiSendGuidanceTicks({ kind: 'unsent', qty: 1, full: false, cap: 5 }), false);
    assert.equal(sushiSendGuidanceTicks(null), false);
  });
});
