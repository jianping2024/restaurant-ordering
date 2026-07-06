import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  appendCollectedPayment,
  appendCollectedPaymentToSessionMap,
  applyConfirmPaymentToRequests,
  mergeCollectedLedgersBySession,
} from './checkout-confirm-payment-outcome';

function billSplit(overrides: Partial<BillSplit> = {}): BillSplit {
  return {
    id: 'split-1',
    restaurant_id: 'rest-1',
    order_ids: [],
    split_mode: 'even',
    persons: [],
    result: [
      { name: 'A', amount: 30, paid: true },
      { name: 'B', amount: 20 },
    ],
    total_amount: 50,
    status: 'requested',
    created_at: '2026-05-29T00:00:00.000Z',
    session_id: 'session-1',
    table_id: 'table-1',
    display_name: 'T1',
    ...overrides,
  };
}

describe('appendCollectedPayment', () => {
  it('appends and dedupes by id', () => {
    const payment = {
      id: 'pay-1',
      person_index: 0,
      person_name: 'A',
      amount: 30,
      created_at: '2026-06-27T14:30:00.000Z',
    };
    const once = appendCollectedPayment([], payment);
    assert.equal(once.length, 1);
    assert.equal(appendCollectedPayment(once, payment).length, 1);
  });
});

describe('appendCollectedPaymentToSessionMap', () => {
  it('groups by session id', () => {
    const payment = {
      id: 'pay-1',
      person_index: 0,
      person_name: 'A',
      amount: 30,
      created_at: '2026-06-27T14:30:00.000Z',
    };
    const map = appendCollectedPaymentToSessionMap(new Map(), 'session-1', payment);
    assert.equal(map.get('session-1')?.length, 1);
  });
});

describe('applyConfirmPaymentToRequests', () => {
  it('removes row when all paid', () => {
    const prev = [billSplit()];
    const next = applyConfirmPaymentToRequests(prev, 'split-1', {
      all_paid: true,
      result: [
        { name: 'A', amount: 30, paid: true },
        { name: 'B', amount: 20, paid: true },
      ],
    });
    assert.equal(next.length, 0);
  });

  it('patches result when partially paid', () => {
    const prev = [billSplit({ result: [{ name: 'A', amount: 30 }, { name: 'B', amount: 20 }] })];
    const next = applyConfirmPaymentToRequests(prev, 'split-1', {
      all_paid: false,
      result: [
        { name: 'A', amount: 30, paid: true },
        { name: 'B', amount: 20 },
      ],
    });
    assert.equal(next[0]?.result?.[0]?.paid, true);
    assert.equal(next[0]?.result?.[1]?.paid, undefined);
  });
});

describe('mergeCollectedLedgersBySession', () => {
  it('preserves optimistic rows missing from server reload', () => {
    const optimistic = new Map([
      [
        'session-1',
        [
          {
            id: 'pay-new',
            person_index: 0,
            person_name: 'A',
            amount: 30,
            created_at: '2026-06-27T15:00:00.000Z',
          },
        ],
      ],
    ]);
    const authoritative = new Map<string, typeof optimistic extends Map<string, infer V> ? V : never>();
    const merged = mergeCollectedLedgersBySession(authoritative, optimistic);
    assert.equal(merged.get('session-1')?.length, 1);
    assert.equal(merged.get('session-1')?.[0]?.id, 'pay-new');
  });
});
