import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatIndividualCallNotice,
  pickIndividualCallNoticeSignals,
  type IndividualCheckoutSignal,
} from './individual-call-notice';

const NOW = Date.parse('2026-10-05T12:00:00Z');

function signal(partial: Partial<IndividualCheckoutSignal> & { id: string }): IndividualCheckoutSignal {
  return {
    kind: 'call',
    reason: 'call',
    ticket_key: `p:${partial.id}`,
    name: 'Wang',
    items: [],
    created_at: '2026-10-05T11:59:50Z',
    ...partial,
  };
}

describe('pickIndividualCallNoticeSignals', () => {
  it('keeps recent calls from others and drops silent, own and stale ones', () => {
    const picked = pickIndividualCallNoticeSignals({
      signals: [
        signal({ id: 'a' }),
        signal({ id: 'b', kind: 'silent', reason: 'unlock' }),
        signal({ id: 'c' }),
        signal({ id: 'd', created_at: '2026-10-05T11:50:00Z' }),
      ],
      ignoreTicketKeys: new Set(['p:c']),
      nowMs: NOW,
    });
    assert.deepEqual(picked.map((s) => s.id), ['a']);
  });
});

describe('formatIndividualCallNotice', () => {
  const labels = {
    withItems: '{name} called: {items}',
    withoutItems: '{name} called',
  };

  it('lists claimed dishes when names resolve', () => {
    const text = formatIndividualCallNotice({
      signals: [
        signal({
          id: 'a',
          items: [
            { key: 'L1', qty_num: 1, qty_den: 1 },
            { key: 'L2', qty_num: 1, qty_den: 2 },
          ],
        }),
      ],
      resolveLineName: (key) => ({ L1: 'Fish', L2: 'Rice' })[key] ?? null,
      labels,
    });
    assert.equal(text, 'Wang called: Fish ×1、Rice ×1/2');
  });

  it('falls back to name only and merges several calls into lines', () => {
    const text = formatIndividualCallNotice({
      signals: [signal({ id: 'a' }), signal({ id: 'b', name: 'Li' })],
      labels,
    });
    assert.equal(text, 'Wang called\nLi called');
  });
});
