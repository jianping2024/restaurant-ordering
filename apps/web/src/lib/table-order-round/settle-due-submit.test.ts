import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSubmitDeadlinePassed } from '@/lib/table-order-round/status';

/** Mirrors settleDueTableOrderRoundSubmit gate (status + deadline) without DB. */
function shouldSettleDueSubmit(input: {
  status: string;
  submitDeadlineAt: string | null;
  nowMs: number;
}): boolean {
  if (input.status !== 'pending_confirm' && input.status !== 'finalize_failed') return false;
  return isSubmitDeadlinePassed(input.submitDeadlineAt, input.nowMs);
}

describe('settleDueTableOrderRoundSubmit gate', () => {
  const now = Date.parse('2026-10-30T12:00:00.000Z');

  it('settles pending_confirm at/after deadline', () => {
    assert.equal(
      shouldSettleDueSubmit({
        status: 'pending_confirm',
        submitDeadlineAt: '2026-10-30T12:00:00.000Z',
        nowMs: now,
      }),
      true,
    );
    assert.equal(
      shouldSettleDueSubmit({
        status: 'pending_confirm',
        submitDeadlineAt: '2026-10-30T11:59:59.000Z',
        nowMs: now,
      }),
      true,
    );
  });

  it('does not settle before deadline or on collecting', () => {
    assert.equal(
      shouldSettleDueSubmit({
        status: 'pending_confirm',
        submitDeadlineAt: '2026-10-30T12:00:01.000Z',
        nowMs: now,
      }),
      false,
    );
    assert.equal(
      shouldSettleDueSubmit({
        status: 'collecting',
        submitDeadlineAt: '2026-10-30T11:00:00.000Z',
        nowMs: now,
      }),
      false,
    );
  });

  it('settles finalize_failed when deadline passed', () => {
    assert.equal(
      shouldSettleDueSubmit({
        status: 'finalize_failed',
        submitDeadlineAt: '2026-10-30T11:59:00.000Z',
        nowMs: now,
      }),
      true,
    );
  });
});
