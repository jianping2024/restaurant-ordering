import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  buffetBillableLineKey,
  findBuffetHeadcountBelowPaidFloor,
  lockedBuffetHeadcountByBuffetId,
} from '@/lib/buffet-paid-headcount-floor';

const BUFFET_A = 'buffet-a';
const LINE_A = buffetBillableLineKey(BUFFET_A);

function split(partial: Partial<BillSplit>): BillSplit {
  return {
    id: 's1',
    restaurant_id: 'r1',
    session_id: 'sess1',
    table_id: 't1',
    display_name: 'A1',
    order_ids: [],
    status: 'confirmed',
    split_mode: 'by_item',
    persons: [],
    result: [],
    total_amount: 0,
    created_at: '',
    ...partial,
  };
}

describe('lockedBuffetHeadcountByBuffetId', () => {
  it('returns empty when no collection has started', () => {
    const floors = lockedBuffetHeadcountByBuffetId(
      split({
        persons: [
          {
            name: 'John',
            item_shares: [
              { key: LINE_A, qty_num: 2, qty_den: 1, guest_type: 'adult' },
              { key: LINE_A, qty_num: 1, qty_den: 1, guest_type: 'child' },
            ],
          },
        ],
      }),
    );
    assert.equal(floors.size, 0);
  });

  it('sums paid guest buffet seats as floors', () => {
    const floors = lockedBuffetHeadcountByBuffetId(
      split({
        result: [
          { name: 'John', amount: 40, paid: true },
          { name: 'Mary', amount: 10, paid: false },
        ],
        persons: [
          {
            name: 'John',
            item_shares: [
              { key: LINE_A, qty_num: 2, qty_den: 1, guest_type: 'adult' },
              { key: LINE_A, qty_num: 1, qty_den: 1, guest_type: 'child' },
            ],
          },
          {
            name: 'Mary',
            item_shares: [
              { key: LINE_A, qty_num: 1, qty_den: 1, guest_type: 'adult' },
            ],
          },
        ],
      }),
    );
    assert.deepEqual(floors.get(BUFFET_A), { adults: 2, children: 1 });
  });

  it('locks all assigned buffet seats when ledger exists without paid flags', () => {
    const floors = lockedBuffetHeadcountByBuffetId(
      split({
        persons: [
          {
            name: 'John',
            item_shares: [
              { key: LINE_A, qty_num: 2, qty_den: 1, guest_type: 'adult' },
            ],
          },
          {
            name: 'Mary',
            item_shares: [
              { key: LINE_A, qty_num: 1, qty_den: 1, guest_type: 'adult' },
            ],
          },
        ],
      }),
      true,
    );
    assert.deepEqual(floors.get(BUFFET_A), { adults: 3, children: 0 });
  });
});

describe('findBuffetHeadcountBelowPaidFloor', () => {
  it('allows equal or higher headcount', () => {
    const floors = new Map([[BUFFET_A, { adults: 2, children: 1 }]]);
    assert.equal(
      findBuffetHeadcountBelowPaidFloor({ [BUFFET_A]: { adults: 2, children: 1 } }, floors),
      null,
    );
    assert.equal(
      findBuffetHeadcountBelowPaidFloor({ [BUFFET_A]: { adults: 3, children: 1 } }, floors),
      null,
    );
  });

  it('rejects lowering adults or children below floor', () => {
    const floors = new Map([[BUFFET_A, { adults: 2, children: 1 }]]);
    const adultViolation = findBuffetHeadcountBelowPaidFloor(
      { [BUFFET_A]: { adults: 1, children: 1 } },
      floors,
    );
    assert.ok(adultViolation);
    assert.equal(adultViolation.minAdults, 2);

    const childViolation = findBuffetHeadcountBelowPaidFloor(
      { [BUFFET_A]: { adults: 2, children: 0 } },
      floors,
    );
    assert.ok(childViolation);
    assert.equal(childViolation.minChildren, 1);
  });

  it('treats omitted package as zero (void blocked when floor exists)', () => {
    const floors = new Map([[BUFFET_A, { adults: 1, children: 0 }]]);
    const violation = findBuffetHeadcountBelowPaidFloor({}, floors);
    assert.ok(violation);
    assert.equal(violation.proposedAdults, 0);
  });
});
